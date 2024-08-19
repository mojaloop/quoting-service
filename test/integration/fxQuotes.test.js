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
const { wrapWithRetries } = require('../util/helper')

const TEST_TIMEOUT = 20_000

const hubClient = new MockServerClient()
const base64Encode = (data) => Buffer.from(data).toString('base64')

const retryDelay = process?.env?.TEST_INT_RETRY_DELAY || 1
const retryCount = process?.env?.TEST_INT_RETRY_COUNT || 20
const retryOpts = {
  retries: retryCount,
  minTimeout: retryDelay,
  maxTimeout: retryDelay
}
const wrapWithRetriesConf = {
  remainingRetries: retryOpts?.retries || 10, // default 10
  timeout: retryOpts?.maxTimeout || 2 // default 2
}

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

      response = await wrapWithRetries(() => hubClient.getHistory(),
        wrapWithRetriesConf.remainingRetries,
        wrapWithRetriesConf.timeout,
        (result) => result.data.history.length > 0
      )
      expect(response.data.history.length).toBe(1)

      // assert that the request was received by the proxy
      const request = response.data.history[0]
      expect(request.method).toBe('POST')
      expect(request.url).toBe(`/${proxyId}/fxQuotes`)
      expect(request.body).toEqual(payload)
      expect(request.headers['fspiop-source']).toBe(from)
      expect(request.headers['fspiop-destination']).toBe(to)
    } finally {
      await proxyClient.removeDfspIdFromProxyMapping(to)
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

      response = await wrapWithRetries(() => hubClient.getHistory(),
        wrapWithRetriesConf.remainingRetries,
        wrapWithRetriesConf.timeout,
        (result) => result.data.history.length > 0
      )
      expect(response.data.history.length).toBe(1)

      // assert that the callback was received by the payer dfsp
      const request = response.data.history[0]
      expect(request.method).toBe('PUT')
      expect(request.url).toBe(`/${to}/fxQuotes/${payload.conversionRequestId}`)
      expect(request.body).toEqual(payload)
      expect(request.headers['fspiop-source']).toBe(from)
      expect(request.headers['fspiop-destination']).toBe(to)
    } finally {
      await proxyClient.removeDfspIdFromProxyMapping(from)
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

    response = await wrapWithRetries(() => hubClient.getHistory(),
      wrapWithRetriesConf.remainingRetries,
      wrapWithRetriesConf.timeout,
      (result) => result.data.history.length > 0
    )
    expect(response.data.history.length).toBe(1)

    // assert that the request was received by the payee dfsp
    const request = response.data.history[0]
    expect(request.method).toBe('POST')
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

    response = await wrapWithRetries(() => hubClient.getHistory(),
      wrapWithRetriesConf.remainingRetries,
      wrapWithRetriesConf.timeout,
      (result) => result.data.history.length > 0
    )
    expect(response.data.history.length).toBe(1)

    // assert that the callback was received by the payee dfsp
    const request = response.data.history[0]
    expect(request.method).toBe('PUT')
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

    response = await wrapWithRetries(() => hubClient.getHistory(),
      wrapWithRetriesConf.remainingRetries,
      wrapWithRetriesConf.timeout,
      (result) => result.data.history.length > 0
    )
    expect(response.data.history.length).toBe(1)

    // assert that error callback was received by the payer dfsp
    const request = response.data.history[0]
    expect(request.method).toBe('PUT')
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

    response = await wrapWithRetries(() => hubClient.getHistory(),
      wrapWithRetriesConf.remainingRetries,
      wrapWithRetriesConf.timeout,
      (result) => result.data.history.length > 0
    )
    expect(response.data.history.length).toBe(1)

    // assert that the error callback was received by the payer dfsp
    const request = response.data.history[0]
    expect(request.method).toBe('PUT')
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

      response = await wrapWithRetries(() => hubClient.getHistory(),
        wrapWithRetriesConf.remainingRetries,
        wrapWithRetriesConf.timeout,
        (result) => result.data.history.length > 0
      )
      expect(response.data.history.length).toBe(1)

      // assert that the error callback was received by the proxy
      const request = response.data.history[0]
      expect(request.method).toBe('PUT')
      expect(request.url).toBe(`/${proxyId}/fxQuotes/${conversionRequestId}/error`)
      expect(request.body.errorInformation.errorCode).toBe('3100')
      expect(request.body.errorInformation.errorDescription).toBe('Generic validation error')
      expect(request.headers['fspiop-source']).toBe(from)
      expect(request.headers['fspiop-destination']).toBe(to)
    } finally {
      await proxyClient.removeDfspIdFromProxyMapping(to)
      await proxyClient.disconnect()
    }
  })

  /**
   * Produces a GET /fxQuotes/{ID} request for a dfsp that is registered in the hub
   * Expects a GET /fxQuotes/{ID} request at the destination's endpoint
   */
  test('should GET fx quote (no proxy)', async () => {
    let response = await hubClient.getHistory()
    expect(response.data.history.length).toBe(0)

    const from = 'pinkbank'
    const to = 'greenbank'
    const conversionRequestId = uuid()
    const message = mocks.kafkaMessageFxPayloadGetDto({ from, to, id: conversionRequestId })
    const { topic, config } = kafkaConfig.PRODUCER.FX_QUOTE.GET
    const topicConfig = dto.topicConfigDto({ topicName: topic })

    const isOk = await Producer.produceMessage(message, topicConfig, config)
    expect(isOk).toBe(true)

    response = await wrapWithRetries(() => hubClient.getHistory(),
      wrapWithRetriesConf.remainingRetries,
      wrapWithRetriesConf.timeout,
      (result) => result.data.history.length > 0
    )
    expect(response.data.history.length).toBe(1)

    // assert that the callback was received by the destination dfsp's endpoint
    const request = response.data.history[0]
    expect(request.method).toBe('GET')
    expect(request.url).toBe(`/${to}/fxQuotes/${conversionRequestId}`)
    expect(request.body).toBeUndefined()
    expect(request.headers['fspiop-source']).toBe(from)
    expect(request.headers['fspiop-destination']).toBe(to)
  })

  /**
   * Produces a GET /fxQuotes/{ID} for a proxied dfsp
   * Expects a GET /fxQuotes/{ID} request at the proxy's endpoint
   */
  test('should GET fx quote (proxied)', async () => {
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
      const message = mocks.kafkaMessageFxPayloadGetDto({ from, to, id: conversionRequestId })
      const { topic, config } = kafkaConfig.PRODUCER.FX_QUOTE.GET
      const topicConfig = dto.topicConfigDto({ topicName: topic })

      const isOk = await Producer.produceMessage(message, topicConfig, config)
      expect(isOk).toBe(true)

      response = await wrapWithRetries(() => hubClient.getHistory(),
        wrapWithRetriesConf.remainingRetries,
        wrapWithRetriesConf.timeout,
        (result) => result.data.history.length > 0
      )
      expect(response.data.history.length).toBe(1)

      // assert that the callback was received by the proxy
      const request = response.data.history[0]
      expect(request.method).toBe('GET')
      expect(request.url).toBe(`/${proxyId}/fxQuotes/${conversionRequestId}`)
      expect(request.body).toBeUndefined()
      expect(request.headers['fspiop-source']).toBe(from)
      expect(request.headers['fspiop-destination']).toBe(to)
    } finally {
      await proxyClient.removeDfspIdFromProxyMapping(to)
      await proxyClient.disconnect()
    }
  })
})
