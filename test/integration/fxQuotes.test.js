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

const uuid = require('crypto').randomUUID
const { Producer } = require('@mojaloop/central-services-stream').Util
const { createProxyClient } = require('../../src/lib/proxy')
const Config = require('../../src/lib/config')
const MockServerClient = require('./mockHttpServer/MockServerClient')
const dto = require('../../src/lib/dto')
const mocks = require('../mocks')

const TEST_TIMEOUT = 20_000
const WAIT_TIMEOUT = 3_000

const hubClient = new MockServerClient()
const base64Encode = (data) => Buffer.from(data).toString('base64')
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms))

describe('POST /fxQuotes request tests --> ', () => {
  jest.setTimeout(TEST_TIMEOUT)

  const { kafkaConfig, proxyCache, hubName } = new Config()

  beforeEach(async () => {
    await hubClient.clearHistory()
  })

  afterAll(async () => {
    await Producer.disconnect()
  })
  /**
   * Produces a POST /fxQuotes message for a dfsp that is not registered in the hub
   */
  test('should POST /fxQuotes (proxied)', async () => {
    let response = await hubClient.getHistory()
    expect(response.data.history.length).toBe(0)

    const from = 'pinkbank'
    const to = 'redbank' // redbank not in the hub db
    const proxyId = 'redbankproxy'
    let proxyClient

    try {
      proxyClient = createProxyClient({ proxyCacheConfig: proxyCache, logger: console })

      // register proxy representative for redbank
      const isAdded = await proxyClient.addDfspIdToProxyMapping(to, proxyId)

      // assert that the proxy representative is mapped in the cache
      const key = `dfsp:${to}`
      const proxy = await proxyClient.redisClient.get(key)
      expect(isAdded).toBe(true)
      expect(proxy).toBe(proxyId)

      const payload = mocks.fxQuotesPostPayloadDto({
        initiatingFsp: from,
        counterPartyFsp: to
      })
      const message = mocks.kafkaMessagePayloadPostDto({ from, to, id: payload.conversionRequestId, payloadBase64: base64Encode(JSON.stringify(payload)) })
      const { topic, config } = kafkaConfig.PRODUCER.FX_QUOTE.POST
      const topicConfig = dto.topicConfigDto({ topicName: topic })
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
   * Produces a PUT /fxQuotes/{ID} callback from a proxied payee
   * Expects a PUT /fxQuotes/{ID} callback at the payer's endpoint
   */
  test('should PUT /fxQuotes/{ID} callback (proxied)', async () => {
    let response = await hubClient.getHistory()
    expect(response.data.history.length).toBe(0)

    const from = 'redbank'
    const to = 'pinkbank'
    const proxyId = 'redbankproxy'
    let proxyClient

    try {
      proxyClient = createProxyClient({ proxyCacheConfig: proxyCache, logger: console })

      // register proxy representative for redbank
      const isAdded = await proxyClient.addDfspIdToProxyMapping(from, proxyId)

      // assert that the proxy representative is mapped in the cache
      const key = `dfsp:${from}`
      const proxy = await proxyClient.redisClient.get(key)
      expect(isAdded).toBe(true)
      expect(proxy).toBe(proxyId)

      const payload = mocks.fxQuotesPutPayloadDto({
        fxQuotesPostPayload: mocks.fxQuotesPostPayloadDto({ initiatingFsp: to, counterPartyFsp: from })
      })
      const message = mocks.kafkaMessageFxPayloadPutDto({ from, to, id: payload.conversionRequestId, payloadBase64: base64Encode(JSON.stringify(payload)) })
      const { topic, config } = kafkaConfig.PRODUCER.FX_QUOTE.PUT
      const topicConfig = dto.topicConfigDto({ topicName: topic })

      const isOk = await Producer.produceMessage(message, topicConfig, config)
      expect(isOk).toBe(true)

      await wait(WAIT_TIMEOUT)

      response = await hubClient.getHistory()
      expect(response.data.history.length).toBe(1)

      // assert that the callback was received by the payer dfsp
      const request = response.data.history[0]
      expect(request.url).toBe(`/${to}/fxQuotes/${payload.conversionRequestId}`)
      expect(request.body).toEqual(payload)
      expect(request.headers['fspiop-source']).toBe(from)
      expect(request.headers['fspiop-destination']).toBe(to)
    } finally {
      await proxyClient.disconnect()
    }
  })

  /**
   * Produces a POST /fxQuotes message for a dfsp that is registered in the hub
   * Expects a POST /fxQuotes request at the payee dfsp's endpoint
   */
  test('should POST fx quote (no proxy)', async () => {
    let response = await hubClient.getHistory()
    expect(response.data.history.length).toBe(0)

    const from = 'pinkbank'
    const to = 'greenbank'
    const payload = mocks.fxQuotesPostPayloadDto({
      initiatingFsp: from,
      counterPartyFsp: to
    })
    const message = mocks.kafkaMessagePayloadPostDto({ from, to, id: payload.conversionRequestId, payloadBase64: base64Encode(JSON.stringify(payload)) })
    const { topic, config } = kafkaConfig.PRODUCER.FX_QUOTE.POST
    const topicConfig = dto.topicConfigDto({ topicName: topic })

    const isOk = await Producer.produceMessage(message, topicConfig, config)
    expect(isOk).toBe(true)

    await wait(WAIT_TIMEOUT)

    response = await hubClient.getHistory()
    expect(response.data.history.length).toBe(1)

    // assert that the request was received by the payee dfsp
    const request = response.data.history[0]
    expect(request.url).toBe(`/${to}/fxQuotes`)
    expect(request.body).toEqual(payload)
    expect(request.headers['fspiop-source']).toBe(from)
    expect(request.headers['fspiop-destination']).toBe(to)
  })

  /**
   * Produces a PUT /fxQuotes/{ID} callback for a dfsp that is registered in the hub
   * Expects a PUT /fxQuotes/{ID} callback at the payer dfsp's endpoint
   */
  test('should PUT fx quote callback (no proxy)', async () => {
    let response = await hubClient.getHistory()
    expect(response.data.history.length).toBe(0)

    const from = 'greenbank'
    const to = 'pinkbank'
    const payload = mocks.fxQuotesPutPayloadDto({
      fxQuotesPostPayload: mocks.fxQuotesPostPayloadDto({ initiatingFsp: to, counterPartyFsp: from })
    })
    const message = mocks.kafkaMessageFxPayloadPutDto({ from, to, id: payload.conversionRequestId, payloadBase64: base64Encode(JSON.stringify(payload)) })
    const { topic, config } = kafkaConfig.PRODUCER.FX_QUOTE.PUT
    const topicConfig = dto.topicConfigDto({ topicName: topic })

    const isOk = await Producer.produceMessage(message, topicConfig, config)
    expect(isOk).toBe(true)

    await wait(WAIT_TIMEOUT)

    response = await hubClient.getHistory()
    expect(response.data.history.length).toBe(1)

    // assert that the callback was received by the payee dfsp
    const request = response.data.history[0]
    expect(request.url).toBe(`/${to}/fxQuotes/${payload.conversionRequestId}`)
    expect(request.body).toEqual(payload)
    expect(request.headers['fspiop-source']).toBe(from)
    expect(request.headers['fspiop-destination']).toBe(to)
  })

  /**
   * Produces a POST /fxQuotes request for an invalid dfsp
   * Expects a PUT /fxQuotes/{ID} callback with an error at the sender's endpoint
   */
  test('should POST fx quote to invalid participant', async () => {
    let response = await hubClient.getHistory()
    expect(response.data.history.length).toBe(0)

    const from = 'pinkbank'
    const to = 'invalidbank'
    const payload = mocks.fxQuotesPostPayloadDto({
      initiatingFsp: from,
      counterPartyFsp: to
    })
    const message = mocks.kafkaMessagePayloadPostDto({ from, to, id: payload.conversionRequestId, payloadBase64: base64Encode(JSON.stringify(payload)) })
    const { topic, config } = kafkaConfig.PRODUCER.FX_QUOTE.POST
    const topicConfig = dto.topicConfigDto({ topicName: topic })

    const isOk = await Producer.produceMessage(message, topicConfig, config)
    expect(isOk).toBe(true)

    await wait(WAIT_TIMEOUT)

    response = await hubClient.getHistory()
    expect(response.data.history.length).toBe(1)

    // assert that error callback was received by the payer dfsp
    const request = response.data.history[0]
    expect(request.url).toBe(`/${from}/fxQuotes/${payload.conversionRequestId}/error`)
    expect(request.body.errorInformation.errorCode).toBe('3100')
    expect(request.body.errorInformation.errorDescription).toBe(`Generic validation error - Unsupported participant '${to}'`)
    expect(request.headers['fspiop-source']).toBe(hubName)
    expect(request.headers['fspiop-destination']).toBe(from)
  })

  /**
   * Produces a PUT /fxQuotes/{ID} callback with an error for a dfsp that is registered in the hub
   * Expects a PUT /fxQuotes/{ID} callback with an error at the receiver's endpoint
   */
  test('should PUT /fxQuotes/{ID}/error (no proxy)', async () => {
    let response = await hubClient.getHistory()
    expect(response.data.history.length).toBe(0)

    const from = 'greenbank'
    const to = 'pinkbank'
    const conversionRequestId = uuid()
    const payload = {
      errorInformation: {
        errorCode: '3100',
        errorDescription: 'Generic validation error'
      }
    }
    const message = mocks.kafkaMessageFxPayloadPutDto({ from, to, id: conversionRequestId, payloadBase64: base64Encode(JSON.stringify(payload)) })
    const { topic, config } = kafkaConfig.PRODUCER.FX_QUOTE.PUT
    const topicConfig = dto.topicConfigDto({ topicName: topic })

    const isOk = await Producer.produceMessage(message, topicConfig, config)
    expect(isOk).toBe(true)

    await wait(WAIT_TIMEOUT)

    response = await hubClient.getHistory()
    expect(response.data.history.length).toBe(1)

    // assert that the error callback was received by the payer dfsp
    const request = response.data.history[0]
    expect(request.url).toBe(`/${to}/fxQuotes/${conversionRequestId}/error`)
    expect(request.body.errorInformation.errorCode).toBe('3100')
    expect(request.body.errorInformation.errorDescription).toBe('Generic validation error')
    expect(request.headers['fspiop-source']).toBe(from)
    expect(request.headers['fspiop-destination']).toBe(to)
  })

  /**
   * Produces a PUT /fxQuotes/{ID}/error for a proxied dfsp
   * Expects a PUT /fxQuotes/{ID}/error callback with an error at the proxy's endpoint
   */
  test('should PUT /fxQuotes/{ID}/error (proxied)', async () => {
    let response = await hubClient.getHistory()
    expect(response.data.history.length).toBe(0)

    const from = 'pinkbank'
    const to = 'redbank'
    const proxyId = 'redbankproxy'
    let proxyClient

    try {
      proxyClient = createProxyClient({ proxyCacheConfig: proxyCache, logger: console })

      // register proxy representative for redbank
      const isAdded = await proxyClient.addDfspIdToProxyMapping(to, proxyId)

      // assert that the proxy representative is mapped in the cache
      const key = `dfsp:${to}`
      const proxy = await proxyClient.redisClient.get(key)
      expect(isAdded).toBe(true)
      expect(proxy).toBe(proxyId)

      const conversionRequestId = uuid()
      const payload = {
        errorInformation: {
          errorCode: '3100',
          errorDescription: 'Generic validation error'
        }
      }
      const message = mocks.kafkaMessageFxPayloadPutDto({ from, to, id: conversionRequestId, payloadBase64: base64Encode(JSON.stringify(payload)) })
      const { topic, config } = kafkaConfig.PRODUCER.FX_QUOTE.PUT
      const topicConfig = dto.topicConfigDto({ topicName: topic })

      const isOk = await Producer.produceMessage(message, topicConfig, config)
      expect(isOk).toBe(true)

      await wait(WAIT_TIMEOUT)

      response = await hubClient.getHistory()
      expect(response.data.history.length).toBe(1)

      // assert that the error callback was received by the proxy
      const request = response.data.history[0]
      expect(request.url).toBe(`/${proxyId}/fxQuotes/${conversionRequestId}/error`)
      expect(request.body.errorInformation.errorCode).toBe('3100')
      expect(request.body.errorInformation.errorDescription).toBe('Generic validation error')
      expect(request.headers['fspiop-source']).toBe(from)
      expect(request.headers['fspiop-destination']).toBe(to)
    } finally {
      await proxyClient.disconnect()
    }
  })

  /**
   * Produces a GET /fxQuotes request for a dfsp that is registered in the hub
   * Expects a PUT /fxQuotes/{ID} callback at the requester's endpoint
   */
  test.only('should GET fx quote (no proxy)', async () => {
    let response = await hubClient.getHistory()
    expect(response.data.history.length).toBe(0)

    const from = 'pinkbank'
    const to = 'greenbank'
    const conversionRequestId = uuid()
    const payload = mocks.fxQuotesPutPayloadDto({
      fxQuotesPostPayload: mocks.fxQuotesPostPayloadDto({ initiatingFsp: from, counterPartyFsp: to })
    })
    const message = mocks.kafkaMessageFxPayloadPutDto({ from, to, id: conversionRequestId, payloadBase64: base64Encode(JSON.stringify(payload)) })
    const { topic, config } = kafkaConfig.PRODUCER.FX_QUOTE.PUT
    const topicConfig = dto.topicConfigDto({ topicName: topic })

    const isOk = await Producer.produceMessage(message, topicConfig, config)
    expect(isOk).toBe(true)

    await wait(WAIT_TIMEOUT)

    response = await hubClient.getHistory()
    expect(response.data.history.length).toBe(1)

    // assert that the callback was received by the requester dfsp
    const request = response.data.history[0]
    expect(request.url).toBe(`/${from}/fxQuotes/${conversionRequestId}`)
    expect(request.body).toEqual(payload)
    expect(request.headers['fspiop-source']).toBe(from)
    expect(request.headers['fspiop-destination']).toBe(to)
  })

  /**
    * Test cases to cover:
    * + POST fx quote (no proxy) --> PUT fx callback (no proxy)
    * + POST fx quote (no proxy) to invalid participant --> Expect put callback error at the sender's endpoint
    * - POST quotes (no proxy) --> PUT quotes (no proxy) --> Expect callback received at the sender's endpoint

    * + POST fx quote (proxy) --> PUT fx callback (proxy)
    * - POST quotes (proxy) --> PUT quotes (proxy) --> Expect end to end success of fx quote and final quote
    *
    * ! POST fx quote to invalid participant (proxy) --> Expect put callback error at the proxy endpoint

    * + PUT fx quote error (no proxy) --> Expect error callback at the receiver's endpoint
    * + PUT fx quote error (proxy) --> Expect error callback at the proxy endpoint
    *
    * - GET fx quote (no proxy) --> PUT fx callback (no proxy) --> Expect callback received at the sender's endpoint
    * - GET fx quote (proxy) --> PUT fx callback (proxy) --> Expect callback received at the proxy endpoint
    *
    * - GET fx quote - invalid conversionRequestId --> Expect error callback at the sender's endpoint
    *
    */
})
