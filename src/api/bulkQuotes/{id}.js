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

 * Henk Kodde <henk.kodde@modusbox.com>
 * Georgi Georgiev <georgi.georgiev@modusbox.com>
 --------------
 ******/

const Metrics = require('@mojaloop/central-services-metrics')
const { Producer } = require('@mojaloop/central-services-stream').Util
const { Http, Events } = require('@mojaloop/central-services-shared').Enum

const util = require('../../lib/util')
const Config = require('../../lib/config')
const dto = require('../../lib/dto')

const { kafkaConfig, instrumentationMetricsDisabled } = new Config()

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
      'bulkQuotes_id_get',
      'Publish HTTP GET /bulkQuotes/{id} request',
      ['success']
    ).startTimer()
    let step

    try {
      await util.auditSpan(request)

      const { topic, config } = kafkaConfig.PRODUCER.BULK_QUOTE.GET
      const topicConfig = dto.topicConfigDto({ topicName: topic })
      step = 'messageFromRequestDto-1'
      const message = await dto.messageFromRequestDto({
        request,
        type: Events.Event.Type.BULK_QUOTE,
        action: Events.Event.Action.GET
      })
      step = 'produceMessage-2'
      await Producer.produceMessage(message, topicConfig, config)

      histTimerEnd({ success: true })
      return h.response().code(Http.ReturnCodes.ACCEPTED.CODE)
    } catch (err) {
      histTimerEnd({ success: false })
      if (!instrumentationMetricsDisabled) {
        util.rethrowAndCountFspiopError(err, { operation: 'getBulkQuotesById', step })
      }
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
      'bulkQuotes_id_put',
      'Publish HTTP PUT /bulkQuotes/{id} request',
      ['success']
    ).startTimer()
    let step

    try {
      await util.auditSpan(request)

      const { topic, config } = kafkaConfig.PRODUCER.BULK_QUOTE.PUT
      const topicConfig = dto.topicConfigDto({ topicName: topic })
      step = 'messageFromRequestDto-1'
      const message = await dto.messageFromRequestDto({
        request,
        type: Events.Event.Type.BULK_QUOTE,
        action: Events.Event.Action.PUT
      })
      step = 'produceMessage-2'
      await Producer.produceMessage(message, topicConfig, config)

      histTimerEnd({ success: true })
      return h.response().code(Http.ReturnCodes.OK.CODE)
    } catch (err) {
      histTimerEnd({ success: false })
      if (!instrumentationMetricsDisabled) {
        util.rethrowAndCountFspiopError(err, { operation: 'putBulkQuotesById', step })
      }
    }
  }
}
