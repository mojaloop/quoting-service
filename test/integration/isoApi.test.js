const { setTimeout: sleep } = require('node:timers/promises')

// const mocks = require('../mocks')
const QSClient = require('./QSClient')
const MockServerClient = require('./mockHttpServer/MockServerClient')

const QS_ISO_PORT = 13002 // in docker-compose.yml

jest.setTimeout(20_000)

describe('ISO API Tests -->', () => {
  const qsClient = new QSClient({ port: QS_ISO_PORT })
  const hubClient = new MockServerClient()

  beforeEach(async () => {
    await hubClient.clearHistory()
  })

  describe('POST /quotes ISO Tests -->', () => {
    test('should validate ISO POST /quotes payload, and forward it in FSPIOP format', async () => {
      const from = 'pinkbank'
      const to = 'greenbank'
      const quoteId = `q-${Date.now()}`
      const transactionId = `t-${Date.now()}`
      const response = await qsClient.postIsoQuotes({ from, to, quoteId, transactionId })
      expect(response.status).toBe(202)

      await sleep(3000)

      const { data } = await hubClient.getHistory()
      expect(data.history.length).toBe(1)
      const forwardedPayload = data.history[0].body // forwarded payload
      expect(forwardedPayload.quoteId).toBe(quoteId)
      expect(forwardedPayload.transactionId).toBe(transactionId)
    })
  })
})
