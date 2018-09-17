
const util = require('util');
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
    }


    /**
     * Logic for creating and handling quote requests
     *
     * @returns {promise} - returns object containing keys for created database entities
     */
    handleQuoteRequest(quoteRequest) {
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
                console.log(`create quote transaction committed to db: ${util.inspect(refs)}`);
                return null;
            })
            .catch(err => {
                console.log(`create quote ${quoteRequest.quoteId} transaction failed. rolling back`);
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

                this.forwardQuoteRequest(refs.payeeId);
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
    forwardQuoteRequest(payeeQuotePartyId) {
        //do everything in a db transaction
        return this.db.queryBuilder.transaction(txn => {
            //lookup payee dfsp callback endpoint
            this.db.getQuotePartyEndpoint(txn, 'FSIOP_CALLBACK_URL')
                .then(endpoint => {
                    console.log(`Resolved payee quote party ${payeeQuotePartyId} FSIOP_CALLBACK_URL endpoint to: ${util.inspect(endpoint)}`);

                    //
                })
        }).catch(err => {
            console.log(`Error forwarding quote request to payee quote party (${payeeQuotePartyId}) dfsp: ${err.stack || util.inspect(err)}`);
        });
    }

}


module.exports = QuotesModel;
