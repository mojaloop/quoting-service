'use strict';

const Boom = require('boom');

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
    get: function QuotesByID(request, h) {
        return Boom.notImplemented();
    },
    /**
     * summary: QuotesByID
     * description: The callback PUT /quotes/&lt;ID&gt; is used to inform the client of a requested or created quote. The &lt;ID&gt; in the URI should contain the quoteId that was used for the creation of the quote, or the &lt;ID&gt; that was used in the GET /quotes/&lt;ID&gt;GET /quotes/&lt;ID&gt;.
     * parameters: body, Content-Length
     * produces: application/json
     * responses: 200, 400, 401, 403, 404, 405, 406, 501, 503
     */
    put: function QuotesByID1(request, h) {
        return Boom.notImplemented();
    }
};
