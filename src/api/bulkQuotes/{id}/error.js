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

 * Henk Kodde <henk.kodde@modusbox.com>
 * Georgi Georgiev <georgi.georgiev@modusbox.com>
 --------------
 ******/

const Metrics = require('@mojaloop/central-services-metrics')
const { Producer } = require('@mojaloop/central-services-stream').Util
const { Http, Events } = require('@mojaloop/central-services-shared').Enum
const { reformatFSPIOPError } = require('@mojaloop/central-services-error-handling').Factory
const EventFrameworkUtil = require('@mojaloop/central-services-shared').Util.EventFramework
const Enum = require('@mojaloop/central-services-shared').Enum

const Config = require('../../../lib/config')
const dto = require('../../../lib/dto')
const util = require('../../../lib/util')

/**
 * Operations on /bulkQuotes/{id}/error
 */
module.exports = {
  /**
     * summary: BulkQuotesErrorById
     * description: If the server is unable to find or create a bulk quote, or another processing error occurs, the error callback PUT /bulkQuotes/&lt;id&gt;/error is used. The &lt;id&gt; in the URI should contain the bulkQuoteId that was used for the creation of the bulk quote, or the &lt;id&gt; that was used in the GET /bulkQuotes/&lt;id&gt;.
     * parameters: id, body, Content-Length, Content-Type, Date, X-Forwarded-For, FSPIOP-Source, FSPIOP-Destination, FSPIOP-Encryption, FSPIOP-Signature, FSPIOP-URI, FSPIOP-HTTP-Method
     * produces: application/json
     * responses: 200, 400, 401, 403, 404, 405, 406, 501, 503
     */
  put: async function BulkQuotesErrorById (context, request, h) {
    // the same as PUT /bulkQuotes
    const histTimerEnd = Metrics.getHistogram(
      'bulkQuotes_id_put_error',
      'Process HTTP PUT /bulkQuotes/{id}/error request',
      ['success']
    ).startTimer()
    let step

    const { kafkaConfig, instrumentationMetricsDisabled } = new Config()

    try {
      const { path, method } = request
      const queryTags = EventFrameworkUtil.Tags.getQueryTags(
        Enum.Tags.QueryTags.serviceName.quotingService,
        Enum.Tags.QueryTags.auditType.transactionFlow,
        Enum.Tags.QueryTags.contentType.httpRequest,
        Enum.Tags.QueryTags.operation.putBulkQuotesErrorByID,
        {
          httpMethod: method,
          httpPath: path
        }
      )
      await util.auditSpan(request, queryTags)

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
        util.rethrowAndCountFspiopError(err, { operation: 'putBulkQuotesByIdError', step })
      }
      throw reformatFSPIOPError(err)
    }
  }
}
