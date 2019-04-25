'use strict';

const util = require('util');
const QuotesModel = require('../../../model/quotes.js');


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

        try {
            //call the quote error handler in the model
            const result = await model.handleQuoteError(request.headers, quoteId, request.payload.errorInformation);
            request.server.log(['info'], `PUT quote error request succeeded and returned: ${util.inspect(result)}`);
        }
        catch(err) {
            //something went wrong, use the model to handle the error in a sensible way
            request.server.log(['error'], `ERROR - PUT /quotes/{ID}/error: ${err.stack || util.inspect(err)}`);
            await model.handleException(fspiopSource, quoteId, err);
        }
        finally {
            //eslint-disable-next-line no-unsafe-finally
            return h.response().code(200);
        }
    }
};
