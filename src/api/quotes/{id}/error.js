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

const util = require('../../../lib/util')
const Config = require('../../../lib/config')
const dto = require('../../../lib/dto')

const { kafkaConfig } = new Config()

/**
 * Operations on /quotes/{id}/error
 */
module.exports = {
  /**
     * summary: QuotesByIdAndError
     * description: If the server is unable to find or create a quote, or some other processing error occurs, the error callback PUT /quotes/&lt;id&gt;/error is used. The &lt;id&gt; in the URI should contain the quoteId that was used for the creation of the quote, or the &lt;id&gt; that was used in the GET /quotes/&lt;id&gt;.
     * parameters: id, body, Content-Length, Content-Type, Date, X-Forwarded-For, FSPIOP-Source, FSPIOP-Destination, FSPIOP-Encryption, FSPIOP-Signature, FSPIOP-URI, FSPIOP-HTTP-Method
     * produces: application/json
     * responses: 200, 400, 401, 403, 404, 405, 406, 501, 503
     */
  put: async function QuotesByIdAndError (context, request, h) {
    // the same as PUT /quotes
    const histTimerEnd = Metrics.getHistogram(
      'quotes_id_put_error',
      'Publish HTTP PUT /quotes/{id}/error request',
      ['success']
    ).startTimer()

    try {
      await util.auditSpan(request)

      const { topic, config } = kafkaConfig.PRODUCER.QUOTE.PUT
      const topicConfig = dto.topicConfigDto({ topicName: topic })
      const message = dto.messageFromRequestDto(request, Events.Event.Type.QUOTE, Events.Event.Action.PUT)

      await Producer.produceMessage(message, topicConfig, config)

      histTimerEnd({ success: true })
      return h.response().code(Http.ReturnCodes.OK.CODE)
    } catch (err) {
      histTimerEnd({ success: false })
      util.rethrowFspiopError(err)
    }
  }
}
