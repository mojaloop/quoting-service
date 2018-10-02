'use strict';

const util = require('util');
const Boom = require('boom');
const QuotesModel = require('../../../model/quotes.js');
const Errors = require('../../../model/errors.js');


/**
 * Operations on /quotes/{ID}/error
 */
module.exports = {
    /**
     * summary: QuotesByIDAndError
     * description: If the server is unable to find or create a quote, or some other processing error occurs, the error callback PUT /quotes/&lt;ID&gt;/error is used. The &lt;ID&gt; in the URI should contain the quoteId that was used for the creation of the quote, or the &lt;ID&gt; that was used in the GET /quotes/&lt;ID&gt;.
     * parameters: ID, body, Content-Length, Content-Type, Date, X-Forwarded-For, FSPIOP-Source, FSPIOP-Destination, FSPIOP-Encryption, FSPIOP-Signature, FSPIOP-URI, FSPIOP-HTTP-Method
     * produces: application/json
     * responses: 200, 400, 401, 403, 404, 405, 406, 501, 503
     */
    put: async function QuotesByIDAndError(request, h) {
        //log request
        request.server.log(['info'], `got a POST /quotes/{ID}/error request: ${util.inspect(request.payload)}`);

        //instantiate a new quote model
        const model = new QuotesModel({
            db: request.server.app.database,
            requestId: request.info.id
        });

        //extract some things from the request we may need if we have to deal with an error e.g. the
        //originator and quoteId
        const quoteId = request.params.ID;
        const fspiopSource = request.headers['fspiop-source'];
        const fspiopDest = request.headers['fspiop-destination'];

        try {
            //call the quote error handler in the model
            const result = await model.handleQuoteError(fspiopSource, fspiopDest, quoteId, request.payload.errorInformation);
            request.server.log(['info'], `POST quote error request succeeded and returned: ${util.inspect(result)}`);
        }
        catch(err) {
            //if we get an error here we have most likely NOT been able to persist the quote request
            //API spec says we should return "happy days" and make an error callback...WTF?!
            request.server.log(['error'], `ERROR - POST /quotes/{ID}/error: ${err.stack || util.inspect(err)}`);

            //do the error handling in a future event loop step
            setImmediate(async () => {
                try {
                    let e = new Errors.FSPIOPError(err, `An error occured processing the request`,
                        fspiopSource, '2000', null);
                    await model.sendErrorCallback(e, quoteId);
                }
                catch(err) {
                    request.server.log(['error'], `Error sending error callback: ${err.stack || util.inspect(err)}`);
                }
            });
        }
        finally {
            return h.response().code(202);
        }
    }
};
