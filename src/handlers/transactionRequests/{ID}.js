'use strict'

const util = require('util')
const QuotesModel = require('../../model/quotes.js')
const Enums = require('../../lib/enums')
/**
 * Operations on /transactionRequests/{ID}
 */
module.exports = {
  /**
   * summary: TransactionRequestsByID
   * description: The HTTP request GET /transactionRequests/&lt;ID&gt; is used to get information regarding an earlier created or requested transaction request. The &lt;ID&gt; in the URI should contain the transactionRequestId that was used for the creation of the transaction request.
   * parameters: accept
   * produces: application/json
   * responses: 202, 400, 401, 403, 404, 405, 406, 501, 503
   */
  get: async function (request, h) {
    request.server.log(['info'], `got a GET /transactionRequests/{ID} request: ${util.inspect(request.payload)}`)

    // instantiate a new quote model
    const model = new QuotesModel({
      db: request.server.app.database,
      requestId: request.info.id
    })

    try {
      // call the quote request handler in the model
      const result = await model.forwardTransactionRequest(request.headers, Enums.endpoints.TRANSACTION_REQUEST_GET, request.method.toUpperCase(), {transactionRequestId: request.params.ID})
      request.server.log(['info'], `GET transactionRequests/{ID} request succeeded and returned: ${util.inspect(result)}`)
    } catch (err) {
      // something went wrong, use the model to handle the error in a sensible way
      request.server.log(['error'], `ERROR - GET /transactionRequests/{ID}: ${err.stack || util.inspect(err)}`)
      return await model.forwardTransactionRequestError(request.headers, request.headers['fspiop-source'],Enums.endpoints.TRANSACTION_REQUEST_PUT_ERROR, Enums.restMethods.PUT, request.params.ID, err)
    } finally {
      // eslint-disable-next-line no-unsafe-finally
      return h.response().code(202)
    }
  },
  /**
   * summary: TransactionRequestsByID
   * description: The callback PUT /transactionRequests/&lt;ID&gt; is used to inform the client of a requested or created transaction request. The &lt;ID&gt; in the URI should contain the transactionRequestId that was used for the creation of the transaction request, or the &lt;ID&gt; that was used in the GET /transactionRequests/&lt;ID&gt;.
   * parameters: body, content-length
   * produces: application/json
   * responses: 200, 400, 401, 403, 404, 405, 406, 501, 503
   */
  put: async function (request, h) {
    request.server.log(['info'], `got a PUT /transactionRequests/{ID} request: ${util.inspect(request.payload)}`)

    // instantiate a new quote model
    const model = new QuotesModel({
      db: request.server.app.database,
      requestId: request.info.id
    })

    try {
      // call the quote request handler in the model
      const result = await model.forwardTransactionRequest(request.headers, Enums.endpoints.TRANSACTION_REQUEST_PUT, request.method.toUpperCase(), request.payload)
      request.server.log(['info'], `PUT transactionRequests/{ID} request succeeded and returned: ${util.inspect(result)}`)
    } catch (err) {
      // something went wrong, use the model to handle the error in a sensible way
      request.server.log(['error'], `ERROR - PUT /transactionRequests/{ID}: ${err.stack || util.inspect(err)}`)
      return await model.forwardTransactionRequestError(request.headers, request.headers['fspiop-source'],Enums.endpoints.TRANSACTION_REQUEST_PUT_ERROR, Enums.restMethods.PUT, request.params.ID, err)
    } finally {
      // eslint-disable-next-line no-unsafe-finally
      return h.response().code(202)
    }
  }
}
