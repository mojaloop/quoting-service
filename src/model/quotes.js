
const util = require('util');
const crypto = require('crypto');

const fetch = require('node-fetch');
const Errors = require('./errors.js');
const quoteRules = require('./rules.js');


const SWITCH_FSPIOP_SOURCE_HEADER = 'switch';


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
    async validateQuoteRequest(quoteResuest) {
        //todo: actually do the validation (possibly use joi as per mojaloop)
        return Promise.resolve();
    }

    /**
     * Logic for creating and handling quote requests
     *
     * @returns {object} - returns object containing keys for created database entities
     */
    async handleQuoteRequest(fspiopSource, quoteRequest) {
        let txn = null;

        try {
            //accumulate enum ids
            let refs = {};

            //do everything in a db txn so we can rollback multiple operations if something goes wrong
            txn = await this.db.newTransaction();

            //check if this is a resend or an erroneous duplicate
            const dupe = await this.checkDuplicate(txn, quoteRequest);

            this.writeLog(`Check duplicate for quoteId ${quoteRequest.quoteId} returned: ${util.inspect(dupe)}`);

            //fail fast on duplicate
            if(dupe.isDuplicateId && (!dupe.isResend)) {
                //same quoteId but a different request, this is an error!
                throw new Error(`Quote id ${quoteRequest.quoteId} is a duplicate but hashes dont match`);
            }

            if(dupe.isResend && dupe.isDuplicateId) {
                //this is a resend
                //See section 3.2.5.1 in "API Definition v1.0.docx" API specification document.
                return this.handleResend(fspiopSource, quoteRequest);
            }

            //if we get here we need to create a duplicate check row
            const hash = this.calculateRequestHash(quoteRequest);
            await this.db.createQuoteDuplicateCheck(txn, quoteRequest.quoteId, hash);

            //create a txn reference
            refs.transactionReferenceId = await this.db.createTransactionReference(txn,
                quoteRequest.quoteId, quoteRequest.transactionId);

            //get the initiator type
            refs.transactionInitiatorTypeId = await this.db.getInitiatorType(txn,
                quoteRequest.transactionType.initiatorType);

            //get the initiator
            refs.transactionInitiatorId = await this.db.getInitiator(txn,
                quoteRequest.transactionType.initiator);

            //get the txn scenario id
            refs.transactionScenarioId = await this.db.getScenario(txn, quoteRequest.transactionType.scenario);

            if(quoteRequest.transactionType.subScenario) {
                //a sub scenario is specified, we need to look it up
                refs.transactionSubScenarioId = await this.db.getSubScenario(txn,
                    quoteRequest.transactionType.subScenario);
            }

            //get amount type
            refs.amountTypeId = await this.db.getAmountType(txn, quoteRequest.amountType);

            //create the quote row itself
            refs.quoteId = await this.db.createQuote(txn, {
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

            refs.payerId = await this.db.createPayerQuoteParty(txn, refs.quoteId, quoteRequest.payer,
                quoteRequest.amount.amount, quoteRequest.amount.currency); 

            refs.payeeId = await this.db.createPayeeQuoteParty(txn, refs.quoteId, quoteRequest.payee,
                quoteRequest.amount.amount, quoteRequest.amount.currency);

            await txn.commit();
            this.writeLog(`create quote transaction committed to db: ${util.inspect(refs)}`);

            //if we got here, all entities have been created in db correctly to record the quote request

            //check quote rules
            let test = { ...quoteRequest };

            const failures = await quoteRules.getFailures(test);
            if (failures && failures.length > 0) {
                //quote broke business rules, queue up an error callback to the caller
                this.writeLog(`Rules failed for quoteId ${refs.quoteId}: ${util.inspect(failures)}`);
                //todo: make error callback
            }

            //make call to payee dfsp in a setImmediate;
            //attempting to give fair execution of async events...
            //see https://rclayton.silvrback.com/scheduling-execution-in-node-js etc...
            setImmediate(() => {
                //if we got here rules passed, so we can forward the quote on to the recipient dfsp
                this.forwardQuoteRequest(fspiopSource, refs.quoteId, quoteRequest);
            });

            //all ok, return created quoteId
            return refs;
        }
        catch(err) {
            this.writeLog(`Error in handleQuoteRequest for quoteId ${quoteRequest.quoteId}: ${err.stack || util.inspect(err)}`);
            txn.rollback(err);
            throw err;
        }
    }


    /**
     * Forwards a quote request to a payee DFSP for processing
     *
     * @returns {undefined}
     */
    async forwardQuoteRequest(fspiopSource, quoteId, originalQuoteRequest) {
        let txn = null;
        let endpoint = null;

        try {
            //do everything in a db transaction
            txn = await this.db.newTransaction();

            //lookup payee dfsp callback endpoint
            //todo: for MVP we assume initiator is always payer dfsp! this may not always be the case if a xfer is requested by payee
            endpoint = await this.db.getQuotePartyEndpoint(txn, quoteId, 'FSIOP_CALLBACK_URL', 'PAYEE');
 
            this.writeLog(`Resolved PAYEE party FSIOP_CALLBACK_URL endpoint for quote ${quoteId} to: ${util.inspect(endpoint)}`);

            if(!endpoint) {
                //we didnt get an endpoint for the payee dfsp!
                //make an error callback to the initiator
                return this.sendErrorCallback(new Errors.FSPIOPError(null, 
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
                    'FSPIOP-Source': SWITCH_FSPIOP_SOURCE_HEADER //todo: what should this be?
                }
            };

            const res = await fetch(fullUrl, opts);
            this.writeLog(`forwarding quote request got response ${res.status} ${res.statusText}`);

            if(!res.ok) {
                throw new Error(`Got non-success response sending error callback`);
            }

            //txn.commit();
        }
        catch(err) {
            this.writeLog(`Error forwarding quote request to endpoint ${endpoint}: ${err.stack || util.inspect(err)}`);
            if(txn) {
                //txn.rollback();
            }

            //we need to make an error callback to the originator of the quote request
            setImmediate(() => {
                return this.sendErrorCallback(new Errors.FSPIOPError(err, 
                    `Error sending quote to 'PAYEE' participant`, fspiopSource, '1002'),
                    quoteId);
            });
        }
    }


    /**
     * Deals with resends under the API spec:
     * See section 3.2.5.1 in "API Definition v1.0.docx" API specification document.
     *
     * @returns {undefined}
     */
    async handleResend(fspiopSource, quoteRequest) {
        try {
            this.writeLog(`Handling resend of quoteRequest: ${util.inspect(quoteRequest)} from ${fspiopSource}`);
            throw new Error(`Resends currently not implemented by quoting service`);
        }
        catch(err) {
            this.writeLog(`Error in handleResend: ${err.stack || util.inspect(err)}`);
            throw err;
        }
    }


    /**
     * Makes an error callback. Callback is sent to the FSIOP_CALLBACK_URL endpoint of the replyTo participant in the 
     * supplied fspiopErr object. This should be the participantId for the error callback recipient e.g. value from the
     * FSPIOP-Source header of the original request that caused the error. 
     *
     * @returns {promise}
     */
    async sendErrorCallback(fspiopErr, quoteId) {
        let txn = null;

        try {
            if(!(fspiopErr instanceof Errors.FSPIOPError)) {
                throw new Error(`fspiopErr not an instance of FSPIOPError`);
            }

            txn = await this.db.newTransaction();

            //look up the callback base url
            const endpoint = await this.db.getParticipantEndpoint(txn, fspiopErr.replyTo, 'FSIOP_CALLBACK_URL');

            this.writeLog(`Resolved participant '${fspiopErr.replyTo}' FSIOP_CALLBACK_URL to: '${endpoint}'`);

            if(!endpoint) {
                //oops, we cant make an error callback if we dont have an endpoint to call!
                throw new Error(`No FSIOP_CALLBACK_URL found for ${fspiopErr.replyTo} unable to make error callback`);
            }

            let fullCallbackUrl = `${endpoint}/quotes/${quoteId}/error`;

            //log the original error
            this.writeLog(`Making error callback to participant '${fspiopErr.replyTo}' for quoteId '${quoteId}' to ${fullCallbackUrl} for error: ${util.inspect(fspiopErr.toFullErrorObject())}`);

            //make an error callback
            let opts = {
                method: 'POST',
                body: JSON.stringify(fspiopErr.toApiErrorObject()),
                headers: {
                    'Content-Type': 'application/vnd.interoperability.resource+json;version=1.0',
                    'Date': new Date().toUTCString(),
                    'FSPIOP-Source': SWITCH_FSPIOP_SOURCE_HEADER //todo: what should this be?
                }
            };

            const res = await fetch(fullCallbackUrl, opts);
            this.writeLog(`Error callback got response ${res.status} ${res.statusText}`);

            if(!res.ok) {
                throw new Error(`Got non-success response sending error callback`);
            }
        }
        catch(err) {
            this.writeLog(`Error in sendErrorCallback: ${err.stack || util.inspect(err)}`);
            throw err;
        }
    }


    /**
     * Tests to see if this quote request is a RESEND of a previous request or an inadvertant duplicate quoteId.
     *
     * See section 3.2.5.1 in "API Definition v1.0.docx" API specification document.
     *
     * @returns {promise} - resolves to an object thus: { isResend: {boolean}, isDuplicateId: {boolean} }
     */
    async checkDuplicate(txn, quoteRequest) {
        try {
            //calculate a SHA-256 of the request
            const hash = this.calculateRequestHash(quoteRequest);
            this.writeLog(`Calculated sha256 hash of quote request with id ${quoteRequest.quoteId} as: ${hash}`);
            
            const dupchk = await this.db.getQuoteDuplicateCheck(txn, quoteRequest.quoteId);
            this.writeLog(`DB query for quote duplicate check with id ${quoteRequest.quoteId} returned: ${util.inspect(dupchk)}`);

            if(!dupchk) {
                //no existing record for this quoteId found
                return {
                    isResend: false,
                    isDuplicateId: false
                };
            }

            if(dupchk.hash === hash) {
                //hash matches, this is a resend
                return {
                    isResend: true,
                    isDuplicateId: true
                };
            }

            //if we get here then this is a duplicate id but not a resend e.g. hashes dont match.
            return {
                isResend: false,
                isDuplicateId: true
            };
        }
        catch(err) {
            this.writeLog(`Error in checkDuplicate: ${err.stack || util.inspect(err)}`);
            throw err;
        }
    }

    
    /**
     * Returns the SHA-256 hash of the supplied request object
     *
     * @returns {undefined}
     */
    calculateRequestHash(request) {
        //calculate a SHA-256 of the request
        const requestStr = JSON.stringify(request);
        return crypto.createHash('sha256').update(requestStr).digest('hex');
    }


    /**
     * Writes a formatted message to the console 
     *
     * @returns {undefined}
     */
    writeLog(message) {
        console.log(`${new Date().toISOString()}, (${this.requestId}) [quotesmodel]: ${message}`);
    }

}


module.exports = QuotesModel;
