const { setTimeout: sleep } = require('node:timers/promises')

const { createPayloadCache } = require('../../src/lib/payloadCache')
const { ISO_HEADER_PART } = require('../../src/constants')
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
    test('should validate ISO POST and GET /quotes payload, and forward it in ISO format', async () => {
      const from = 'pinkbank'
      const to = 'greenbank'
      const quoteId = mocks.generateULID()
      const transactionId = mocks.generateULID()
      const response = await qsClient.postIsoQuotes({ from, to, quoteId, transactionId })
      expect(response.status).toBe(202)
      await sleep(3000)

      const { data } = await hubClient.getHistory()
      expect(data.history.length).toBeGreaterThanOrEqual(1)
      const { PmtId, CdtrAgt, DbtrAgt } = data.history[0].body.CdtTrfTxInf
      expect(PmtId.TxId).toBe(quoteId)
      expect(PmtId.EndToEndId).toBe(transactionId)
      expect(DbtrAgt.FinInstnId.Othr.Id).toBe(from)
      expect(CdtrAgt.FinInstnId.Othr.Id).toBe(to)

      await hubClient.clearHistory()
      const getResp = await qsClient.getIsoQuotes({ quoteId, from, to })
      expect(getResp.status).toBe(202)
      await sleep(3000)

      const getCallback = await hubClient.getHistory()
      expect(getCallback.data.history.length).toBe(1)
    })
  })

  describe('PUT /quotes ISO Tests -->', () => {
    // todo: add PUT /quotes tests
    test('should validate ISO PUT /quotes/{id}/error payload, but send error callback due to not existing id in DB', async () => {
      const expectedErrorCode = '2001' // todo: clarify, what code should be sent
      const fspiopPayload = mocks.errorPayloadDto()
      const id = mocks.generateULID()
      const from = 'pinkbank'
      const to = 'greenbank'
      const response = await qsClient.putErrorIsoQuotes(id, fspiopPayload, from, to)
      expect(response.status).toBe(200)

      await sleep(3000)

      const { data } = await hubClient.getHistory()
      expect(data.history.length).toBe(1)
      const { body, headers } = data.history[0]
      expect(headers['content-type']).toContain(ISO_HEADER_PART)
      expect(body.TxInfAndSts.StsRsnInf.Rsn.Cd).toBe(expectedErrorCode)
    })
  })

  describe('fxQuotes ISO Tests -->', () => {
    test('should validate ISO POST /fxQuotes payload, and forward it in ISO format', async () => {
      const args = {
        initiatingFsp: 'pinkbank',
        counterPartyFsp: 'greenbank',
        conversionRequestId: mocks.generateULID(),
        conversionId: mocks.generateULID(),
        determiningTransferId: mocks.generateULID()
      }
      const response = await qsClient.postIsoFxQuotes(args)
      expect(response.status).toBe(202)

      await sleep(3000)

      const { data } = await hubClient.getHistory()
      expect(data.history.length).toBe(1)
      const { body, headers } = data.history[0]
      expect(headers['content-type']).toContain(ISO_HEADER_PART)
      expect(body.CdtTrfTxInf.PmtId.TxId).toBe(args.conversionRequestId)
      expect(body.CdtTrfTxInf.PmtId.InstrId).toBe(args.conversionId)
      expect(body.CdtTrfTxInf.PmtId.EndToEndId).toBe(args.determiningTransferId)
    })
  })
})
