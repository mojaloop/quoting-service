/*****
# LICENSE

Copyright © 2020 Mojaloop Foundation

The Mojaloop files are made available by the Mojaloop Foundation under the Apache License, Version 2.0
(the "License") and you may not use these files except in compliance with the [License](http://www.apache.org/licenses/LICENSE-2.0).

You may obtain a copy of the License at [http://www.apache.org/licenses/LICENSE-2.0](http://www.apache.org/licenses/LICENSE-2.0)

Unless required by applicable law or agreed to in writing, the Mojaloop files are distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the [License](http://www.apache.org/licenses/LICENSE-2.0).

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

* Infitx
- Steven Oderayi <steven.oderayi@infitx.com>
--------------
******/

const Metrics = require('@mojaloop/central-services-metrics')
const { Producer } = require('@mojaloop/central-services-stream').Util
const { Http, Events } = require('@mojaloop/central-services-shared').Enum

const util = require('../../lib/util')
const Config = require('../../lib/config')
const dto = require('../../lib/dto')

const { kafkaConfig } = new Config()

/**
 * Operations on /fxQuotes/{ID}
 */
module.exports = {
  /**
     * summary: Retrieve FX quote information
     * description: The HTTP request `GET /fxQuotes/{ID}` is used to request information regarding a request for quotation for a  currency conversion which the
        sender has previously issued. The `{ID}` in the URI should contain the `conversionRequestId` that was used for the creation of the quote.
     * parameters: ID, Accept, Content-Type, Date, X-Forwarded-For, FSPIOP-Source, FSPIOP-Destination, FSPIOP-Encryption, FSPIOP-Signature, FSPIOP-URI, FSPIOP-HTTP-Method
     * produces: application/json
     * responses: 202, 400, 401, 403, 404, 405, 406, 501, 503
     */
  get: async function getFXQuoteById (context, request, h) {
    const histTimerEnd = Metrics.getHistogram(
      'fxQuotes_id_get',
      'Publish HTTP GET /fxQuotes/{ID} request',
      ['success']
    ).startTimer()

    try {
      await util.auditSpan(request)

      const { topic, config } = kafkaConfig.PRODUCER.FX_QUOTE.GET
      const topicConfig = dto.topicConfigDto({ topicName: topic })
      const message = dto.messageFromRequestDto(request, Events.Event.Type.FX_QUOTE, Events.Event.Action.GET)

      await Producer.produceMessage(message, topicConfig, config)

      histTimerEnd({ success: true })
      return h.response().code(Http.ReturnCodes.ACCEPTED.CODE)
    } catch (err) {
      histTimerEnd({ success: false })
      util.rethrowFspiopError(err)
    }
  },
  /**
     * summary: putFXQuotesById
     * description: The callback PUT /fxQuotes/&lt;id&gt; is used to inform the client of a requested or created FX quote. The &lt;id&gt; in the URI should contain the fxQuoteId that was used for the creation of the FX quote, or the &lt;id&gt; that was used in the GET /fxQuotes/&lt;id&gt;.
     * parameters: body, Content-Length
     * produces: application/json
     * responses: 200, 400, 401, 403, 404, 405, 406, 501, 503
     */
  put: async function putFXQuoteById (context, request, h) {
    const histTimerEnd = Metrics.getHistogram(
      'fxQuotes_id_put',
      'Publish HTTP PUT /fxQuotes/{id} request',
      ['success']
    ).startTimer()

    try {
      await util.auditSpan(request)

      const { topic, config } = kafkaConfig.PRODUCER.FX_QUOTE.PUT
      const topicConfig = dto.topicConfigDto({ topicName: topic })
      const message = dto.messageFromRequestDto(request, Events.Event.Type.FX_QUOTE, Events.Event.Action.PUT)

      await Producer.produceMessage(message, topicConfig, config)

      histTimerEnd({ success: true })
      return h.response().code(Http.ReturnCodes.OK.CODE)
    } catch (err) {
      histTimerEnd({ success: false })
      util.rethrowFspiopError(err)
    }
  }
}
