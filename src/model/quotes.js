
const util = require('util');
const fetch = require('node-fetch');
const Errors = require('./errors.js');
const quoteRules = require('./rules.js');

/**
 * Encapsulates operations on the quotes domain model
 *
 * @returns {undefined}
 */
class QuotesModel {
    constructor(config) {
        this.config = config;
        this.db = config.db;
        this.requestId = config.requestId;
    }


    /**
     * Validates the form of a quote request object
     *
     * @returns {promise} - promise will reject if request is not valid
     */
    validateQuoteRequest(quoteResuest) {
        //todo: actually do the validation (possibly use joi as per mojaloop)
        return Promise.resolve();
    }

    /**
     * Logic for creating and handling quote requests
     *
     * @returns {promise} - returns object containing keys for created database entities
     */
    handleQuoteRequest(fspiopSource, quoteRequest) {
        //todo: find a better way to accumulate results of sequential promise execution.
        //native promises dont have a 'reduce' and other workarounds are a bit yucky.
        //use a closure which is also a bit yucky.
        let refs = {};

        return this.db.queryBuilder.transaction(txn => {
            //insert duplicate check - this will throw if this is a duplicate quote request
            //todo: create hash of quoteRequest
            return this.db.createQuoteDuplicateCheck(txn, quoteRequest.quoteId, null)
                .then(id => {
                    //create a txn reference
                    return this.db
                        .createTransactionReference(txn, quoteRequest.quoteId, quoteRequest.transactionId);
                }).then(id => {
                    refs.transactionReferenceId = id;

                    //get initiator type
                    return this.db
                        .getInitiatorType(txn, quoteRequest.transactionType.initiatorType);
                }).then(id => {
                    refs.transactionInitiatorTypeId = id;

                    //get initiator
                    return this.db
                        .getInitiator(txn, quoteRequest.transactionType.initiator);
                }).then(id => {
                    refs.transactionInitiatorId = id;

                    //get txn scenario
                    return this.db
                        .getScenario(txn, quoteRequest.transactionType.scenario);
                }).then(id => {
                    refs.transactionScenarioId = id;

                    if(quoteRequest.transactionType.subScenario) {
                        //a sub scenario is specified, we need to look it up
                        return this.db
                            .getSubScenario(txn, quoteRequest.transactionType.subScenario)
                            .then(id => {
                                refs.transactionSubScenarioId = id;
                            });
                    }
                    //no sub scenario specified, just proceed
                    return Promise.resolve();
                }).then(() => {
                    //get amount type
                    return this.db
                        .getAmountType(txn, quoteRequest.amountType);
                }).then(id => {
                    refs.amountTypeId = id;

                    //create the quote row itself
                    return this.db
                        .createQuote(txn, {
                            quoteId: quoteRequest.quoteId,
                            transactionReferenceId: refs.transactionReferenceId,
                            transactionRequestId: quoteRequest.transactionRequestId || null,
                            note: quoteRequest.note,
                            expirationDate: quoteRequest.expiration ? new Date(quoteRequest.expiration) : null,
                            transactionInitiatorId: refs.transactionInitiatorId,
                            transactionInitiatorTypeId: refs.transactionInitiatorTypeId,
                            transactionScenarioId: refs.transactionScenarioId,
                            balanceOfPaymentsId: quoteRequest.transactionType.balanceOfPayments ? Number(quoteRequest.transactionType.balanceOfPayments) : null,
                            transactionSubScenarioId: refs.transactionSubScenarioId,
                            amountTypeId: refs.amountTypeId,
                            amount: quoteRequest.amount.amount,
                            currencyId: quoteRequest.amount.currency
                        });
                }).then(id => {
                    refs.quoteId = id;

                    //create the payer party
                    return this.db
                        .createPayerQuoteParty(txn, refs.quoteId, quoteRequest.payer,
                            quoteRequest.amount.amount, quoteRequest.amount.currency); 
                }).then(id => {
                    refs.payerId = id;

                    //create the payee party
                    return this.db
                        .createPayeeQuoteParty(txn, refs.quoteId, quoteRequest.payee,
                            quoteRequest.amount.amount, quoteRequest.amount.currency);
                }).then(id => {
                    refs.payeeId = id;

                    //note that knex promises to commit the txn if we get here
                    //so no need to call txn.commit() explicitly
                    //txn.commit();
                    this.writeLog(`create quote transaction committed to db: ${util.inspect(refs)}`);
                    return null;
                })
                .catch(err => {
                    this.writeLog(`create quote ${quoteRequest.quoteId} transaction failed. rolling back`);
                    //note that knex promises to rollback the txn if we throw here
                    //so no need to call txn.rollback() explicitly
                    //txn.rollback();
                    throw err;
                });
        })
        .then(() => {
            /* 
            * Todo:
            *  1. check rules
            *  2. lookup recipient dfsp
            *  3. make a call to them with the quote request
            *  4. handle the callback from them and store any relevant data that comes back
            *  5. reply to the quote originator
            */

            //if we got here, all entities have been created in db correctly to record the quote request

            //make call to payee dfsp in a setImmediate;
            //attempting to give fair execution of async events...
            //see https://rclayton.silvrback.com/scheduling-execution-in-node-js etc...
            setImmediate(async () => {
                //check quote rules
                const failures = await quoteRules.getFailures(quoteRequest);
                if (failures) {
                    //quote broke business rules, queue up an error callback to the caller
                }

                //if we got here rules passed, so we can forward the quote on to the recipient dfsp
                this.forwardQuoteRequest(fspiopSource, refs.quoteId, quoteRequest);
            });

            //all ok, return created quoteId
            return refs;
        });
    }


