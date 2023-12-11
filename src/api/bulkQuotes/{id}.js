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

const util = require('util')
const Enum = require('@mojaloop/central-services-shared').Enum
const EventSdk = require('@mojaloop/event-sdk')
const LibUtil = require('../../lib/util')
const BulkQuotesModel = require('../../model/bulkQuotes')
const Metrics = require('@mojaloop/central-services-metrics')
const Logger = require('@mojaloop/central-services-logger')

/**
 * Operations on /bulkQuotes/{id}
 */
module.exports = {
  /**
     * summary: getBulkQuotesById
     * description: The HTTP request GET /bulkQuotes/&lt;id&gt; is used to get information regarding an earlier created or requested bulk quote. The &lt;id&gt; in the URI should contain the bulkQuoteId that was used for the creation of the bulk quote.
     * parameters: Accept
     * produces: application/json
     * responses: 202, 400, 401, 403, 404, 405, 406, 501, 503
     */
  get: async function getBulkQuotesById (context, request, h) {
    const histTimerEnd = Metrics.getHistogram(
      'quotes_id_get',
      'Process HTTP GET /bulkQuotes/{id} request',
      ['success']
    ).startTimer()
    // log request
    Logger.isDebugEnabled && Logger.debug(`got a GET /bulkQuotes/{id} request for bulkQuoteId ${request.params.id}`)

    // instantiate a new quote model
    const model = new BulkQuotesModel({
      db: request.server.app.database,
      requestId: request.info.id
    })

    const quoteRequest = {
      payload: { ...request.payload },
      headers: { ...request.headers },
      params: { ...request.params },
      span: request.span
    }

    // extract some things from the request we may need if we have to deal with an error e.g. the
    // originator and quoteId
    const bulkQuoteId = quoteRequest.params.id
    const fspiopSource = quoteRequest.headers[Enum.Http.Headers.FSPIOP.SOURCE]
    const span = quoteRequest.span
    try {
      const spanTags = LibUtil.getSpanTags(quoteRequest, Enum.Events.Event.Type.BULK_QUOTE, Enum.Events.Event.Action.GET)
      span.setTags(spanTags)
      await span.audit({
        headers: quoteRequest.headers,
        payload: quoteRequest.payload
      }, EventSdk.AuditEventAction.start)
      // call the model to re-forward the quote update to the correct party
      // note that we do not check if our caller is the correct party, but we
      // will send the callback to the correct party regardless.
      model.handleBulkQuoteGet(quoteRequest.headers, bulkQuoteId, span).catch(err => {
        Logger.isErrorEnabled && Logger.error(`ERROR - handleBulkQuoteGet: ${LibUtil.getStackOrInspect(err)}`)
      })
      histTimerEnd({ success: true })
    } catch (err) {
      // something went wrong, use the model to handle the error in a sensible way
      Logger.isErrorEnabled && Logger.error(`ERROR - GET /bulkQuotes/{id}: ${LibUtil.getStackOrInspect(err)}`)
      model.handleException(fspiopSource, bulkQuoteId, err, quoteRequest.headers, span)
      histTimerEnd({ success: false })
    } finally {
      // eslint-disable-next-line no-unsafe-finally
      return h.response().code(Enum.Http.ReturnCodes.ACCEPTED.CODE)
    }
  },
  /**
     * summary: putBulkQuotesById
     * description: The callback PUT /bulkQuotes/&lt;id&gt; is used to inform the client of a requested or created bulk quote. The &lt;id&gt; in the URI should contain the bulkQuoteId that was used for the creation of the bulk quote, or the &lt;id&gt; that was used in the GET /bulkQuotes/&lt;id&gt;.
     * parameters: body, Content-Length
     * produces: application/json
     * responses: 200, 400, 401, 403, 404, 405, 406, 501, 503
     */
  put: async function putBulkQuotesById (context, request, h) {
    const histTimerEnd = Metrics.getHistogram(
      'quotes_id_get',
      'Process HTTP PUT /bulkQuotes/{id} request',
      ['success']
    ).startTimer()
    // log request
    Logger.isDebugEnabled && Logger.debug(`got a PUT /bulkQuotes/{id} request: ${util.inspect(request.payload)}`)

    // instantiate a new quote model
    const model = new BulkQuotesModel({
      db: request.server.app.database,
      requestId: request.info.id
    })

    const quoteRequest = {
      payload: { ...request.payload },
      headers: { ...request.headers },
      span: request.span,
      params: { ...request.params }
    }

    // extract some things from the request we may need if we have to deal with an error e.g. the
    // originator and quoteId
    const bulkQuoteId = quoteRequest.params.id
    const fspiopSource = quoteRequest.headers[Enum.Http.Headers.FSPIOP.SOURCE]
    const span = quoteRequest.span

    try {
      const spanTags = LibUtil.getSpanTags(quoteRequest, Enum.Events.Event.Type.BULK_QUOTE, Enum.Events.Event.Action.FULFIL)
      span.setTags(spanTags)
      await span.audit({
        headers: quoteRequest.headers,
        payload: quoteRequest.payload
      }, EventSdk.AuditEventAction.start)
      // call the quote update handler in the model
      model.handleBulkQuoteUpdate(quoteRequest.headers, bulkQuoteId, quoteRequest.payload, span).catch(err => {
        Logger.isErrorEnabled && Logger.error(`ERROR - handleBulkQuoteUpdate: ${LibUtil.getStackOrInspect(err)}`)
      })
      histTimerEnd({ success: true })
    } catch (err) {
      // something went wrong, use the model to handle the error in a sensible way
      Logger.isErrorEnabled && Logger.error(`ERROR - PUT /bulkQuotes/{id}: ${LibUtil.getStackOrInspect(err)}`)
      model.handleException(fspiopSource, bulkQuoteId, err, quoteRequest.headers, span)
      histTimerEnd({ success: false })
    }

    return h.response().code(Enum.Http.ReturnCodes.OK.CODE)
  }
}