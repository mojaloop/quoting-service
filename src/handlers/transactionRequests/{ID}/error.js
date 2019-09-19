'use strict'

const util = require('util')
const QuotesModel = require('../../../model/quotes.js')
const Enums = require('../../../lib/enums')
/**
 * Operations on /transactionRequests/{ID}/error
 */
module.exports = {
  /**
   * summary: TransactionRequestsErrorByID
   * description: If the server is unable to find or create a transaction request, or another processing error occurs, the error callback PUT /transactionRequests/&lt;ID&gt;/error is used. The &lt;ID&gt; in the URI should contain the transactionRequestId that was used for the creation of the transaction request, or the &lt;ID&gt; that was used in the GET /transactionRequests/&lt;ID&gt;.
   * parameters: ID, body, content-length, content-type, date, x-forwarded-for, fspiop-source, fspiop-destination, fspiop-encryption, fspiop-signature, fspiop-uri, fspiop-http-method
   * produces: application/json
   * responses: 200, 400, 401, 403, 404, 405, 406, 501, 503
   */
  put: async function (request, h) {
    request.server.log(['info'], `got a PUT /transactionRequests/{ID}/error request: ${util.inspect(request.payload)}`)

    // instantiate a new quote model
    const model = new QuotesModel({
      db: request.server.app.database,
      requestId: request.info.id
    })

    try {
      // call the quote request handler in the model
      const result = await model.forwardTransactionRequestError(request.headers, request.headers['fspiop-destination'], Enums.endpoints.TRANSACTION_REQUEST_PUT_ERROR, request.method.toUpperCase(), request.params.ID, request.payload)
      request.server.log(['info'], `PUT transactionRequests/{ID}/error request succeeded and returned: ${util.inspect(result)}`)
    } catch (err) {
      // something went wrong, use the model to handle the error in a sensible way
      request.server.log(['error'], `ERROR - PUT /transactionRequests/{ID}/error: ${err.stack || util.inspect(err)}`)
      return await model.forwardTransactionRequestError(request.headers, request.headers['fspiop-source'], Enums.endpoints.TRANSACTION_REQUEST_PUT_ERROR, Enums.restMethods.PUT, request.params.ID, err)
    } finally {
      // eslint-disable-next-line no-unsafe-finally
      return h.response().code(202)
    }
  }
}
