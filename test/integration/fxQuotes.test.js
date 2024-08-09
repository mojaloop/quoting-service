/*****
 License
 --------------
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

 * Steven Oderayi <steven.oderayi@infitx.com>
 --------------
 ******/

const { Producer } = require('@mojaloop/central-services-stream').Util
const { createProxyClient } = require('../../src/lib/proxy')
const Config = require('../../src/lib/config')
const dto = require('../../src/lib/dto')
const mocks = require('../mocks')
const MockServerClient = require('./mockHttpServer/MockServerClient')
const uuid = require('crypto').randomUUID

const TEST_TIMEOUT = 20_000
const WAIT_TIMEOUT = 3_000

const hubClient = new MockServerClient()

const base64Encode = (data) => Buffer.from(data).toString('base64')
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms))

describe('POST request tests --> ', () => {
  jest.setTimeout(TEST_TIMEOUT)

  const { kafkaConfig, proxyCache } = new Config()

  beforeEach(async () => {
    await hubClient.clearHistory()
  })

  afterAll(async () => {
    await Producer.disconnect()
  })

  test('should forward POST /fxQuotes request to proxy if the payee dfsp is not registered in the hub', async () => {
    let response = await hubClient.getHistory()
    expect(response.data.history.length).toBe(0)

    const { topic, config } = kafkaConfig.PRODUCER.FX_QUOTE.POST
    const topicConfig = dto.topicConfigDto({ topicName: topic })
    const from = 'pinkbank'
    const to = 'redbank' // redbank not in the hub db
    const proxyId = 'redbankproxy'
    let proxyClient

    try {
      proxyClient = await createProxyClient({ proxyCacheConfig: proxyCache, logger: console })

      // register proxy representative for redbank
      const isAdded = await proxyClient.addDfspIdToProxyMapping(to, proxyId)

      // assert that the proxy representative is mapped in the cache
      const key = `dfsp:${to}`
      const representative = await proxyClient.redisClient.get(key)
      expect(isAdded).toBe(true)
      expect(representative).toBe(proxyId)

      const payload = {
        conversionRequestId: uuid(),
        conversionTerms: {
          conversionId: uuid(),
          initiatingFsp: from,
          counterPartyFsp: to,
          amountType: 'SEND',
          sourceAmount: {
            currency: 'USD',
            amount: 300
          },
          targetAmount: {
            currency: 'TZS'
          }
        }
      }
      const message = mocks.kafkaMessagePayloadPostDto({ from, to, id: payload.conversionRequestId, payloadBase64: base64Encode(JSON.stringify(payload)) })
      const isOk = await Producer.produceMessage(message, topicConfig, config)
      expect(isOk).toBe(true)

      await wait(WAIT_TIMEOUT)

      response = await hubClient.getHistory()
      expect(response.data.history.length).toBe(1)

      // assert that the request was received by the proxy
      const request = response.data.history[0]
      expect(request.url).toBe(`/${proxyId}/fxQuotes`)
      expect(request.body).toEqual(payload)
      expect(request.headers['fspiop-source']).toBe(from)
      expect(request.headers['fspiop-destination']).toBe(to)
    } finally {
      await proxyClient.disconnect()
    }
  })

  /**
    * Test cases to cover:
    * - POST fx quote (no proxy) --> PUT fx callback (no proxy)
    * - POST fx quote (no proxy) to invalid participant --> Expect put callback error at the sender's endpoint
    * - POST quotes (no proxy) --> PUT quotes (no proxy) --> Expect callback received at the sender's endpoint

    * - POST fx quote (proxy) --> PUT fx callback (proxy)
    * - POST quotes (proxy) --> PUT quotes (proxy) --> Expect end to end success of fx quote and final quote
    *
    * - POST fx quote to invalid participant (no proxy) --> Expect put callback error at the sender's endpoint
    * - POST fx quote to invalid participant (proxy) --> Expect put callback error at the proxy endpoint
    *
    * - GET fx quote (no proxy) --> PUT fx callback (no proxy) --> Expect callback received at the sender's endpoint
    * - GET fx quote (proxy) --> PUT fx callback (proxy) --> Expect callback received at the proxy endpoint
    *
    * - GET fx quote - invalid conversionRequestId --> Expect error callback at the sender's endpoint
    *
    * - PUT fx quote error (no proxy) --> Expect error callback at the receiver's endpoint
    * - PUT fx quote error (proxy) --> Expect error callback at the proxy endpoint
    */
})
