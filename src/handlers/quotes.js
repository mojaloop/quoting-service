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
    post: function Quotes(request, h) {
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

        //note that the following is a perfect place for Promise.finally()
        //unfortunately not supported in this node version.

        return model.validateQuoteRequest(request.payload)
            .then(() => {
                //call the quote request handler in the model
                return model.handleQuoteRequest(fspiopSource, request.payload);
            })
            .then((result) => {
                request.server.log(['info'], `POST quote request succeeded and returned: ${util.inspect(result)}`);

                //finally will return 'accepted' status code to caller.
                //note that the contract we have with the model is that
                //it will take any other background actions necessary to
                //filfil the API spec such as making further calls to
                //participants etc...
                return h.response().code(202);
            })
            .catch(err => {
                //if we get an error here we have most likely NOT been able to persist the quote request
                //API spec says we should return "happy days" and make an error callback...WTF?!
                request.server.log(['error'], `ERROR - POST /quotes: ${err.stack || util.inspect(err)}`);

                //do the error handling in a future event loop step
                setImmediate(() => {
                    let e = new Errors.FSPIOPError(err, `An error occured processing the request`,fspiopSource, '1000', null);

                    return model.sendErrorCallback(e, quoteId)
                        .catch(err => {
                            request.server.log(['error'], `Error sending error callback: ${err.stack || util.inspect(err)}`);
                        });
                });

                return h.response().code(202);
            });
    }
};



