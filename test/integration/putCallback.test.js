const { Producer } = require('@mojaloop/central-services-stream').Util

const Config = require('../../src/lib/config')
const dto = require('../../src/lib/dto')
const mocks = require('../mocks')
const MockServerClient = require('./mockHttpServer/MockServerClient')
const { wrapWithRetries } = require('../util/helper')

const TEST_TIMEOUT = 20_000
const WAIT_TIMEOUT = 3_000

describe('PUT callback Tests --> ', () => {
  jest.setTimeout(TEST_TIMEOUT)

  const { kafkaConfig } = new Config()
  const hubClient = new MockServerClient()
  const retryConf = {
    remainingRetries: process?.env?.TEST_INT_RETRY_COUNT || 20,
    timeout: process?.env?.TEST_INT_RETRY_DELAY || 1
  }

  beforeEach(async () => {
    await hubClient.clearHistory()
  })

  afterAll(async () => {
    await Producer.disconnect()
  })

  const base64Encode = (data) => Buffer.from(data).toString('base64')
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
    const payload = mocks.postQuotesPayloadDto({ from, to, amount, amountType })
    const message = mocks.kafkaMessagePayloadPostDto({ from, to, id: payload.quoteId, payloadBase64: base64Encode(JSON.stringify(payload)) })
    const isOk = await Producer.produceMessage(message, topicConfig, config)
    expect(isOk).toBe(true)
    return payload
  }

  const getResponseWithRetry = async () => {
    return wrapWithRetries(() => hubClient.getHistory(),
      retryConf.remainingRetries,
      retryConf.timeout,
      (result) => result.data.history.length > 0
    )
  }

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
    response = await getResponseWithRetry()

    expect(response.data.history.length).toBeGreaterThan(0)
    const { headers, url } = response.data.history[0]
    expect(headers['fspiop-signature']).toBeTruthy()
    expect(url).toBe(`/${message.to}/quotes/${message.id}/error`)
    const { signature, protectedHeader } = JSON.parse(headers['fspiop-signature'])
    expect(signature).toBeTruthy()
    expect(protectedHeader).toBeTruthy()
  })
})
