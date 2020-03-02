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

 * ModusBox
 - Georgi Georgiev <georgi.georgiev@modusbox.com>
 - Henk Kodde <henk.kodde@modusbox.com>
 --------------
 ******/

'use strict'

const util = require('util')
const Enum = require('@mojaloop/central-services-shared').Enum
const EventSdk = require('@mojaloop/event-sdk')
const LibUtil = require('../../lib/util')
const QuotesModel = require('../../model/quotes.js')

/**
 * Operations on /quotes/{id}
 */
module.exports = {
  /**
     * summary: QuotesById
     * description: The HTTP request GET /quotes/&lt;id&gt; is used to get information regarding an earlier created or requested quote. The &lt;id&gt; in the URI should contain the quoteId that was used for the creation of the quote.
     * parameters: Accept
     * produces: application/json
     * responses: 202, 400, 401, 403, 404, 405, 406, 501, 503
     */
  get: async function getQuotesById (request, h) {
    // log request
    request.server.log(['info'], `got a GET /quotes/{id} request for quoteId ${request.params.id}`)

    // instantiate a new quote model
    const model = new QuotesModel({
      db: request.server.app.database,
      requestId: request.info.id
    })

    // extract some things from the request we may need if we have to deal with an error e.g. the
    // originator and quoteId
    const quoteId = request.params.id
    const fspiopSource = request.headers[Enum.Http.Headers.FSPIOP.SOURCE]

    const span = request.span
    try {
      const spanTags = LibUtil.getSpanTags(request, Enum.Events.Event.Type.QUOTE, Enum.Events.Event.Action.GET)
      span.setTags(spanTags)
      await span.audit({
        headers: request.headers,
        payload: request.payload
      }, EventSdk.AuditEventAction.start)
      // call the model to re-forward the quote update to the correct party
      // note that we do not check if our caller is the correct party, but we
      // will send the callback to the correct party regardless.
      const result = await model.handleQuoteGet(request.headers, quoteId, span)
      request.server.log(['info'], `GET quotes/{id} request succeeded and returned: ${util.inspect(result)}`)
    } catch (err) {
      // something went wrong, use the model to handle the error in a sensible way
      request.server.log(['error'], `ERROR - GET /quotes/{id}: ${LibUtil.getStackOrInspect(err)}`)
      await model.handleException(fspiopSource, quoteId, err, request.headers, span)
    } finally {
      // eslint-disable-next-line no-unsafe-finally
      return h.response().code(Enum.Http.ReturnCodes.ACCEPTED.CODE)
    }
  },

  /**
     * summary: QuotesById
     * description: The callback PUT /quotes/&lt;id&gt; is used to inform the client of a requested or created quote. The &lt;id&gt; in the URI should contain the quoteId that was used for the creation of the quote, or the &lt;id&gt; that was used in the GET /quotes/&lt;id&gt;GET /quotes/&lt;id&gt;.
     * parameters: body, Content-Length
     * produces: application/json
     * responses: 200, 400, 401, 403, 404, 405, 406, 501, 503
     */
  put: async function putQuotesById (request, h) {
    // log request
    request.server.log(['info'], `got a PUT /quotes/{id} request: ${util.inspect(request.payload)}`)

    // instantiate a new quote model
    const model = new QuotesModel({
      db: request.server.app.database,
      requestId: request.info.id
    })

    // extract some things from the request we may need if we have to deal with an error e.g. the
    // originator and quoteId
    const quoteId = request.params.id
    const fspiopSource = request.headers[Enum.Http.Headers.FSPIOP.SOURCE]

    const span = request.span
    try {
      const spanTags = LibUtil.getSpanTags(request, Enum.Events.Event.Type.QUOTE, Enum.Events.Event.Action.FULFIL)
      span.setTags(spanTags)
      await span.audit({
        headers: request.headers,
        payload: request.payload
      }, EventSdk.AuditEventAction.start)
      // call the quote update handler in the model
      const result = await model.handleQuoteUpdate(request.headers, quoteId, request.payload, span)
      request.server.log(['info'], `PUT quote request succeeded and returned: ${util.inspect(result)}`)
    } catch (err) {
      // something went wrong, use the model to handle the error in a sensible way
      request.server.log(['error'], `ERROR - PUT /quotes/{id}: ${LibUtil.getStackOrInspect(err)}`)
      await model.handleException(fspiopSource, quoteId, err, request.headers, span)
    } finally {
      // eslint-disable-next-line no-unsafe-finally
      return h.response().code(Enum.Http.ReturnCodes.OK.CODE)
    }
  }
}
