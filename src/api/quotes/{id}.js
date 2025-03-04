/*****
 License
 --------------
 Copyright © 2020-2025 Mojaloop Foundation
 The Mojaloop files are made available by the Mojaloop Foundation under the Apache License, Version 2.0 (the "License") and you may not use these files except in compliance with the License. You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, the Mojaloop files are distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.

 Contributors
 --------------
 This is the official list of the Mojaloop project contributors for this file.
 Names of the original copyright holders (individuals or organizations)
 should be listed with a '*' in the first column. People who have
 contributed from an organization can be listed under the organization
 that actually holds the copyright for their contributions (see the
 Mojaloop Foundation for an example). Those individuals should have
 their names indented and be marked with a '-'. Email address can be added
 optionally within square brackets <email>.

 * Mojaloop Foundation
 - Name Surname <name.surname@mojaloop.io>

  Initial contribution
 --------------------
 The initial functionality and code base was donated by the Mowali project working in conjunction with MTN and Orange as service provides.
 * Project: Mowali

 * ModusBox
 - Georgi Georgiev <georgi.georgiev@modusbox.com>
 - Henk Kodde <henk.kodde@modusbox.com>
 --------------
 ******/

const Metrics = require('@mojaloop/central-services-metrics')
const { Producer } = require('@mojaloop/central-services-stream').Util
const { Http, Events } = require('@mojaloop/central-services-shared').Enum
const { reformatFSPIOPError } = require('@mojaloop/central-services-error-handling').Factory
const EventFrameworkUtil = require('@mojaloop/central-services-shared').Util.EventFramework
const Enum = require('@mojaloop/central-services-shared').Enum

const util = require('../../lib/util')
const dto = require('../../lib/dto')

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
    const { config, payloadCache } = request.server.app
    const { kafkaConfig, isIsoApi, originalPayloadStorage, instrumentationMetricsDisabled } = config
    const isFX = util.isFxRequest(request.headers)

    const histTimerEnd = Metrics.getHistogram(
      isFX ? 'fxQuotes_id_get' : 'quotes_id_get',
      isFX ? 'Publish HTTP GET /fxQuotes/{ID} request' : 'Publish HTTP GET /quotes/{id} request',
      ['success']
    ).startTimer()
    let step

    try {
      const type = isFX ? Events.Event.Type.FX_QUOTE : Events.Event.Type.QUOTE

      step = 'messageFromRequestDto-1'
      const message = await dto.messageFromRequestDto({
        request,
        type,
        action: Events.Event.Action.GET,
        isIsoApi,
        originalPayloadStorage,
        payloadCache
      })

      let contentSpecificTags = {}
      if (isFX) {
        contentSpecificTags = {
          conversionRequestId: request.params.id
        }
      } else {
        contentSpecificTags = {
          quoteId: request.params.id
        }
      }
      const queryTags = EventFrameworkUtil.Tags.getQueryTags(
        Enum.Tags.QueryTags.serviceName.quotingService,
        Enum.Tags.QueryTags.auditType.transactionFlow,
        Enum.Tags.QueryTags.contentType.httpRequest,
        isFX ? Enum.Tags.QueryTags.operation.getFxQuotesByID : Enum.Tags.QueryTags.operation.getQuotesByID,
        {
          httpMethod: request.method,
          httpPath: request.path,
          ...contentSpecificTags
        }
      )
      await util.auditSpan(request, queryTags)

      const producerConfig = isFX ? kafkaConfig.PRODUCER.FX_QUOTE.GET : kafkaConfig.PRODUCER.QUOTE.GET
      const topicConfig = dto.topicConfigDto({ topicName: producerConfig.topic })
      step = 'produceMessage-2'
      await Producer.produceMessage(message, topicConfig, producerConfig.config)

      histTimerEnd({ success: true })
      return h.response().code(Http.ReturnCodes.ACCEPTED.CODE)
    } catch (err) {
      histTimerEnd({ success: false })
      if (!instrumentationMetricsDisabled) {
        util.rethrowAndCountFspiopError(err, { operation: 'getQuotesById', step })
      }
      throw reformatFSPIOPError(err)
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
    const { config, payloadCache } = request.server.app
    const { kafkaConfig, isIsoApi, originalPayloadStorage, instrumentationMetricsDisabled } = config

    const isFX = util.isFxRequest(request.headers)
    const isError = request.path?.endsWith('/error')

    let metricsId = isFX ? 'fxQuotes_id_put' : 'quotes_id_put'
    metricsId = isError ? `${metricsId}_error` : metricsId

    const pathSuffix = isError ? '/error' : ''

    const histTimerEnd = Metrics.getHistogram(
      metricsId,
      isFX ? `Publish HTTP PUT /fxQuotes/{id}${pathSuffix} request` : `Publish HTTP PUT /quotes/{id}${pathSuffix} request`,
      ['success']
    ).startTimer()
    let step

    try {
      const type = isFX ? Events.Event.Type.FX_QUOTE : Events.Event.Type.QUOTE

      const message = await dto.messageFromRequestDto({
        request,
        type,
        action: Events.Event.Action.PUT,
        isIsoApi,
        originalPayloadStorage,
        payloadCache
      })

      let contentSpecificTags = {}
      let operation
      if (isError) {
        operation = isFX ? Enum.Tags.QueryTags.operation.putFxQuotesErrorByID : Enum.Tags.QueryTags.operation.putQuotesErrorByID
      } else {
        if (isFX) {
          contentSpecificTags = {
            conversionRequestId: message.content.payload.conversionRequestId,
            conversionId: message.content.payload.conversionTerms.conversionId,
            transactionId: message.content.payload.conversionTerms.determiningTransferId,
            determiningTransferId: message.content.payload.conversionTerms.determiningTransferId
          }
          operation = Enum.Tags.QueryTags.operation.putFxQuotesByID
        } else {
          contentSpecificTags = {
            quoteId: request.params.id
          }
          operation = Enum.Tags.QueryTags.operation.putQuotesByID
        }
      }
      const queryTags = EventFrameworkUtil.Tags.getQueryTags(
        Enum.Tags.QueryTags.serviceName.quotingService,
        Enum.Tags.QueryTags.auditType.transactionFlow,
        Enum.Tags.QueryTags.contentType.httpRequest,
        operation,
        {
          httpMethod: request.method,
          httpPath: request.path,
          ...contentSpecificTags
        }
      )
      await util.auditSpan(request, queryTags, { transformedPayload: message.content.payload })

      const producerConfig = isFX ? kafkaConfig.PRODUCER.FX_QUOTE.PUT : kafkaConfig.PRODUCER.QUOTE.PUT
      const topicConfig = dto.topicConfigDto({ topicName: producerConfig.topic })
      await Producer.produceMessage(message, topicConfig, producerConfig.config)

      histTimerEnd({ success: true })
      return h.response().code(Http.ReturnCodes.OK.CODE)
    } catch (err) {
      histTimerEnd({ success: false })
      if (!instrumentationMetricsDisabled) {
        util.rethrowAndCountFspiopError(err, { operation: 'putQuotesById', step })
      }
      throw reformatFSPIOPError(err)
    }
  }
}
