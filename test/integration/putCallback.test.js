const { Producer } = require('@mojaloop/central-services-stream').Util

const Config = require('../../src/lib/config')
const dto = require('../../src/lib/dto')
const mocks = require('../mocks')
const MockServerClient = require('./mockHttpServer/MockServerClient')
const uuid = require('crypto').randomUUID

const hubClient = new MockServerClient()

const base64Encode = (data) => Buffer.from(data).toString('base64')

const createQuote = async () => {
  const { kafkaConfig } = new Config()
  const { topic, config } = kafkaConfig.PRODUCER.QUOTE.POST
  const topicConfig = dto.topicConfigDto({ topicName: topic })
  const payload = {
    quoteId: uuid(),
    transactionId: uuid(),
    payee: { partyIdInfo: { partyIdType: 'MSISDN', partyIdentifier: '123456789', fspId: 'greenbank' } },
    payer: { partyIdInfo: { partyIdType: 'MSISDN', partyIdentifier: '987654321', fspId: 'pinkbank' } },
    amountType: 'SEND',
    amount: { amount: '100', currency: 'USD' },
    transactionType: { scenario: 'DEPOSIT', initiator: 'PAYER', initiatorType: 'CONSUMER' }
  }
  const message = mocks.kafkaMessagePayloadDto({
    from: 'pinkbank',
    to: 'greenbank',
    payloadBase64: base64Encode(JSON.stringify(payload)),
    contentType: 'application/vnd.interoperability.quotes+json;version=2.0'
  })
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

  test.skip('should handle the JWS signing when a switch error event is produced to the PUT topic', async () => {
    let response = await hubClient.getHistory()
    expect(response.data.history.length).toBe(0)

    const { topic, config } = kafkaConfig.PRODUCER.QUOTE.PUT
    const topicConfig = dto.topicConfigDto({ topicName: topic })
    const message = mocks.kafkaMessagePayloadDto()

    const isOk = await Producer.produceMessage(message, topicConfig, config)
    expect(isOk).toBe(true)

    await new Promise(resolve => setTimeout(resolve, 3000))

    response = await hubClient.getHistory()
    expect(response.data.history.length).toBe(1)
    const { headers, url } = response.data.history[0]
    expect(headers['fspiop-signature']).toBeTruthy()
    expect(url).toBe(`/${message.to}/quotes/${message.id}/error`)
    const { signature, protectedHeader } = JSON.parse(headers['fspiop-signature'])
    expect(signature).toBeTruthy()
    expect(protectedHeader).toBeTruthy()
  })

  test('should validate participant has position account in the transferAmount currency in the PUT /quotes/{ID} request', async () => {
    const quoteCreated = await createQuote()
    await new Promise(resolve => setTimeout(resolve, 10000))
    // let response = await hubClient.getHistory()
    // expect(response.data.history.length).toBe(0)

    const { topic, config } = kafkaConfig.PRODUCER.QUOTE.PUT
    const topicConfig = dto.topicConfigDto({ topicName: topic })
    const payload = {
      transferAmount: { amount: '100', currency: 'USD' },
      ilpPacket: 'test',
      condition: 'test'
    }
    const message = mocks.kafkaMessagePayloadDto({
      from: 'greenbank',
      to: 'payerfsp',
      id: quoteCreated.quoteId,
      payloadBase64: base64Encode(JSON.stringify(payload)),
      contentType: 'application/vnd.interoperability.quotes+json;version=2.0'
    })
    delete message.content.headers.accept
    const isOk = await Producer.produceMessage(message, topicConfig, config)
    expect(isOk).toBe(true)

    await new Promise(resolve => setTimeout(resolve, 10000))

    // response = await hubClient.getHistory()
    // expect(response.data.history.length).toBe(1)

    // const { headers, url } = response.data.history[0]
    // expect(headers['fspiop-signature']).toBeTruthy()
    // expect(url).toBe(`/${message.to}/quotes/${message.id}/error`)

    // const { signature, protectedHeader } = JSON.parse(headers['fspiop-signature'])
    // expect(signature).toBeTruthy()
    // expect(protectedHeader).toBeTruthy()
  })
})
