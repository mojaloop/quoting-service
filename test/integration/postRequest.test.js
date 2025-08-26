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
 * Steven Oderayi <steven.oderayi@infitx.com>
 --------------
 ******/

const uuid = require('crypto').randomUUID
const { Producer } = require('@mojaloop/central-services-stream').Util
const { createProxyClient } = require('../../src/lib/proxy')
const Config = require('../../src/lib/config')
const dto = require('../../src/lib/dto')
const { wrapWithRetries } = require('../util/helper')
const Database = require('../../src/data/cachedDatabase')
const mocks = require('../mocks')
const MockServerClient = require('./mockHttpServer/MockServerClient')

jest.setTimeout(20_000)

describe('POST request tests --> ', () => {
  let db
  const config = new Config()
  const { kafkaConfig, proxyCache } = config
  const hubClient = new MockServerClient()
  const retryConf = {
    remainingRetries: process?.env?.TEST_INT_RETRY_COUNT || 20,
    timeout: process?.env?.TEST_INT_RETRY_DELAY || 1
  }

  beforeAll(async () => {
    db = new Database(config)
    await db.connect()
    const isDbOk = await db.isConnected()
    if (!isDbOk) throw new Error('DB is not connected')
  })

  beforeEach(async () => {
    await hubClient.clearHistory()
  })

  afterAll(async () => {
    await db?.disconnect()
    await Producer.disconnect()
  })

  const base64Encode = (data) => Buffer.from(data).toString('base64')

  const getResponseWithRetry = async () => {
    return wrapWithRetries(() => hubClient.getHistory(),
      retryConf.remainingRetries,
      retryConf.timeout,
      (result) => result.data.history.length > 0
    )
  }

  test('should pass validation for POST /quotes request if request amount currency is registered (position account exists) for the payer participant', async () => {
    let response = await hubClient.getHistory()
    expect(response.data.history.length).toBe(0)

    const { topic, config } = kafkaConfig.PRODUCER.QUOTE.POST
    const topicConfig = dto.topicConfigDto({ topicName: topic })
    const from = 'pinkbank'
    const to = 'greenbank'
    const payload = mocks.postQuotesPayloadDto({ from, to })
    const message = mocks.kafkaMessagePayloadPostDto({ from, to, id: payload.quoteId, payloadBase64: base64Encode(JSON.stringify(payload)) })
    const isOk = await Producer.produceMessage(message, topicConfig, config)
    expect(isOk).toBe(true)

    response = await getResponseWithRetry()

    expect(response.data.history.length).toBeGreaterThan(0)
    const { url } = response.data.history[0]
    expect(url).toBe(`/${message.to}/quotes`)
  })

  test('should pass validation for POST /quotes request if source and/or destination are proxied', async () => {
    let response = await hubClient.getHistory()
    expect(response.data.history.length).toBe(0)
    const from = 'pinkbank'
    const to = 'greenbank'
    let proxyClient
    try {
      proxyClient = createProxyClient({ proxyCacheConfig: proxyCache, logger: console })
      const { topic, config } = kafkaConfig.PRODUCER.QUOTE.POST
      const topicConfig = dto.topicConfigDto({ topicName: topic })

      const proxyId1 = 'proxyAR'
      const proxyId2 = 'proxyRB'
      await proxyClient.addDfspIdToProxyMapping(to, proxyId1)
      await proxyClient.addDfspIdToProxyMapping(from, proxyId2)
      const payload = mocks.postQuotesPayloadDto({ from, to })
      const message = mocks.kafkaMessagePayloadPostDto({ from, to, id: payload.quoteId, payloadBase64: base64Encode(JSON.stringify(payload)) })
      const isOk = await Producer.produceMessage(message, topicConfig, config)
      expect(isOk).toBe(true)

      response = await getResponseWithRetry()
      expect(response.data.history.length).toBe(1)

      const { url } = response.data.history[0]
      expect(url).toBe(`/${message.to}/quotes`)
    } finally {
      await proxyClient.removeDfspIdFromProxyMapping(to)
      await proxyClient.removeDfspIdFromProxyMapping(from)
      await proxyClient.disconnect()
    }
  })

  test('should fail validation for POST /quotes request if request amount currency is not registered (position account doesnt not exist) for the payer participant', async () => {
    let response = await hubClient.getHistory()
    expect(response.data.history.length).toBe(0)

    const { topic, config } = kafkaConfig.PRODUCER.QUOTE.POST
    const topicConfig = dto.topicConfigDto({ topicName: topic })
    const from = 'pinkbank'
    const to = 'greenbank'
    const payload = mocks.postQuotesPayloadDto({ from, to, amount: { amount: '100', currency: 'GBP' } })
    const message = mocks.kafkaMessagePayloadPostDto({ from, to, id: payload.quoteId, payloadBase64: base64Encode(JSON.stringify(payload)) })
    const isOk = await Producer.produceMessage(message, topicConfig, config)
    expect(isOk).toBe(true)

    response = await getResponseWithRetry()
    expect(response.data.history.length).toBe(1)

    const { url, body } = response.data.history[0]
    expect(url).toBe(`/${message.from}/quotes/${message.id}/error`)
    expect(body.errorInformation.errorCode).toBe('3201')
    expect(body.errorInformation.errorDescription).toBe(`Destination FSP Error - Unsupported participant '${message.to}'`)
  })

  test('should pass validation for POST /quotes request if all request "supportedCurrencies" are registered (position account exists) for the payer participant', async () => {
    let response = await hubClient.getHistory()
    expect(response.data.history.length).toBe(0)

    const { topic, config } = kafkaConfig.PRODUCER.QUOTE.POST
    const topicConfig = dto.topicConfigDto({ topicName: topic })
    const from = 'pinkbank'
    const to = 'greenbank'
    const payload = mocks.postQuotesPayloadDto({
      from,
      to,
      payer: { partyIdInfo: { partyIdType: 'MSISDN', partyIdentifier: '987654321', fspId: from }, supportedCurrencies: ['USD', 'ZMW'] }
    })
    const message = mocks.kafkaMessagePayloadPostDto({ from, to, id: payload.quoteId, payloadBase64: base64Encode(JSON.stringify(payload)) })
    const isOk = await Producer.produceMessage(message, topicConfig, config)
    expect(isOk).toBe(true)

    response = await getResponseWithRetry()
    expect(response.data.history.length).toBeGreaterThanOrEqual(1)

    const { url } = response.data.history[0]
    expect(url).toBe(`/${message.to}/quotes`)
  })

  test('should fail validation for POST /quotes request if any of request "supportedCurrencies" is not registered (no position account exists) for the payer participant', async () => {
    let response = await hubClient.getHistory()
    expect(response.data.history.length).toBe(0)

    const { topic, config } = kafkaConfig.PRODUCER.QUOTE.POST
    const topicConfig = dto.topicConfigDto({ topicName: topic })
    const from = 'pinkbank'
    const to = 'greenbank'
    const payload = mocks.postQuotesPayloadDto({
      from,
      to,
      payer: { partyIdInfo: { partyIdType: 'MSISDN', partyIdentifier: '987654321', fspId: from }, supportedCurrencies: ['USD', 'ZMW', 'GBP'] }
    })
    const message = mocks.kafkaMessagePayloadPostDto({ from, to, id: payload.quoteId, payloadBase64: base64Encode(JSON.stringify(payload)) })
    const isOk = await Producer.produceMessage(message, topicConfig, config)
    expect(isOk).toBe(true)

    response = await getResponseWithRetry()
    expect(response.data.history.length).toBe(1)

    const { url, body } = response.data.history[0]
    expect(url).toBe(`/${message.from}/quotes/${message.id}/error`)
    expect(body.errorInformation.errorCode).toBe('3202')
    expect(body.errorInformation.errorDescription).toBe(`Payer FSP ID not found - Unsupported participant '${message.from}'`)
  })

  test('should forward POST /quotes request to payee dfsp registered in the hub', async () => {
    let response = await hubClient.getHistory()
    expect(response.data.history.length).toBe(0)

    const { topic, config } = kafkaConfig.PRODUCER.QUOTE.POST
    const topicConfig = dto.topicConfigDto({ topicName: topic })
    const from = 'pinkbank'
    const to = 'greenbank'

    const payload = mocks.postQuotesPayloadDto({ from, to })
    const message = mocks.kafkaMessagePayloadPostDto({ from, to, id: payload.quoteId, payloadBase64: base64Encode(JSON.stringify(payload)) })
    const isOk = await Producer.produceMessage(message, topicConfig, config)
    expect(isOk).toBe(true)

    response = await getResponseWithRetry()
    expect([1, 2]).toContain(response.data.history.length)

    const request = response.data.history[0]
    expect(request.method).toBe('POST')
    expect(request.url).toBe(`/${to}/quotes`)
    expect(request.body).toEqual(payload)
    expect(request.headers['fspiop-source']).toBe(from)
    expect(request.headers['fspiop-destination']).toBe(to)
  })

  test('should forward POST /quotes request to proxy if the payee dfsp is not registered in the hub', async () => {
    let response = await hubClient.getHistory()
    expect(response.data.history.length).toBe(0)

    const { topic, config } = kafkaConfig.PRODUCER.QUOTE.POST
    const topicConfig = dto.topicConfigDto({ topicName: topic })
    const from = 'pinkbank'
    // redbank not in the hub db
    const to = 'redbank'

    // register proxy representative for redbank
    const proxyId = 'redbankproxy'
    let proxyClient

    try {
      proxyClient = createProxyClient({ proxyCacheConfig: proxyCache, logger: console })
      const isAdded = await proxyClient.addDfspIdToProxyMapping(to, proxyId)

      // assert that the proxy representative is mapped in the cache
      const key = `dfsp:${to}`
      const representative = await proxyClient.redisClient.get(key)

      expect(isAdded).toBe(true)
      expect(representative).toBe(proxyId)

      const payload = mocks.postQuotesPayloadDto({ from, to })
      const message = mocks.kafkaMessagePayloadPostDto({ from, to, id: payload.quoteId, payloadBase64: base64Encode(JSON.stringify(payload)) })
      const isOk = await Producer.produceMessage(message, topicConfig, config)
      expect(isOk).toBe(true)

      response = await getResponseWithRetry()
      expect([1, 2]).toContain(response.data.history.length)

      const request = response.data.history[0]
      expect(request.url).toBe(`/${proxyId}/quotes`)
      expect(request.body).toEqual(payload)
      expect(request.headers['fspiop-source']).toBe(from)
      expect(request.headers['fspiop-destination']).toBe(to)
    } finally {
      await proxyClient.removeDfspIdFromProxyMapping(to)
      await proxyClient.removeDfspIdFromProxyMapping(from)
      await proxyClient.disconnect()
    }
  })

  test('should forward POST /bulkQuotes request to payee dfsp registered in the hub', async () => {
    let response = await hubClient.getHistory()
    expect(response.data.history.length).toBe(0)

    const { topic, config } = kafkaConfig.PRODUCER.BULK_QUOTE.POST
    const topicConfig = dto.topicConfigDto({ topicName: topic })
    const from = 'pinkbank'
    const to = 'greenbank'

    const payload = mocks.postBulkQuotesPayloadDto({ from, to })
    const message = mocks.kafkaMessagePayloadPostDto({ from, to, id: payload.quoteId, payloadBase64: base64Encode(JSON.stringify(payload)) })
    const isOk = await Producer.produceMessage(message, topicConfig, config)
    expect(isOk).toBe(true)

    response = await getResponseWithRetry()
    expect(response.data.history.length).toBe(1)

    const request = response.data.history[0]
    expect(request.url).toBe(`/${to}/bulkQuotes`)
    expect(request.body).toEqual(payload)
    expect(request.headers['fspiop-source']).toBe(from)
    expect(request.headers['fspiop-destination']).toBe(to)
  })

  test('should forward POST /bulkQuotes request to proxy if the payee dfsp is not registered in the hub', async () => {
    let response = await hubClient.getHistory()
    expect(response.data.history.length).toBe(0)

    const { topic, config } = kafkaConfig.PRODUCER.BULK_QUOTE.POST
    const topicConfig = dto.topicConfigDto({ topicName: topic })
    const from = 'pinkbank'
    // redbank not in the hub db
    const to = 'redbank'

    // register proxy representative for redbank
    const proxyId = 'redbankproxy'
    let proxyClient

    try {
      proxyClient = createProxyClient({ proxyCacheConfig: proxyCache, logger: console })
      const isAdded = await proxyClient.addDfspIdToProxyMapping(to, proxyId)

      // assert that the proxy representative is mapped in the cache
      const key = `dfsp:${to}`
      const representative = await proxyClient.redisClient.get(key)

      expect(isAdded).toBe(true)
      expect(representative).toBe(proxyId)

      const payload = {
        bulkQuoteId: uuid(),
        payer: { partyIdInfo: { partyIdType: 'MSISDN', partyIdentifier: '987654321', fspId: from } },
        individualQuotes: [
          {
            quoteId: uuid(),
            transactionId: uuid(),
            payee: { partyIdInfo: { partyIdType: 'MSISDN', partyIdentifier: '123456789', fspId: to } },
            amountType: 'SEND',
            amount: { amount: '100', currency: 'USD' },
            transactionType: { scenario: 'DEPOSIT', initiator: 'PAYER', initiatorType: 'CONSUMER' }
          }
        ]
      }
      const message = mocks.kafkaMessagePayloadPostDto({ from, to, id: payload.quoteId, payloadBase64: base64Encode(JSON.stringify(payload)) })
      const isOk = await Producer.produceMessage(message, topicConfig, config)
      expect(isOk).toBe(true)

      response = await getResponseWithRetry()
      expect(response.data.history.length).toBe(1)

      const request = response.data.history[0]
      expect(request.url).toBe(`/${proxyId}/bulkQuotes`)
      expect(request.body).toEqual(payload)
      expect(request.headers['fspiop-source']).toBe(from)
      expect(request.headers['fspiop-destination']).toBe(to)
    } finally {
      await proxyClient.removeDfspIdFromProxyMapping(to)
      await proxyClient.removeDfspIdFromProxyMapping(from)
      await proxyClient.disconnect()
    }
  })
})
