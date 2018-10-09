'use strict';


const util = require('util');
const Boom = require('boom');
const QuotesModel = require('../model/quotes.js');
const Errors = require('../model/errors.js');



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
    post: async function Quotes(request, h) {
        //log request
        request.server.log(['info'], `got a POST /quotes request: ${util.inspect(request.payload)}`);

        //instantiate a new quote model
        const model = new QuotesModel({
            db: request.server.app.database,
            requestId: request.info.id
        });

        //extract some things from the request we may need if we have to deal with an error e.g. the
        //originator and quoteId
        const quoteId = request.payload.quoteId;
        const fspiopSource = request.headers['fspiop-source'];
        const fspiopDest = request.headers['fspiop-destination'];

        try {
            //call the quote request handler in the model
            const result = await model.handleQuoteRequest(fspiopSource, fspiopDest, request.payload);
            request.server.log(['info'], `POST quote request succeeded and returned: ${util.inspect(result)}`);
        }
        catch(err) {
            //something went wrong, use the model to handle the error in a sensible way
            request.server.log(['error'], `ERROR - POST /quotes: ${err.stack || util.inspect(err)}`);
            await model.handleException(fspiopSource, quoteId, err);
        }
        finally {
            return h.response().code(202);
        }
    }
};



