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

const hubClient = new MockServerClient()
const base64Encode = (data) => Buffer.from(data).toString('base64')
const TEST_TIMEOUT = 20_000
const WAIT_TIMEOUT = 3_000

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

  test('should pass validation for POST /quotes request if request amount currency is registered (position account exists) for the payer pariticpant', async () => {
    let response = await hubClient.getHistory()
    expect(response.data.history.length).toBe(0)

    const { topic, config } = kafkaConfig.PRODUCER.QUOTE.POST
    const topicConfig = dto.topicConfigDto({ topicName: topic })
    const from = 'pinkbank'
    const to = 'greenbank'
    const payload = {
      quoteId: uuid(),
      transactionId: uuid(),
      amountType: 'SEND',
      amount: { amount: '100', currency: 'USD' },
      transactionType: { scenario: 'DEPOSIT', initiator: 'PAYER', initiatorType: 'CONSUMER' },
      payer: { partyIdInfo: { partyIdType: 'MSISDN', partyIdentifier: '987654321', fspId: from } },
      payee: { partyIdInfo: { partyIdType: 'MSISDN', partyIdentifier: '123456789', fspId: to } }
    }
    const message = mocks.kafkaMessagePayloadPostDto({ from, to, id: payload.quoteId, payloadBase64: base64Encode(JSON.stringify(payload)) })
    const isOk = await Producer.produceMessage(message, topicConfig, config)
    expect(isOk).toBe(true)

    await wait(WAIT_TIMEOUT)

    response = await hubClient.getHistory()
    expect(response.data.history.length).toBe(1)

    const { url } = response.data.history[0]
    expect(url).toBe(`/${message.to}/quotes`)
  })

  test('should fail validation for POST /quotes request if request amount currency is not registered (position account doesn not exist) for the payer pariticpant', async () => {
    let response = await hubClient.getHistory()
    expect(response.data.history.length).toBe(0)

    const { topic, config } = kafkaConfig.PRODUCER.QUOTE.POST
    const topicConfig = dto.topicConfigDto({ topicName: topic })
    const from = 'pinkbank'
    const to = 'greenbank'
    const payload = {
      quoteId: uuid(),
      transactionId: uuid(),
      amountType: 'SEND',
      amount: { amount: '100', currency: 'GBP' },
      transactionType: { scenario: 'DEPOSIT', initiator: 'PAYER', initiatorType: 'CONSUMER' },
      payer: { partyIdInfo: { partyIdType: 'MSISDN', partyIdentifier: '987654321', fspId: from } },
      payee: { partyIdInfo: { partyIdType: 'MSISDN', partyIdentifier: '123456789', fspId: to } }
    }
    const message = mocks.kafkaMessagePayloadPostDto({ from, to, id: payload.quoteId, payloadBase64: base64Encode(JSON.stringify(payload)) })
    const isOk = await Producer.produceMessage(message, topicConfig, config)
    expect(isOk).toBe(true)

    await wait(WAIT_TIMEOUT)

    response = await hubClient.getHistory()
    expect(response.data.history.length).toBe(1)

    const { url, body } = response.data.history[0]
    expect(url).toBe(`/${message.from}/quotes/${message.id}/error`)
    expect(body.errorInformation.errorCode).toBe('3201')
    expect(body.errorInformation.errorDescription).toBe(`Destination FSP Error - Unsupported participant '${message.to}'`)
  })

  test('should pass validation for POST /quotes request if all request "supportedCurrencies" are registered (position account exists) for the payer pariticpant', async () => {
    let response = await hubClient.getHistory()
    expect(response.data.history.length).toBe(0)

    const { topic, config } = kafkaConfig.PRODUCER.QUOTE.POST
    const topicConfig = dto.topicConfigDto({ topicName: topic })
    const from = 'pinkbank'
    const to = 'greenbank'
    const payload = {
      quoteId: uuid(),
      transactionId: uuid(),
      amountType: 'SEND',
      amount: { amount: '100', currency: 'USD' },
      transactionType: { scenario: 'DEPOSIT', initiator: 'PAYER', initiatorType: 'CONSUMER' },
      payer: { partyIdInfo: { partyIdType: 'MSISDN', partyIdentifier: '987654321', fspId: from }, supportedCurrencies: ['USD', 'ZMW'] },
      payee: { partyIdInfo: { partyIdType: 'MSISDN', partyIdentifier: '123456789', fspId: to } }
    }
    const message = mocks.kafkaMessagePayloadPostDto({ from, to, id: payload.quoteId, payloadBase64: base64Encode(JSON.stringify(payload)) })
    const isOk = await Producer.produceMessage(message, topicConfig, config)
    expect(isOk).toBe(true)

    await wait(3000)

    response = await hubClient.getHistory()
    expect(response.data.history.length).toBe(1)

    const { url } = response.data.history[0]
    expect(url).toBe(`/${message.to}/quotes`)
  })

  test('should fail validation for POST /quotes request if any of request "supportedCurrencies" is not registered (no position account exists) for the payer pariticpant', async () => {
    let response = await hubClient.getHistory()
    expect(response.data.history.length).toBe(0)

    const { topic, config } = kafkaConfig.PRODUCER.QUOTE.POST
    const topicConfig = dto.topicConfigDto({ topicName: topic })
    const from = 'pinkbank'
    const to = 'greenbank'
    const payload = {
      quoteId: uuid(),
      transactionId: uuid(),
      amountType: 'SEND',
      amount: { amount: '100', currency: 'USD' },
      transactionType: { scenario: 'DEPOSIT', initiator: 'PAYER', initiatorType: 'CONSUMER' },
      payer: { partyIdInfo: { partyIdType: 'MSISDN', partyIdentifier: '987654321', fspId: from }, supportedCurrencies: ['USD', 'ZMW', 'GBP'] },
      payee: { partyIdInfo: { partyIdType: 'MSISDN', partyIdentifier: '123456789', fspId: to } }
    }
    const message = mocks.kafkaMessagePayloadPostDto({ from, to, id: payload.quoteId, payloadBase64: base64Encode(JSON.stringify(payload)) })
    const isOk = await Producer.produceMessage(message, topicConfig, config)
    expect(isOk).toBe(true)

    await wait(WAIT_TIMEOUT)

    response = await hubClient.getHistory()
    expect(response.data.history.length).toBe(1)

    const { url, body } = response.data.history[0]
    expect(url).toBe(`/${message.from}/quotes/${message.id}/error`)
    expect(body.errorInformation.errorCode).toBe('3202')
    expect(body.errorInformation.errorDescription).toBe(`Payer FSP ID not found - Unsupported participant '${message.from}'`)
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
      proxyClient = await createProxyClient({ proxyCacheConfig: proxyCache, logger: console })
      const isAdded = await proxyClient.addDfspIdToProxyMapping(to, proxyId)

      // assert that the proxy representative is mapped in the cache
      const key = `dfsp:${to}`
      const representative = await proxyClient.redisClient.get(key)

      expect(isAdded).toBe(true)
      expect(representative).toBe(proxyId)

      const payload = {
        quoteId: uuid(),
        transactionId: uuid(),
        amountType: 'SEND',
        amount: { amount: '100', currency: 'USD' },
        transactionType: { scenario: 'DEPOSIT', initiator: 'PAYER', initiatorType: 'CONSUMER' },
        payer: { partyIdInfo: { partyIdType: 'MSISDN', partyIdentifier: '987654321', fspId: from } },
        payee: { partyIdInfo: { partyIdType: 'MSISDN', partyIdentifier: '123456789', fspId: to } }
      }
      const message = mocks.kafkaMessagePayloadPostDto({ from, to, id: payload.quoteId, payloadBase64: base64Encode(JSON.stringify(payload)) })
      const isOk = await Producer.produceMessage(message, topicConfig, config)
      expect(isOk).toBe(true)

      await wait(WAIT_TIMEOUT)

      response = await hubClient.getHistory()
      expect([1, 2]).toContain(response.data.history.length)

      const request = response.data.history[0]
      expect(request.url).toBe(`/${proxyId}/quotes`)
      expect(request.body).toEqual(payload)
      expect(request.headers['fspiop-source']).toBe(from)
      expect(request.headers['fspiop-destination']).toBe(to)
    } finally {
      await proxyClient.disconnect()
    }
  })

  test('should forward POST /fxQuotes request to proxy if the payee dfsp is not registered in the hub', async () => {
    let response = await hubClient.getHistory()
    expect(response.data.history.length).toBe(0)

    const { topic, config } = kafkaConfig.PRODUCER.FX_QUOTE.POST
    const topicConfig = dto.topicConfigDto({ topicName: topic })
    const from = 'pinkbank'
    // redbank not in the hub db
    const to = 'redbank'

    // register proxy representative for redbank
    const proxyId = 'redbankproxy'
    let proxyClient

    try {
      proxyClient = await createProxyClient({ proxyCacheConfig: proxyCache, logger: console })
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

      const request = response.data.history[0]
      expect(request.url).toBe(`/${proxyId}/fxQuotes`)
      expect(request.body).toEqual(payload)
      expect(request.headers['fspiop-source']).toBe(from)
      expect(request.headers['fspiop-destination']).toBe(to)
    } finally {
      await proxyClient.disconnect()
    }
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
      proxyClient = await createProxyClient({ proxyCacheConfig: proxyCache, logger: console })
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

      await wait(WAIT_TIMEOUT)

      response = await hubClient.getHistory()
      expect(response.data.history.length).toBe(1)

      const request = response.data.history[0]
      expect(request.url).toBe(`/${proxyId}/bulkQuotes`)
      expect(request.body).toEqual(payload)
      expect(request.headers['fspiop-source']).toBe(from)
      expect(request.headers['fspiop-destination']).toBe(to)
    } finally {
      await proxyClient.disconnect()
    }
  })
})
