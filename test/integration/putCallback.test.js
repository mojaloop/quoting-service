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

 * Eugen Klymniuk <eugen.klymniuk@infitx.com>
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
const { wrapWithRetries } = require('../util/helper')

const hubClient = new MockServerClient()
const base64Encode = (data) => Buffer.from(data).toString('base64')
const TEST_TIMEOUT = 20_000
const WAIT_TIMEOUT = 3_000

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms))
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

/**
 * Publishes a test 'POST quote' message to the Kafka topic
 */
const createQuote = async ({
  from = 'pinkbank',
  to = 'greenbank',
  amount = { amount: '100', currency: 'USD' },
  amountType = 'SEND'
} = {}) => {
  const { kafkaConfig } = new Config()
  const { topic, config } = kafkaConfig.PRODUCER.QUOTE.POST
  const topicConfig = dto.topicConfigDto({ topicName: topic })
  const payload = {
    quoteId: uuid(),
    transactionId: uuid(),
    amountType,
    amount,
    transactionType: { scenario: 'DEPOSIT', initiator: 'PAYER', initiatorType: 'CONSUMER' },
    payee: { partyIdInfo: { partyIdType: 'MSISDN', partyIdentifier: '123456789', fspId: to } },
    payer: { partyIdInfo: { partyIdType: 'MSISDN', partyIdentifier: '987654321', fspId: from } }
  }
  const message = mocks.kafkaMessagePayloadPostDto({ from, to, id: payload.quoteId, payloadBase64: base64Encode(JSON.stringify(payload)) })
  const isOk = await Producer.produceMessage(message, topicConfig, config)
  expect(isOk).toBe(true)
  return payload
}

