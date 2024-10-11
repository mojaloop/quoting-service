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

const Metrics = require('@mojaloop/central-services-metrics')
const { Producer } = require('@mojaloop/central-services-stream').Util
const { Http, Events } = require('@mojaloop/central-services-shared').Enum

const util = require('../../lib/util')
const Config = require('../../lib/config')
const dto = require('../../lib/dto')

const { kafkaConfig, isIsoApi } = new Config()

/**
 * Operations on /quotes/{id}
 */
module.exports = {
  /**
     * summary: QuotesById
     * description:
     *  - The HTTP request GET /quotes/&lt;id&gt; is used to get information regarding an earlier created or requested quote. The &lt;id&gt; in the URI should contain the quoteId that was used for the creation of the quote.
     *  - The HTTP request `GET /fxQuotes/{ID}` is used to request information regarding a request for quotation for a  currency conversion which the sender has previously issued. The `{ID}` in the URI should contain the `conversionRequestId` that was used for the creation of the quote.
     * parameters: Accept
     * produces: application/json
     * responses: 202, 400, 401, 403, 404, 405, 406, 501, 503
     */
  get: async function getQuotesById (context, request, h) {
    const isFX = util.isFxRequest(request.headers)

    const histTimerEnd = Metrics.getHistogram(
      isFX ? 'fxQuotes_id_get' : 'quotes_id_get',
      isFX ? 'Publish HTTP GET /fxQuotes/{ID} request' : 'Publish HTTP GET /quotes/{id} request',
      ['success']
    ).startTimer()

    try {
      await util.auditSpan(request)

      const eventType = isFX ? Events.Event.Type.FX_QUOTE : Events.Event.Type.QUOTE
      const producerConfig = isFX ? kafkaConfig.PRODUCER.FX_QUOTE.GET : kafkaConfig.PRODUCER.QUOTE.GET

      const { topic, config } = producerConfig
      const topicConfig = dto.topicConfigDto({ topicName: topic })
      const message = await dto.messageFromRequestDto(request, eventType, Events.Event.Action.GET)

      await Producer.produceMessage(message, topicConfig, config)

      histTimerEnd({ success: true })
      return h.response().code(Http.ReturnCodes.ACCEPTED.CODE)
    } catch (err) {
      histTimerEnd({ success: false })
      util.rethrowFspiopError(err)
    }
  },

  /**
     * summary: QuotesById and QuotesByIdAndError
     * description:
     *  - The callback PUT /quotes/&lt;id&gt; is used to inform the client of a requested or created quote. The &lt;id&gt; in the URI should contain the quoteId that was used for the creation of the quote, or the &lt;id&gt; that was used in the GET /quotes/&lt;id&gt;GET /quotes/&lt;id&gt;,
     *  - The callback `PUT /fxQuotes/{ID}` is used to inform the requester about the  outcome of a request for quotation for a currency conversion. The `{ID}` in the URI should contain the `conversionRequestId` that was used for the  creation of the FX quote, or the `{ID}` that was used in the `GET /fxQuotes/{ID}` request.
     *  - If the server is unable to find or create a quote, or some other processing error occurs, the error callback PUT /quotes/&lt;id&gt;/error is used. The &lt;id&gt; in the URI should contain the quoteId that was used for the creation of the quote, or the &lt;id&gt; that was used in the GET /quotes/&lt;id&gt;.
     *  - If the FXP is unable to find or create a FX quote, or some other processing error occurs, the error callback `PUT /fxQuotes/{ID}/error` is used. The `{ID}` in the URI should contain the `conversionRequestId` that was used for the creation of the FX quote, or the `{ID}` that was used in the `GET /fxQuotes/{ID}` request.
     * parameters: body, Content-Length
     * produces: application/json
     * responses: 200, 400, 401, 403, 404, 405, 406, 501, 503
     */
  put: async function putQuotesById (context, request, h) {
    const isFX = util.isFxRequest(request.headers)
    const isError = !!request.payload.errorInformation

    let metricsId = isFX ? 'fxQuotes_id_put' : 'quotes_id_put'
    metricsId = isError ? `${metricsId}_error` : metricsId

    const pathSuffix = isError ? '/error' : ''

    const histTimerEnd = Metrics.getHistogram(
      metricsId,
      isFX ? `Publish HTTP PUT /fxQuotes/{id}${pathSuffix} request` : `Publish HTTP PUT /quotes/{id}${pathSuffix} request`,
      ['success']
    ).startTimer()

    try {
      await util.auditSpan(request)

      const eventType = isFX ? Events.Event.Type.FX_QUOTE : Events.Event.Type.QUOTE
      const producerConfig = isFX ? kafkaConfig.PRODUCER.FX_QUOTE.PUT : kafkaConfig.PRODUCER.QUOTE.PUT

      const { topic, config } = producerConfig
      const topicConfig = dto.topicConfigDto({ topicName: topic })
      const message = await dto.messageFromRequestDto(request, eventType, Events.Event.Action.PUT, isIsoApi)

      await Producer.produceMessage(message, topicConfig, config)

      histTimerEnd({ success: true })
      return h.response().code(Http.ReturnCodes.OK.CODE)
    } catch (err) {
      histTimerEnd({ success: false })
      util.rethrowFspiopError(err)
    }
  }
}