    /**
     * Forwards a quote request to a payee DFSP for processing
     *
     * @returns {undefined}
     */
    forwardQuoteRequest(fspiopSource, quoteId, originalQuoteRequest) {
        //do everything in a db transaction
        return this.db.queryBuilder.transaction(txn => {
            //lookup payee dfsp callback endpoint
            //TODO: for MVP we assume initiator is always payer dfsp! this may not always be the case if a xfer is requested by payee
            this.db.getQuotePartyEndpoint(txn, quoteId, 'FSIOP_CALLBACK_URL', 'PAYEE')
                .then(endpoint => {
                    this.writeLog(`Resolved PAYEE party FSIOP_CALLBACK_URL endpoint for quote ${quoteId} to: ${util.inspect(endpoint)}`);

                    if(!endpoint) {
                        //we didnt get an endpoint for the payee dfsp!
                        //make an error callback to the initiator
                        return this.sendErrorCallback(new errors.FSPIOPError(null, 
                            `No FSIOP_CALLBACK_URL found for quote ${quoteId} PAYEE party`, fspiopSource, '1001'),
                            quoteId);
                    }

                    let fullUrl = `${endpoint}/quotes`;

                    this.writeLog(`Forwarding quote request to endpoint: ${fullUrl}`);
 
                    let opts = {
                        method: 'POST',
                        body: JSON.stringify(originalQuoteRequest),
                        headers: {
                            'Content-Type': 'application/vnd.interoperability.resource+json;version=1.0',
                            'Date': new Date().toUTCString(),
                            'FSPIOP-Source': 'switch' //todo: what should this be?
                        }
                    };

                    return fetch(fullUrl, opts)
                        .then(res => {
                            this.writeLog(`forwarding quote request got response ${res.status} ${res.statusText}`);

                            if(!res.ok) {
                                throw new Error(`Got non-success response sending error callback`);
                            }
                        })
                        .catch(err => {
                            //we need to make an error callback to the originator of the quote request

                        });
                });
        }).catch(err => {
            this.writeLog(`Error forwarding quote request to payee quote party (${payeeQuotePartyId}) dfsp: ${err.stack || util.inspect(err)}`);
        });
    }


    /**
     * Makes an error callback. Callback is sent to the FSIOP_CALLBACK_URL endpoint of the replyTo participant in the 
     * supplied fspiopErr object. This should be the participantId for the error callback recipient e.g. value from the
     * FSPIOP-Source header of the original request that caused the error. 
     *
     * @returns {promise}
     */
    sendErrorCallback(fspiopErr, quoteId) {
        return new Promise((resolve, reject) => {
            if(!(fspiopErr instanceof Errors.FSPIOPError)) {
                return reject(new Error(`fspiopErr not an instance of FSPIOPError`));
            }

            this.db.queryBuilder.transaction(txn => {
                //look up the callback base url
                return this.db.getParticipantEndpoint(txn, fspiopErr.replyTo, 'FSIOP_CALLBACK_URL')
                    .then(endpoint => {
                        this.writeLog(`Resolved participant '${fspiopErr.replyTo}' FSIOP_CALLBACK_URL to: '${endpoint}'`);

                        if(!endpoint) {
                            //oops, we cant make an error callback if we dont have an endpoint to call!
                            return reject(new Error(`No FSIOP_CALLBACK_URL found for ${fspiopErr.replyTo} unable to make error callback`));
                        }

                        let fullCallbackUrl = `${endpoint}/quotes/${quoteId}/error`;

                        //log the error
                        this.writeLog(`Making error callback to participant '${fspiopErr.replyTo}' for quoteId '${quoteId}' to ${fullCallbackUrl} for error: ${util.inspect(fspiopErr.toFullErrorObject())}`);

                        //make an error callback
                        let opts = {
                            method: 'POST',
                            body: JSON.stringify(fspiopErr.toApiErrorObject()),
                            headers: {
                                'Content-Type': 'application/vnd.interoperability.resource+json;version=1.0',
                                'Date': new Date().toUTCString(),
                                'FSPIOP-Source': 'switch' //todo: what should this be?
                            }
                        };

                        return fetch(fullCallbackUrl, opts)
                            .then(res => {
                                this.writeLog(`Error callback got response ${res.status} ${res.statusText}`);

                                if(!res.ok) {
                                    throw new Error(`Got non-success response sending error callback`);
                                }
                            });
                    })
                    .then(() => {
                        return resolve(null);
                    })
                    .catch(err => {
                        throw err;
                    });
            })
            .catch(err => {
                return reject(err);
            });
        });
    }

    writeLog(message) {
        console.log(`${new Date().toISOString()}, (${this.requestId}) [quotesmodel]: ${message}`);
    }

}


module.exports = QuotesModel;
