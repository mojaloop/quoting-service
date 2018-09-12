'use strict';


const util = require('util');
const Boom = require('boom');
const QuotesModel = require('../model/quotes.js');


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

        //instantiate a new quote model
        const model = new QuotesModel({
            db: request.server.app.database
        });

        //call the quote request handler in the model
        return model.handleQuoteRequest(request.payload)
            .then((res) => {
                request.server.log(['info'], `POST quote request succeeded and returned: ${res}`);

                //return 'accepted' status code to caller.
                //note that the contract we have with the
                //model is that it will take any other
                //background actions necessary to filfil
                //the API spec such as making further calls
                //to participants etc...
                return h.response().code(202);
            })
            .catch(err => {
                //todo: work out what error response code to send

                request.server.log(['error'], `ERROR - POST /quotes: ${err.stack || util.inspect(err)}`);
                return Boom.badImplementation(Errors.PostQuoteError);
            });
    }
};



