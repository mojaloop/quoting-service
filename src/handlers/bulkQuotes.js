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
 * Rajiv Mothilal <rajiv.mothilal@modusbox.com>
 --------------
 ******/

'use strict'

const util = require('util')
const Enum = require('@mojaloop/central-services-shared').Enum
const ErrorHandler = require('@mojaloop/central-services-error-handling')
const EventSdk = require('@mojaloop/event-sdk')
const LibUtil = require('../lib/util')
const BulkQuotesModel = require('../model/bulkQuotes')
const Metrics = require('@mojaloop/central-services-metrics')

/**
 * Operations on /bulkQuotes
 */
module.exports = {
  /**
     * summary: BulkQuotes
     * description: The HTTP request POST /bulkQuotes is used to request the creation of a bulk quote for the provided financial transactions in the server.
     * parameters: body, Accept, Content-Length, Content-Type, Date, X-Forwarded-For, FSPIOP-Source, FSPIOP-Destination, FSPIOP-Encryption, FSPIOP-Signature, FSPIOP-URI, FSPIOP-HTTP-Method
     * produces: application/json
     * responses: 202, 400, 401, 403, 404, 405, 406, 501, 503
     */
  post: async function BulkQuotes (context, request, h) {
    const histTimerEnd = Metrics.getHistogram(
      'bulkQuotes_post',
      'Process HTTP POST bulkQuotes request',
      ['success']
    ).startTimer()
    // log request
    request.server.log(['info'], `got a POST /bulkQuotes request: ${util.inspect(request.payload)}`)

    // instantiate a new quote model
    const model = new BulkQuotesModel({
      db: request.server.app.database,
      requestId: request.info.id
    })

    const quoteRequest = {
      payload: { ...request.payload },
      headers: { ...request.headers },
      span: { ...request.span },
      params: { ...request.params }
    }

    // extract some things from the request we may need if we have to deal with an error e.g. the
    // originator and quoteId
    const bulkQuoteId = quoteRequest.payload.bulkQuoteId
    const fspiopSource = quoteRequest.headers[Enum.Http.Headers.FSPIOP.SOURCE]
    const span = quoteRequest.span
    try {
      const spanTags = LibUtil.getSpanTags(quoteRequest, Enum.Events.Event.Type.BULK_QUOTE, Enum.Events.Event.Action.PREPARE)
      span.setTags(spanTags)
      await span.audit({
        headers: quoteRequest.headers,
        payload: quoteRequest.payload
      }, EventSdk.AuditEventAction.start)

      // call the quote request handler in the model
      model.handleBulkQuoteRequest(quoteRequest.headers, quoteRequest.payload, span).catch(err => {
        request.server.log(['error'], `ERROR - handleBulkQuoteRequest: ${LibUtil.getStackOrInspect(err)}`)
      })
      histTimerEnd({ success: true })
    } catch (err) {
      // something went wrong, use the model to handle the error in a sensible way
      request.server.log(['error'], `ERROR - POST /bulkQuotes: ${LibUtil.getStackOrInspect(err)}`)
      const fspiopError = ErrorHandler.ReformatFSPIOPError(err)
      model.handleException(fspiopSource, bulkQuoteId, fspiopError, quoteRequest.headers, span)
      histTimerEnd({ success: false })
    } finally {
      // eslint-disable-next-line no-unsafe-finally
      return h.response().code(Enum.Http.ReturnCodes.ACCEPTED.CODE)
    }
  }
}
