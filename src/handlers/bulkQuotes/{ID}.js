'use strict';

const Boom = require('boom');

/**
 * Operations on /bulkQuotes/{ID}
 */
module.exports = {
    /**
     * summary: BulkQuotesByID
     * description: The HTTP request GET /bulkQuotes/&lt;ID&gt; is used to get information regarding an earlier created or requested bulk quote. The &lt;ID&gt; in the URI should contain the bulkQuoteId that was used for the creation of the bulk quote.
     * parameters: Accept
     * produces: application/json
     * responses: 202, 400, 401, 403, 404, 405, 406, 501, 503
     */
    get: function BulkQuotesByID(request, h) {
        return Boom.notImplemented();
    },
    /**
     * summary: BulkQuotesByID
     * description: The callback PUT /bulkQuotes/&lt;ID&gt; is used to inform the client of a requested or created bulk quote. The &lt;ID&gt; in the URI should contain the bulkQuoteId that was used for the creation of the bulk quote, or the &lt;ID&gt; that was used in the GET /bulkQuotes/&lt;ID&gt;.
     * parameters: body, Content-Length
     * produces: application/json
     * responses: 200, 400, 401, 403, 404, 405, 406, 501, 503
     */
    put: function BulkQuotesByID1(request, h) {
        return Boom.notImplemented();
    }
};
