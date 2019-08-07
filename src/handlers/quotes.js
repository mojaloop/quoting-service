// (C)2018 ModusBox Inc.
/*****
 License
 --------------
 Copyright © 2017 Bill & Melinda Gates Foundation
 The Mojaloop files are made available by the Bill & Melinda Gates Foundation under the Apache License, Version 2.0 (the "License") and you may not use these files except in compliance with the License. You may obtain a copy of the License at
 http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, the Mojaloop files are distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.

 Initial contribution
 --------------------
 The initial functionality and code base was donated by the Mowali project working in conjunction with MTN and Orange as service provides.
 * Project: Mowali

 Contributors
 --------------
 This is the official list of the Mojaloop project contributors for this file.
 Names of the original copyright holders (individuals or organizations)
 should be listed with a '*' in the first column. People who have
 contributed from an organization can be listed under the organization
 that actually holds the copyright for their contributions (see the
 Gates Foundation organization for an example). Those individuals should have
 their names indented and be marked with a '-'. Email address can be added
 optionally within square brackets <email>.
 * Gates Foundation
 - Name Surname <name.surname@gatesfoundation.com>

 * Henk Kodde <henk.kodde@modusbox.com>
 * Georgi Georgiev <georgi.georgiev@modusbox.com>
 --------------
 ******/

'use strict'

const ErrorHandler = require('@mojaloop/central-services-error-handling')
const util = require('util')
const QuotesModel = require('../model/quotes.js')

/**
 * Operations on /quotes
 */
module.exports = {
  /**
     * summary: Quotes
     * description: The HTTP request POST /quotes is used to request the creation of a quote for the provided financial transaction in the server.
     * parameters: body, Accept, Content-Length, Content-Type, Date, X-Forwarded-For, FSPIOP-Source, FSPIOP-Destination, FSPIOP-Encryption, FSPIOP-Signature, FSPIOP-URI, FSPIOP-HTTP-Method
     * produces: application/json
     * responses: 202, 400, 401, 403, 404, 405, 406, 501, 503
     */
  post: async function Quotes (request, h) {
    // log request
    request.server.log(['info'], `got a POST /quotes request: ${util.inspect(request.payload)}`)

    // instantiate a new quote model
    const model = new QuotesModel({
      db: request.server.app.database,
      requestId: request.info.id
    })

    // extract some things from the request we may need if we have to deal with an error e.g. the
    // originator and quoteId
    const quoteId = request.payload.quoteId
    const fspiopSource = request.headers['fspiop-source']

    try {
      // call the quote request handler in the model
      const result = await model.handleQuoteRequest(request.headers, request.payload)
      request.server.log(['info'], `POST quote request succeeded and returned: ${util.inspect(result)}`)
    } catch (err) {
      // something went wrong, use the model to handle the error in a sensible way
      request.server.log(['error'], `ERROR - POST /quotes: ${err.stack || util.inspect(err)}`)
      const fspiopError = ErrorHandler.ReformatFSPIOPError(err)
      await model.handleException(fspiopSource, quoteId, fspiopError)
    } finally {
      // eslint-disable-next-line no-unsafe-finally
      return h.response().code(202)
    }
  }
}
