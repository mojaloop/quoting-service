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

const util = require('../lib/util')
const Config = require('../lib/config')
const dto = require('../lib/dto')

const { kafkaConfig } = new Config()

/**
 * Operations on /quotes
 */
module.exports = {
  /**
     * summary: Quotes
     * description:
     *  - The HTTP request POST /quotes is used to request the creation of a quote for the provided financial transaction in the server.
     *  - The HTTP request `POST /fxQuotes` is used to ask an FXP to provide a quotation for a currency conversion.
     * parameters: body, Accept, Content-Length, Content-Type, Date, X-Forwarded-For, FSPIOP-Source, FSPIOP-Destination, FSPIOP-Encryption, FSPIOP-Signature, FSPIOP-URI, FSPIOP-HTTP-Method
     * produces: application/json
     * responses: 202, 400, 401, 403, 404, 405, 406, 501, 503
     */
  post: async function Quotes (context, request, h) {
    const isFX = !!request.payload.conversionRequestId

    const histTimerEnd = Metrics.getHistogram(
      isFX ? 'fxQuotes_post' : 'quotes_post',
      isFX ? 'Publish HTTP POST fxQuotes request' : 'Publish HTTP POST quotes request',
      ['success']
    ).startTimer()

    try {
      await util.auditSpan(request)

      const eventType = isFX ? Events.Event.Type.FX_QUOTE : Events.Event.Type.QUOTE
      const producerConfig = isFX ? kafkaConfig.PRODUCER.FX_QUOTE.POST : kafkaConfig.PRODUCER.QUOTE.POST

      const { topic, config } = producerConfig
      const topicConfig = dto.topicConfigDto({ topicName: topic })
      const message = await dto.messageFromRequestDto(request, eventType, Events.Event.Action.POST)

      await Producer.produceMessage(message, topicConfig, config)

      histTimerEnd({ success: true })
      return h.response().code(Http.ReturnCodes.ACCEPTED.CODE)
    } catch (err) {
      histTimerEnd({ success: false })
      util.rethrowFspiopError(err)
    }
  }
}
