'use strict'

const util = require('util')
const QuotesModel = require('../model/quotes.js')
const Enums = require('../lib/enums')

/**
 * Operations on /transactionRequests
 */
module.exports = {
  /**
   * summary: TransactionRequests
   * description: The HTTP request POST /transactionRequests is used to request the creation of a transaction request for the provided financial transaction in the server.
   * parameters: body, accept, content-length, content-type, date, x-forwarded-for, fspiop-source, fspiop-destination, fspiop-encryption, fspiop-signature, fspiop-uri, fspiop-http-method
   * produces: application/json
   * responses: 202, 400, 401, 403, 404, 405, 406, 501, 503
   */
  post: async function (request, h) {
    request.server.log(['info'], `got a POST /transactionRequests request: ${util.inspect(request.payload)}`)

    // instantiate a new quote model
    const model = new QuotesModel({
      db: request.server.app.database,
      requestId: request.info.id
    })

    try {
      // call the quote request handler in the model
      const result = await model.forwardTransactionRequest(request.headers, Enums.endpoints.TRANSACTION_REQUEST_POST, request.method.toUpperCase(), request.payload)
      request.server.log(['info'], `POST transactionRequests request succeeded and returned: ${util.inspect(result)}`)
    } catch (err) {
      // something went wrong, use the model to handle the error in a sensible way
      request.server.log(['error'], `ERROR - POST /transactionRequests: ${err.stack || util.inspect(err)}`)
      return await model.forwardTransactionRequestError(request.headers, request.headers['fspiop-source'], Enums.endpoints.TRANSACTION_REQUEST_PUT_ERROR, Enums.restMethods.PUT, request.payload.transactionRequestId, err)
    } finally {
      // eslint-disable-next-line no-unsafe-finally
      return h.response().code(202)
    }
  }
}
