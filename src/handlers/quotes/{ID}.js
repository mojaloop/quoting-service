'use strict';


const util = require('util');
const Boom = require('boom');
const QuotesModel = require('../../model/quotes.js');
const Errors = require('../../model/errors.js');


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

        try {
            //get the quote in API spec projection from the model
            const result = await model.getQuoteResponseApiProjection(null, quoteId);
            request.server.log(['info'], `GET quotes/{id} request succeeded and returned: ${util.inspect(result)}`);
        }
        catch(err) {
            //if we get an error here we have most likely NOT been able to persist the quote request
            //API spec says we should return "happy days" and make an error callback...WTF?!
            request.server.log(['error'], `ERROR - GET /quotes/{id}: ${err.stack || util.inspect(err)}`);

            //do the error handling in a future event loop step
            setImmediate(async () => {
                try {
                    let e = new Errors.FSPIOPError(err, `An error occured processing the request`, fspiopSource, '1000', null);
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

        try {
            //call the quote update handler in the model
            const result = await model.handleQuoteUpdate(fspiopSource, quoteId, request.payload);
            request.server.log(['info'], `PUT quote request succeeded and returned: ${util.inspect(result)}`);
        }
        catch(err) {
            //if we get an error here we have most likely NOT been able to persist the quote request
            //API spec says we should return "happy days" and make an error callback...WTF?!
            request.server.log(['error'], `ERROR - PUT /quotes/{id}: ${err.stack || util.inspect(err)}`);

            //do the error handling in a future event loop step
            setImmediate(async () => {
                try {
                    let e = new Errors.FSPIOPError(err, `An error occured processing the request`, fspiopSource, '1000', null);
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