describe('PUT callback Tests --> ', () => {
  const { kafkaConfig, proxyCache } = new Config()

  beforeEach(async () => {
    await hubClient.clearHistory()
  })

  afterAll(async () => {
    await Producer.disconnect()
  })

  test('should handle the JWS signing when a switch error event is produced to the PUT topic', async () => {
    // create test quote to prevent db (row reference) error on PUT request
    const quoteCreated = await createQuote()
    await wait(WAIT_TIMEOUT)
    await hubClient.clearHistory()

    let response = await hubClient.getHistory()
    expect(response.data.history.length).toBe(0)

    const { topic, config } = kafkaConfig.PRODUCER.QUOTE.PUT
    const topicConfig = dto.topicConfigDto({ topicName: topic })
    const message = mocks.kafkaMessagePayloadDto({ id: quoteCreated.quoteId, operationId: 'QuotesByIDAndError' })

    const isOk = await Producer.produceMessage(message, topicConfig, config)
    expect(isOk).toBe(true)

    response = await wrapWithRetries(() => hubClient.getHistory(),
      wrapWithRetriesConf.remainingRetries,
      wrapWithRetriesConf.timeout,
      (result) => result.data.history.length > 0
    )

    expect(response.data.history.length).toBe(1)
    const { headers, url } = response.data.history[0]
    expect(headers['fspiop-signature']).toBeTruthy()
    expect(url).toBe(`/${message.to}/quotes/${message.id}/error`)
    const { signature, protectedHeader } = JSON.parse(headers['fspiop-signature'])
    expect(signature).toBeTruthy()
    expect(protectedHeader).toBeTruthy()
  }, TEST_TIMEOUT)

  test('should pass validation for PUT /quotes/{ID} request if request transferAmount/payeeReceiveAmount currency is registered (position account exists) for the payee pariticpant', async () => {
    // create test quote to prevent db (row reference) error on PUT request
    const quoteCreated = await createQuote()
    await wait(WAIT_TIMEOUT)
    await hubClient.clearHistory()

    let response = await hubClient.getHistory()
    expect(response.data.history.length).toBe(0)

    const { topic, config } = kafkaConfig.PRODUCER.QUOTE.PUT
    const topicConfig = dto.topicConfigDto({ topicName: topic })
    const payload = {
      transferAmount: { amount: '100', currency: 'USD' },
      payeeReceiveAmount: { amount: '100', currency: 'USD' },
      ilpPacket: 'test',
      condition: 'test'
    }
    const message = mocks.kafkaMessagePayloadDto({
      from: 'greenbank',
      to: 'pinkbank',
      id: quoteCreated.quoteId,
      payloadBase64: base64Encode(JSON.stringify(payload))
    })
    delete message.content.headers.accept
    const isOk = await Producer.produceMessage(message, topicConfig, config)
    expect(isOk).toBe(true)

    response = await wrapWithRetries(() => hubClient.getHistory(),
      wrapWithRetriesConf.remainingRetries,
      wrapWithRetriesConf.timeout,
      (result) => result.data.history.length > 0
    )
    expect(response.data.history.length).toBe(1)

    const { url } = response.data.history[0]
    expect(url).toBe(`/${message.to}/quotes/${message.id}`)
  }, TEST_TIMEOUT)

  test('should pass validation for PUT /quotes/{ID} request if source is proxied participant', async () => {
    // create test quote to prevent db (row reference) error on PUT request
    const quoteCreated = await createQuote()
    await wait(WAIT_TIMEOUT)
    await hubClient.clearHistory()

    let response = await hubClient.getHistory()
    expect(response.data.history.length).toBe(0)

    const { topic, config } = kafkaConfig.PRODUCER.QUOTE.PUT
    const topicConfig = dto.topicConfigDto({ topicName: topic })
    const from = 'greenbank'
    const proxyId = 'greenbankproxy'
    let proxyClient
    try {
      proxyClient = await createProxyClient({ proxyCacheConfig: proxyCache, logger: console })
      const isAdded = await proxyClient.addDfspIdToProxyMapping(from, proxyId)
      expect(isAdded).toBe(true)
      const payload = {
        transferAmount: { amount: '100', currency: 'USD' },
        payeeReceiveAmount: { amount: '100', currency: 'USD' },
        ilpPacket: 'test',
        condition: 'test'
      }
      const message = mocks.kafkaMessagePayloadDto({
        from: 'greenbank',
        to: 'pinkbank',
        id: quoteCreated.quoteId,
        payloadBase64: base64Encode(JSON.stringify(payload))
      })
      delete message.content.headers.accept
      const isOk = await Producer.produceMessage(message, topicConfig, config)
      expect(isOk).toBe(true)

      response = await wrapWithRetries(() => hubClient.getHistory(),
        wrapWithRetriesConf.remainingRetries,
        wrapWithRetriesConf.timeout,
        (result) => result.data.history.length > 0
      )
      expect(response.data.history.length).toBe(1)

      const { url } = response.data.history[0]
      expect(url).toBe(`/${message.to}/quotes/${message.id}`)
    } finally {
      await proxyClient.removeDfspIdFromProxyMapping(from)
      await proxyClient.disconnect()
    }
  }, TEST_TIMEOUT)

  test('should fail validation for PUT /quotes/{ID} request if request transferAmount/payeeReceiveAmount currency is not registered (position account does not exist) for the payee pariticpant', async () => {
    // test the same scenario with only transferAmount set
    // create test quote to prevent db (row reference) error on PUT request
    const quoteCreated = await createQuote()
    await wait(WAIT_TIMEOUT)
    await hubClient.clearHistory()

    let response = await hubClient.getHistory()
    expect(response.data.history.length).toBe(0)

    const { topic, config } = kafkaConfig.PRODUCER.QUOTE.PUT
    const topicConfig = dto.topicConfigDto({ topicName: topic })
    const payload = {
      transferAmount: { amount: '100', currency: 'ZKW' },
      ilpPacket: 'test',
      condition: 'test'
    }
    let message = mocks.kafkaMessagePayloadDto({
      from: 'greenbank',
      to: 'pinkbank',
      id: quoteCreated.quoteId,
      payloadBase64: base64Encode(JSON.stringify(payload))
    })
    delete message.content.headers.accept
    let isOk = await Producer.produceMessage(message, topicConfig, config)
    expect(isOk).toBe(true)

    response = await wrapWithRetries(() => hubClient.getHistory(),
      wrapWithRetriesConf.remainingRetries,
      wrapWithRetriesConf.timeout,
      (result) => result.data.history.length > 0
    )
    expect(response.data.history.length).toBe(1)

    const { url, body } = response.data.history[0]
    expect(url).toBe(`/${message.from}/quotes/${message.id}/error`)
    expect(body.errorInformation.errorCode).toBe('3201')
    expect(body.errorInformation.errorDescription).toBe(`Destination FSP Error - Unsupported participant '${message.from}'`)

    // test the same scenario but with payeeReceiveAmount also set
    await hubClient.clearHistory()
    response = await hubClient.getHistory()
    expect(response.data.history.length).toBe(0)

    payload.transferAmount = { amount: '100', currency: 'USD' }
    payload.payeeReceiveAmount = { amount: '100', currency: 'ZKW' }

    message = mocks.kafkaMessagePayloadDto({
      from: 'greenbank',
      to: 'pinkbank',
      id: quoteCreated.quoteId,
      payloadBase64: base64Encode(JSON.stringify(payload))
    })
    delete message.content.headers.accept
    isOk = await Producer.produceMessage(message, topicConfig, config)
    expect(isOk).toBe(true)

    response = await wrapWithRetries(() => hubClient.getHistory(),
      wrapWithRetriesConf.remainingRetries,
      wrapWithRetriesConf.timeout,
      (result) => result.data.history.length > 0
    )
    expect(response.data.history.length).toBe(1)

    const { url: url2, body: body2 } = response.data.history[0]
    expect(url2).toBe(`/${message.from}/quotes/${message.id}/error`)
    expect(body2.errorInformation.errorCode).toBe('3201')
    expect(body2.errorInformation.errorDescription).toBe(`Destination FSP Error - Unsupported participant '${message.from}'`)
  }, TEST_TIMEOUT)

  test('should forward PUT /quotes/{ID} request to proxy if the payer dfsp is not registered in the hub', async () => {
    let response = await hubClient.getHistory()
    expect(response.data.history.length).toBe(0)

    const { topic, config } = kafkaConfig.PRODUCER.QUOTE.PUT

    const topicConfig = dto.topicConfigDto({ topicName: topic })
    const postTopicConfig = dto.topicConfigDto({ topicName: kafkaConfig.PRODUCER.QUOTE.POST.topic })

    const from = 'greenbank'
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

      const quoteId = uuid()
      const postPayload = {
        quoteId,
        transactionId: uuid(),
        amountType: 'SEND',
        amount: { amount: '100', currency: 'USD' },
        transactionType: { scenario: 'DEPOSIT', initiator: 'PAYER', initiatorType: 'CONSUMER' },
        payer: { partyIdInfo: { partyIdType: 'MSISDN', partyIdentifier: '987654321', fspId: from } },
        payee: { partyIdInfo: { partyIdType: 'MSISDN', partyIdentifier: '123456789', fspId: to } }
      }
      const postMessage = mocks.kafkaMessagePayloadPostDto({
        from,
        to,
        id: postPayload.quoteId,
        payloadBase64: base64Encode(JSON.stringify(postPayload))
      })
      const postIsOk = await Producer.produceMessage(postMessage, postTopicConfig, kafkaConfig.PRODUCER.QUOTE.POST.config)
      expect(postIsOk).toBe(true)

      response = await wrapWithRetries(() => hubClient.getHistory(),
        wrapWithRetriesConf.remainingRetries,
        wrapWithRetriesConf.timeout,
        (result) => result.data.history.length > 0
      )
      expect([1, 2]).toContain(response.data.history.length)
      hubClient.clearHistory()

      const payload = {
        transferAmount: { amount: '100', currency: 'USD' },
        ilpPacket: 'test',
        condition: 'test'
      }
      const message = mocks.kafkaMessagePayloadDto({ from, to, id: quoteId, payloadBase64: base64Encode(JSON.stringify(payload)) })
      delete message.content.headers.accept
      const isOk = await Producer.produceMessage(message, topicConfig, config)
      expect(isOk).toBe(true)

      response = await wrapWithRetries(() => hubClient.getHistory(),
        wrapWithRetriesConf.remainingRetries,
        wrapWithRetriesConf.timeout,
        (result) => result.data.history.length > 0
      )
      expect([1, 2]).toContain(response.data.history.length)

      const request = response.data.history[0]
      expect(request.url).toBe(`/${proxyId}/quotes/${message.id}`)
      expect(request.body).toEqual(payload)
      expect(request.headers['fspiop-source']).toBe(from)
      expect(request.headers['fspiop-destination']).toBe(to)
    } finally {
      await proxyClient.disconnect()
    }
  }, TEST_TIMEOUT)

  test('should forward PUT /fxQuotes/{ID} request to proxy if the payer dfsp is not registered in the hub', async () => {
    let response = await hubClient.getHistory()
    expect(response.data.history.length).toBe(0)

    const { topic, config } = kafkaConfig.PRODUCER.FX_QUOTE.PUT
    const topicConfig = dto.topicConfigDto({ topicName: topic })
    const postTopicConfig = dto.topicConfigDto({ topicName: kafkaConfig.PRODUCER.FX_QUOTE.POST.topic })

    const from = 'greenbank'
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
      const conversionRequestId = uuid()
      const postPayload = {
        conversionRequestId,
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
      const postMessage = mocks.kafkaMessagePayloadPostDto({ from, to, id: conversionRequestId, payloadBase64: base64Encode(JSON.stringify(postPayload)) })
      const postIsOk = await Producer.produceMessage(postMessage, postTopicConfig, kafkaConfig.PRODUCER.FX_QUOTE.POST.config)

      expect(postIsOk).toBe(true)

      response = await wrapWithRetries(() => hubClient.getHistory(),
        wrapWithRetriesConf.remainingRetries,
        wrapWithRetriesConf.timeout,
        (result) => result.data.history.length > 0
      )
      expect(response.data.history.length).toBe(1)
      hubClient.clearHistory()

      const payload = {
        condition: 'test',
        conversionTerms: {
          conversionId: uuid(),
          initiatingFsp: from,
          counterPartyFsp: to,
          amountType: 'SEND',
          sourceAmount: { amount: '100', currency: 'USD' },
          targetAmount: { amount: '100', currency: 'ZWS' },
          expiration: new Date(Date.now() + 5 * 60 * 1000).toISOString()
        }
      }
      const message = mocks.kafkaMessagePayloadDto({ from, to, id: uuid(), payloadBase64: base64Encode(JSON.stringify(payload)) })
      delete message.content.headers.accept
      const isOk = await Producer.produceMessage(message, topicConfig, config)
      expect(isOk).toBe(true)

      response = await wrapWithRetries(() => hubClient.getHistory(),
        wrapWithRetriesConf.remainingRetries,
        wrapWithRetriesConf.timeout,
        (result) => result.data.history.length > 0
      )
      expect(response.data.history.length).toBe(1)

      const request = response.data.history[0]
      expect(request.url).toBe(`/${proxyId}/fxQuotes/${message.id}`)
      expect(request.body).toEqual(payload)
      expect(request.headers['fspiop-source']).toBe(from)
      expect(request.headers['fspiop-destination']).toBe(to)
    } finally {
      await proxyClient.disconnect()
    }
  }, TEST_TIMEOUT)

  test('should forward PUT /bulkQuotes/{ID} request to proxy if the payer dfsp is not registered in the hub', async () => {
    let response = await hubClient.getHistory()
    expect(response.data.history.length).toBe(0)

    const { topic, config } = kafkaConfig.PRODUCER.BULK_QUOTE.PUT
    const topicConfig = dto.topicConfigDto({ topicName: topic })
    const postTopicConfig = dto.topicConfigDto({ topicName: kafkaConfig.PRODUCER.BULK_QUOTE.POST.topic })

    const from = 'greenbank'
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

      const bulkQuoteId = uuid()
      const quoteId = uuid()
      const postPayload = {
        bulkQuoteId,
        payer: { partyIdInfo: { partyIdType: 'MSISDN', partyIdentifier: '987654321', fspId: from } },
        individualQuotes: [
          {
            quoteId,
            transactionId: uuid(),
            payee: { partyIdInfo: { partyIdType: 'MSISDN', partyIdentifier: '123456789', fspId: to } },
            amountType: 'SEND',
            amount: { amount: '100', currency: 'USD' },
            transactionType: { scenario: 'DEPOSIT', initiator: 'PAYER', initiatorType: 'CONSUMER' }
          }
        ]
      }
      const postMessage = mocks.kafkaMessagePayloadPostDto({ from, to, id: null, payloadBase64: base64Encode(JSON.stringify(postPayload)) })
      const postIsOk = await Producer.produceMessage(postMessage, postTopicConfig, kafkaConfig.PRODUCER.BULK_QUOTE.POST.config)
      expect(postIsOk).toBe(true)

      response = await wrapWithRetries(() => hubClient.getHistory(),
        wrapWithRetriesConf.remainingRetries,
        wrapWithRetriesConf.timeout,
        (result) => result.data.history.length > 0
      )
      expect(response.data.history.length).toBe(1)
      hubClient.clearHistory()

      const payload = {
        individualQuoteResults: [
          {
            quoteId,
            payee: { partyIdInfo: { partyIdType: 'MSISDN', partyIdentifier: '123456789', fspId: to } },
            transferAmount: { amount: '100', currency: 'USD' },
            payeeReceiveAmount: { amount: '100', currency: 'USD' },
            payeeFspFee: { amount: '0', currency: 'USD' },
            payeeFspCommission: { amount: '0', currency: 'USD' },
            ilpPacket: 'test',
            condition: 'test'
          }
        ],
        expiration: new Date(Date.now() + 5 * 60 * 1000).toISOString()
      }
      const message = mocks.kafkaMessagePayloadDto({ from, to, id: uuid(), payloadBase64: base64Encode(JSON.stringify(payload)) })
      delete message.content.headers.accept
      const isOk = await Producer.produceMessage(message, topicConfig, config)
      expect(isOk).toBe(true)

      response = await wrapWithRetries(() => hubClient.getHistory(),
        wrapWithRetriesConf.remainingRetries,
        wrapWithRetriesConf.timeout,
        (result) => result.data.history.length > 0
      )
      expect(response.data.history.length).toBe(1)

      const request = response.data.history[0]
      expect(request.url).toBe(`/${proxyId}/bulkQuotes/${message.id}`)
      expect(request.body).toEqual(payload)
      expect(request.headers['fspiop-source']).toBe(from)
      expect(request.headers['fspiop-destination']).toBe(to)
    } finally {
      await proxyClient.disconnect()
    }
  }, TEST_TIMEOUT)
})
