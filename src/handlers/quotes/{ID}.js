'use strict';


const util = require('util');
const QuotesModel = require('../../model/quotes.js');


/**
 * Operations on /quotes/{ID}
 */
module.exports = {
    /**
     * summary: QuotesByID
     * description: The HTTP request GET /quotes/&lt;ID&gt; is used to get information regarding an earlier created or requested quote. The &lt;ID&gt; in the URI should contain the quoteId that was used for the creation of the quote.
     * parameters: Accept
     * produces: application/json
     * responses: 202, 400, 401, 403, 404, 405, 406, 501, 503
     */
    get: async function getQuotesById(request, h) {
        //log request
        request.server.log(['info'], `got a GET /quotes/{id} request for quoteId ${request.params.ID}`);

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
        const fspiopSignature = request.headers['fspiop-signature'];

        try {
            //call the model to re-forward the quote update to the correct party
            //note that we do not check if our caller is the correct party, but we
            //will send the callback to the correct party regardless.
            const result = await model.handleQuoteGet(fspiopSource, fspiopDest, fspiopSignature, quoteId);
            request.server.log(['info'], `GET quotes/{id} request succeeded and returned: ${util.inspect(result)}`);
        }
        catch(err) {
            //something went wrong, use the model to handle the error in a sensible way
            request.server.log(['error'], `ERROR - GET /quotes/{id}: ${err.stack || util.inspect(err)}`);
            await model.handleException(fspiopSource, quoteId, err);
        }
        finally {
            //eslint-disable-next-line no-unsafe-finally
            return h.response().code(202);
        }
    },


    /**
     * summary: QuotesByID
     * description: The callback PUT /quotes/&lt;ID&gt; is used to inform the client of a requested or created quote. The &lt;ID&gt; in the URI should contain the quoteId that was used for the creation of the quote, or the &lt;ID&gt; that was used in the GET /quotes/&lt;ID&gt;GET /quotes/&lt;ID&gt;.
     * parameters: body, Content-Length
     * produces: application/json
     * responses: 200, 400, 401, 403, 404, 405, 406, 501, 503
     */
    put: async function putQuotesByID(request, h) {
        //log request
        request.server.log(['info'], `got a PUT /quotes/{id} request: ${util.inspect(request.payload)}`);

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
        const fspiopSignature = request.headers['fspiop-signature'];

        try {
            //call the quote update handler in the model
            const result = await model.handleQuoteUpdate(fspiopSource, fspiopDest, fspiopSignature, quoteId, request.payload);
            request.server.log(['info'], `PUT quote request succeeded and returned: ${util.inspect(result)}`);
        }
        catch(err) {
            //something went wrong, use the model to handle the error in a sensible way
            request.server.log(['error'], `ERROR - PUT /quotes/{id}: ${err.stack || util.inspect(err)}`);
            await model.handleException(fspiopSource, quoteId, err);
        }
        finally {
            //eslint-disable-next-line no-unsafe-finally
            return h.response().code(202);
        }
    }
};
