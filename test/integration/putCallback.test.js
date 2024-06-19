const { Producer } = require('@mojaloop/central-services-stream').Util

const Config = require('../../src/lib/config')
const dto = require('../../src/lib/dto')
const mocks = require('../mocks')
const MockServerClient = require('./mockHttpServer/MockServerClient')
const uuid = require('crypto').randomUUID

const hubClient = new MockServerClient()
const base64Encode = (data) => Buffer.from(data).toString('base64')
const TEST_TIMEOUT = 20000

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms))

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
  const { kafkaConfig } = new Config()

  beforeEach(async () => {
    await hubClient.clearHistory()
  })

  afterAll(async () => {
    await Producer.disconnect()
  })

  test('should handle the JWS signing when a switch error event is produced to the PUT topic', async () => {
    // create test quote to prevent db (row reference) error on PUT request
    const quoteCreated = await createQuote()
    await wait(3000)
    await hubClient.clearHistory()

    let response = await hubClient.getHistory()
    expect(response.data.history.length).toBe(0)

    const { topic, config } = kafkaConfig.PRODUCER.QUOTE.PUT
    const topicConfig = dto.topicConfigDto({ topicName: topic })
    const message = mocks.kafkaMessagePayloadDto({ id: quoteCreated.quoteId, operationId: 'QuotesByIDAndError' })

    const isOk = await Producer.produceMessage(message, topicConfig, config)
    expect(isOk).toBe(true)

    await wait(3000)

    response = await hubClient.getHistory()
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
    await wait(3000)
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

    await wait(3000)

    response = await hubClient.getHistory()
    expect(response.data.history.length).toBe(1)

    const { url } = response.data.history[0]
    expect(url).toBe(`/${message.to}/quotes/${message.id}`)
  }, TEST_TIMEOUT)

  test('should fail validation for PUT /quotes/{ID} request if request transferAmount/payeeReceiveAmount currency is not registered (position account does not exist) for the payee pariticpant', async () => {
    // test the same scenario with only transferAmount set
    // create test quote to prevent db (row reference) error on PUT request
    const quoteCreated = await createQuote()
    await wait(3000)
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

    await wait(6000)

    response = await hubClient.getHistory()
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

    await wait(3000)

    response = await hubClient.getHistory()
    expect(response.data.history.length).toBe(1)

    const { url: url2, body: body2 } = response.data.history[0]
    expect(url2).toBe(`/${message.from}/quotes/${message.id}/error`)
    expect(body2.errorInformation.errorCode).toBe('3201')
    expect(body2.errorInformation.errorDescription).toBe(`Destination FSP Error - Unsupported participant '${message.from}'`)
  }, TEST_TIMEOUT)
})
