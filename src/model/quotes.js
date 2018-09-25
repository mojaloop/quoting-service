
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
        //todo: actually do the validation (use joi as per mojaloop)
        return Promise.resolve(null);
    }


    /**
     * Validates the form of a quote update object
     *
     * @returns {promise} - promise will reject if request is not valid
     */
    async validateQuoteUpdate(quoteUpdate) {
        //todo: actually do the validation (use joi as per mojaloop)
        return Promise.resolve(null);
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
            const dupe = await this.checkDuplicateQuoteRequest(txn, quoteRequest);

            this.writeLog(`Check duplicate for quoteId ${quoteRequest.quoteId} returned: ${util.inspect(dupe)}`);

            //fail fast on duplicate
            if(dupe.isDuplicateId && (!dupe.isResend)) {
                //same quoteId but a different request, this is an error!
                throw new Error(`Quote id ${quoteRequest.quoteId} is a duplicate but hashes dont match`);
            }

            if(dupe.isResend && dupe.isDuplicateId) {
                //this is a resend
                //See section 3.2.5.1 in "API Definition v1.0.docx" API specification document.
                return this.handleQuoteRequestResend(fspiopSource, quoteRequest);
            }

            //todo: validation

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

            //all ok, return refs
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

            if(!originalQuoteRequest) {
                //we need to recreate the quote request
                originalQuoteRequest = await this.getQuoteRequestApiProjection(txn, quoteId);
                this.writeLog(`Recreated quote request: ${util.inspect(originalQuoteRequest)}`);
            }

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
    async handleQuoteRequestResend(fspiopSource, quoteRequest) {
        try {
            this.writeLog(`Handling resend of quoteRequest: ${util.inspect(quoteRequest)} from ${fspiopSource}`);
            throw new Error(`Resends currently not implemented by quoting service`);
        }
        catch(err) {
            this.writeLog(`Error in handleQuoteRequestResend: ${err.stack || util.inspect(err)}`);
            throw err;
        }
    }


    /**
     * Deals with resends under the API spec:
     * See section 3.2.5.1 in "API Definition v1.0.docx" API specification document.
     *
     * @returns {undefined}
     */
    async handleQuoteUpdateResend(fspiopSource, quoteId, quoteUpdate) {
        try {
            this.writeLog(`Handling resend of quote update: ${util.inspect(quoteUpdate)} from ${fspiopSource}`);
            throw new Error(`Resends currently not implemented by quoting service`);
        }
        catch(err) {
            this.writeLog(`Error in handleQuoteUpdateResend: ${err.stack || util.inspect(err)}`);
            throw err;
        }
    }


    /**
     * Logic for handling quote update requests e.g. PUT /quotes/{id} requests 
     *
     * @returns {object} - object containing updated entities
     */
    async handleQuoteUpdate(fspiopSource, quoteId, quoteUpdateRequest) {
        try {
            //accumulate enum ids
            let refs = {};

            //do everything in a transaction so we can rollback multiple operations if something goes wrong
            const txn = await this.db.newTransaction();

            //check if this is a resend or an erroneous duplicate
            const dupe = await this.checkDuplicateQuoteResponse(txn, quoteId, quoteUpdateRequest);
            this.writeLog(`Check duplicate for quoteId ${quoteId} update returned: ${util.inspect(dupe)}`);

            //fail fast on duplicate
            if(dupe.isDuplicateId && (!dupe.isResend)) {
                //same quoteId but a different request, this is an error!
                throw new Error(`Quote response id ${quoteId} is a duplicate but hashes dont match`);
            }

            if(dupe.isResend && dupe.isDuplicateId) {
                //this is a resend
                //See section 3.2.5.1 in "API Definition v1.0.docx" API specification document.
                return this.handleQuoteUpdateResend(fspiopSource, quoteId, quoteUpdateRequest);
            }

            //todo: validation

            //create the quote response row in the db
            const newQuoteResponse = await this.db.createQuoteResponse(txn, quoteId, {
                condition: quoteUpdateRequest.condition,
                expiration: quoteUpdateRequest.expiration ? new Date(quoteUpdateRequest.expiration) : null,
                isValid: quoteUpdateRequest.isValid
            });

            refs.quoteResponseId = newQuoteResponse.quoteResponseId;

            //create ilp packet in the db
            const ilpPacketId = await this.db.createQuoteResponseIlpPacket(txn, refs.quoteResponseId, quoteUpdateRequest.ilpPacket);

            //create any additional quoteParties e.g. for fees, comission etc...

            await txn.commit();
            this.writeLog(`create quote update transaction committed to db: ${util.inspect(refs)}`);

            ///if we got here, all entities have been created in db correctly to record the quote request

            //check quote response rules
            let test = { ...quoteUpdateRequest };

            //const failures = await quoteRules.getFailures(test);
            //if (failures && failures.length > 0) {
                //quote broke business rules, queue up an error callback to the caller
            //    this.writeLog(`Rules failed for quoteId ${refs.quoteId}: ${util.inspect(failures)}`);
                //todo: make error callback
            //}

            //make call to payee dfsp in a setImmediate;
            //attempting to give fair execution of async events...
            //see https://rclayton.silvrback.com/scheduling-execution-in-node-js etc...
            setImmediate(() => {
                //if we got here rules passed, so we can forward the quote on to the recipient dfsp
                this.forwardQuoteResponse(fspiopSource, quoteId, quoteUpdateRequest);
            });

            //all ok, return refs
            return refs;
        }
        catch(err) {
            this.writeLog(`Error in handleQuoteUpdate: ${err.stack || util.inspect(err)}`);
            throw err;
        }
    }


    /**
     * Forwards a quote response to a payer DFSP for processing
     *
     * @returns {undefined}
     */
    async forwardQuoteResponse(fspiopSource, quoteId, originalQuoteResponse) {
        let txn = null;
        let endpoint = null;

        try {
            //do everything in a db transaction
            txn = await this.db.newTransaction();

            if(!originalQuoteResponse) {
                //we need to recreate the quote response
                originalQuoteResponse = await this.getQuoteResponseApiProjection(txn, quoteId);
                this.writeLog(`Recreated quote response: ${util.inspect(originalQuoteResponse)}`);
            }

            //lookup payer dfsp callback endpoint
            //todo: for MVP we assume initiator is always payer dfsp! this may not always be the case if a xfer is requested by payee
            endpoint = await this.db.getQuotePartyEndpoint(txn, quoteId, 'FSIOP_CALLBACK_URL', 'PAYER');
 
            this.writeLog(`Resolved PAYER party FSIOP_CALLBACK_URL endpoint for quote ${quoteId} to: ${util.inspect(endpoint)}`);

            if(!endpoint) {
                //we didnt get an endpoint for the payee dfsp!
                //make an error callback to the initiator
                return this.sendErrorCallback(new Errors.FSPIOPError(null, 
                    `No FSIOP_CALLBACK_URL found for quote ${quoteId} PAYER party`, fspiopSource, '1001'),
                    quoteId);
            }

            let fullUrl = `${endpoint}/quotes/${quoteId}`;

            this.writeLog(`Forwarding quote response to endpoint: ${fullUrl}`);

            let opts = {
                method: 'PUT',
                body: JSON.stringify(originalQuoteResponse),
                headers: {
                    'Content-Type': 'application/vnd.interoperability.resource+json;version=1.0',
                    'Date': new Date().toUTCString(),
                    'FSPIOP-Source': SWITCH_FSPIOP_SOURCE_HEADER //todo: what should this be?
                }
            };

            const res = await fetch(fullUrl, opts);
            this.writeLog(`forwarding quote response got response ${res.status} ${res.statusText}`);

            if(!res.ok) {
                throw new Error(`Got non-success response sending error callback`);
            }

            //txn.commit();
        }
        catch(err) {
            this.writeLog(`Error forwarding quote response to endpoint ${endpoint}: ${err.stack || util.inspect(err)}`);
            if(txn) {
                //txn.rollback();
            }

            //we need to make an error callback to the originator of the quote response
            setImmediate(() => {
                return this.sendErrorCallback(new Errors.FSPIOPError(err, 
                    `Error sending quote response to 'PAYER' participant`, fspiopSource, '1003'),
                    quoteId);
            });
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
    async checkDuplicateQuoteRequest(txn, quoteRequest) {
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
            this.writeLog(`Error in checkDuplicateQuoteRequest: ${err.stack || util.inspect(err)}`);
            throw err;
        }
    }


    /**
     * Tests to see if this quote reqponse is a RESEND of a previous response or an inadvertant duplicate quoteId.
     *
     * See section 3.2.5.1 in "API Definition v1.0.docx" API specification document.
     *
     * @returns {promise} - resolves to an object thus: { isResend: {boolean}, isDuplicateId: {boolean} }
     */
    async checkDuplicateQuoteResponse(txn, quoteId, quoteResponse) {
        try {
            //calculate a SHA-256 of the request
            const hash = this.calculateRequestHash(quoteResponse);
            this.writeLog(`Calculated sha256 hash of quote response with id ${quoteId} as: ${hash}`);
            
            const dupchk = await this.db.getQuoteResponseDuplicateCheck(txn, quoteId);
            this.writeLog(`DB query for quote response duplicate check with id ${quoteId} returned: ${util.inspect(dupchk)}`);

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
            this.writeLog(`Error in checkDuplicateQuoteResponse: ${err.stack || util.inspect(err)}`);
            throw err;
        }
    }


    /**
     * Returns a quote response object 
     *
     * @returns {undefined}
     */
    async getQuoteResponseApiProjection(txn, quoteId) {

    }


    /**
     * Returns a quote object in the form defined by the API spec
     * e.g. with enum values resolved to their textual identifiers.
     * Includes parties etc...
     *
     * @returns {object}
     */
    async getQuoteRequestApiProjection(txn, quoteId) {
        try {
            if(!txn) {
                txn = await this.db.newTransaction();
            }

            const quoteObject = await this.db.getQuoteView(txn, quoteId);

            if(!quoteObject) {
                throw new Error(`Quote ${quoteId} not found`);
            }

            //get and validate the quote parties
            const quoteParties = await this.db.getQuotePartyView(txn, quoteId);

            if((!quoteParties) || quoteParties.length < 2) {
                throw new Error(`Expected 2 quote parties but got: ${util.inspect(quoteParties)}`);
            }

            const payerParty = quoteParties.find((p) => {
                return p.partyType === 'PAYER';
            });

            const payeeParty = quoteParties.find((p) => {
                return p.partyType === 'PAYEE';
            });

            if(!(payerParty && payeeParty)) {
                throw new Error(`Expected a PAYEE and a PAYER party but got ${util.inspect(payeeParty)} and ${util.inspect(payerParty)}`);
            }

            let apiProjection = {
                quoteId: quoteId,
                transactionId: quoteObject.transactionReferenceId,
                transactionRequestId: quoteObject.transactionRequestId,
                payee: this.quotePartyViewToApiParty(payeeParty),
                payer: this.quotePartyViewToApiParty(payerParty),
                amountType: quoteObject.amountType,
                amount: {
                    amount: this.amountDecimalToApiAmount(quoteObject.currency, quoteObject.amount),
                    currency: quoteObject.currency
                },
                fees: undefined, //todo
                transactionType: {
                    scenario: quoteObject.transactionScenario,
                    subScenario: quoteObject.transactionSubScenario,
                    initiator: quoteObject.transactionInitiator,
                    initiatorType: quoteObject.transactionInitiatorType,
                    balanceOfPayments: `${quoteObject.balanceOfPaymentsId}`
                },
                geoCode: undefined, //todo
                note: quoteObject.note,
                expiration: quoteObject.expirationDate.toISOString(),
                extensionList: undefined
            };

            return this.removeEmptyKeys(apiProjection);
        }
        catch(err) {
            this.writeLog(`Error in getQuoteApiProjection: ${err.stack || util.inspect(err)}`);
            throw err;
        }
    }


    /**
     * Utility function to remove null and undefined keys from an object.
     * This is useful for removing "nulls" that come back from database queries
     * when projecting into API spec objects
     *
     * @returns {object}
     */
    removeEmptyKeys(originalObject) {
        let obj = { ...originalObject };
        Object.keys(obj).forEach(key => {
            if (obj[key] && typeof obj[key] === 'object') {
                if(Object.keys(obj[key]).length < 1) {
                    //remove empty object
                    delete obj[key];
                }
                else {
                    //recurse
                    this.removeEmptyKeys(obj[key]);
                }
            }
            else if (obj[key] == null) {
                //null or undefined, remove it
                delete obj[key];
            }
        });
        return obj;
    }


    /**
     * Converts a quotePartyView row to an API spec party object
     *
     * @returns {object}
     */
    quotePartyViewToApiParty(party) {
        let personalInfo = {
            dateOfBirth: party.dateOfBirth
        };

        if(party.firstName || party.lastName || party.middleName) {
            personalInfo.complexName = this.removeEmptyKeys({
                firstName: party.firstName,
                middleName: party.middleName,
                lastName: party.lastName
            });
        }

        return this.removeEmptyKeys({
            partyIdInfo: this.removeEmptyKeys({
                partyIdType: party.identifierType,
                partyIdentifier: party.partyIdentifierValue,
                partySubIdOrType: party.partySubIdOrType,
                fspId: party.fspId
            }),
            merchantClassificationCode: party.merchantClassificationCode,
            name: party.partyName,
            personalInfo: Object.keys(personalInfo).length > 0 ? this.removeEmptyKeys(personalInfo) : undefined
        });
    }

    /**
     * Converts a decimal amount e.g. from database representation to an API spec
     * amount e.g. integer
     *
     * @returns {undefined}
     */
    amountDecimalToApiAmount(currencyId, amount) {
        //todo: lookup currency exponent and multipl!y
        return `${amount}`;
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
