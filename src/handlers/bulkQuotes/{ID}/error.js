'use strict';

const Boom = require('boom');

/**
 * Operations on /bulkQuotes/{ID}/error
 */
module.exports = {
    /**
     * summary: BulkQuotesErrorByID
     * description: If the server is unable to find or create a bulk quote, or another processing error occurs, the error callback PUT /bulkQuotes/&lt;ID&gt;/error is used. The &lt;ID&gt; in the URI should contain the bulkQuoteId that was used for the creation of the bulk quote, or the &lt;ID&gt; that was used in the GET /bulkQuotes/&lt;ID&gt;.
     * parameters: ID, body, Content-Length, Content-Type, Date, X-Forwarded-For, FSPIOP-Source, FSPIOP-Destination, FSPIOP-Encryption, FSPIOP-Signature, FSPIOP-URI, FSPIOP-HTTP-Method
     * produces: application/json
     * responses: 200, 400, 401, 403, 404, 405, 406, 501, 503
     */
    put: function BulkQuotesErrorByID() {
        return Boom.notImplemented();
    }
};
