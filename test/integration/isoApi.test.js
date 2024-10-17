const { setTimeout: sleep } = require('node:timers/promises')

const { createPayloadCache } = require('../../src/lib/payloadCache')
const Config = require('../../src/lib/config')
const mocks = require('../mocks')
const QSClient = require('./QSClient')
const MockServerClient = require('./mockHttpServer/MockServerClient')

const QS_ISO_PORT = 13002 // in docker-compose.yml
const config = new Config()

jest.setTimeout(10_000)

describe('ISO API Tests -->', () => {
  const qsClient = new QSClient({ port: QS_ISO_PORT })
  const hubClient = new MockServerClient()

  const { type, connectionConfig } = config.payloadCache
  const payloadCache = createPayloadCache(type, connectionConfig)

  beforeAll(async () => {
    await payloadCache.connect()
    expect(payloadCache.isConnected).toBe(true)
  })

  beforeEach(async () => {
    await hubClient.clearHistory()
  })

  afterAll(async () => {
    await payloadCache.disconnect()
  })

  describe('POST /quotes ISO Tests -->', () => {
    test('should validate ISO POST /quotes payload, and forward it in ISO format', async () => {
      const from = 'pinkbank'
      const to = 'greenbank'
      const quoteId = mocks.generateULID()
      const transactionId = mocks.generateULID()
      const response = await qsClient.postIsoQuotes({ from, to, quoteId, transactionId })
      expect(response.status).toBe(202)

      await sleep(3000)

      const { data } = await hubClient.getHistory()
      expect(data.history.length).toBe(1)
      const { PmtId, CdtrAgt, DbtrAgt } = data.history[0].body.CdtTrfTxInf
      expect(PmtId.TxId).toBe(quoteId)
      expect(PmtId.EndToEndId).toBe(transactionId)
      expect(DbtrAgt.FinInstnId.Othr.Id).toBe(from)
      expect(CdtrAgt.FinInstnId.Othr.Id).toBe(to)
    })
  })
})
