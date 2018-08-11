'use strict';


const util = require('util');
const Boom = require('boom');


const Errors = {
    PostQuoteError: 'A server error occured. Please contact support and quote error number: Q0001'
};


/**
 * Operations on /quotes
 */
module.exports = {
    /**
     * summary: Quotes
     * description: The HTTP request POST /quotes is used to request the creation of a quote for the provided financial transaction in the server.
     * parameters: body, Accept, Content-Length, Content-Type, Date, X-Forwarded-For, FSPIOP-Source, FSPIOP-Destination, FSPIOP-Encryption, FSPIOP-Signature, FSPIOP-URI, FSPIOP-HTTP-Method
     * produces: application/json
     * responses: 202, 400, 401, 403, 404, 405, 406, 501, 503
     */
    post: function Quotes(request, h) {
        //log request
        request.server.log(['info'], `got a POST /quotes request: ${util.inspect(request.payload)}`);

        //todo: validate incoming request.payload

        //todo: find a better way to accumulate results of sequential promise execution.
        //native promises dont have a 'reduce' and other workarounds are a bit yucky.
        //use a closure which is also a bit yucky.
        let refs = {};

        return request.server.app.database.queryBuilder.transaction(function(txn) {
            //insert duplicate check - this will throw if this is a duplicate quote request
            //todo: create hash of request payload
            return request.server.app.database.createQuoteDuplicateCheck(txn, request.payload.quoteId, null)
            .then(id => {
                //ensure txn reference exists
                return request.server.app.database
                    .createTransactionReference(txn, request.payload.quoteId, request.payload.transactionId);
            }).then(id => {
                refs.transactionReferenceId = id;

                //ensure initiator type exists
                return request.server.app.database
                    .ensureInitiatorType(txn, request.payload.transactionType.initiatorType);
            }).then(id => {
                refs.transactionInitiatorTypeId = id;

                //ensure initiator exists
                return request.server.app.database
                    .ensureInitiator(txn, request.payload.transactionType.initiator);
            }).then(id => {
                refs.transactionInitiatorId = id;

                //ensure txn scenario exists
                //todo: fail if scenario does not ALREADY exist!
                return request.server.app.database
                    .ensureScenario(txn, request.payload.transactionType.scenario);
            }).then(id => {
                refs.transactionScenarioId = id;

                //ensure amount type exists
                //todo: fail if amount type does not ALREADY exist!
                return request.server.app.database
                    .ensureAmountType(txn, request.payload.amountType);
            }).then(id => {
                refs.amountTypeId = id;

                //create the quote row itself
                return request.server.app.database
                    .createQuote(txn, {
                        quoteId: request.payload.quoteId,
                        transactionReferenceId: refs.transactionReferenceId,
                        transactionRequestId: request.payload.transactionRequestId || null,
                        note: request.payload.note,
                        expirationDate: request.payload.expiration ? new Date(request.payload.expiration) : null,
                        transactionInitiatorId: refs.transactionInitiatorId,
                        transactionInitiatorTypeId: refs.transactionInitiatorTypeId,
                        transactionScenarioId: refs.transactionScenarioId,
                        //balanceOfPaymentsId: ,
                        //transactionSubScenarioId: ,
                        amountTypeId: refs.amountTypeId,
                        amount: request.payload.amount.amount,
                        //currencyId: ,
                        //createdDate: ,
                    });
            }).then(id => {
                refs.quoteId = id;

                //create the payer party
                return request.server.app.database
                    .createPayerQuoteParty(txn, refs.quoteId, request.payload.payer); 
            }).then(id => {
                refs.payerId = id;

                //create the payee party
                return request.server.app.database
                    .createPayeeQuoteParty(txn, refs.quoteId, request.payload.payee);
            }).then(id => {
                refs.payeeId = id;

                //note that knex promises to commit the txn if we get here
                //so no need to call txn.commit() explicitly
                //txn.commit();
                request.server.log(['info'], `POST /quotes transaction committed to db: ${util.inspect(refs)}`);
                return null;
            })
            .catch(err => {
                request.server.log(['error'], `quote ${request.payload.quoteId} post transaction failed. rolling back`);
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

            //all ok, return HTTP accepted as per API spec
            return h.response().code(202);
        })
        .catch(err => {
            request.server.log(['error'], `ERROR - POST /quotes: ${err.stack || util.inspect(err)}`);
            return Boom.badImplementation(Errors.PostQuoteError);
        });
    }
};
