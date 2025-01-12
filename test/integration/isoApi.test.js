const { setTimeout: sleep } = require('node:timers/promises')
const { TransformFacades } = require('../../src/lib')
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
    test('should validate ISO PUT /quotes/{id}/error payload, but send error callback due to not existing id in DB', async () => {
      const expectedErrorCode = '2001'
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

    test('should validate ISO PUT /quotes/{id}/error payload and forward error if quote exists in db', async () => {
      const from = 'pinkbank'
      const to = 'greenbank'
      const quoteId = mocks.generateULID()
      const transactionId = mocks.generateULID()
      const postResponse = await qsClient.postIsoQuotes({ from, to, quoteId, transactionId })
      expect(postResponse.status).toBe(202)
      await sleep(3000)

      const { data: postData } = await hubClient.getHistory()
      expect(postData.history.length).toBeGreaterThanOrEqual(1)
      const { PmtId, CdtrAgt, DbtrAgt } = postData.history[0].body.CdtTrfTxInf
      expect(PmtId.TxId).toBe(quoteId)
      expect(PmtId.EndToEndId).toBe(transactionId)
      expect(DbtrAgt.FinInstnId.Othr.Id).toBe(from)
      expect(CdtrAgt.FinInstnId.Othr.Id).toBe(to)

      await hubClient.clearHistory()

      const fspiopPayload = mocks.errorPayloadDto()
      const isoPayload = (await TransformFacades.FSPIOP.quotes.putError({ body: fspiopPayload })).body
      const response = await qsClient.putErrorQuotes(quoteId, isoPayload, from, to)
      expect(response.status).toBe(200)

      await sleep(3000)

      const { data: putData } = await hubClient.getHistory()
      expect(putData.history.length).toBe(1)
      const { body, headers } = putData.history[0]
      expect(headers['content-type']).toContain(ISO_HEADER_PART)

      expect(body.GrpHdr.MsgId).toBe(isoPayload.GrpHdr.MsgId)
      expect(body.GrpHdr.CreDtTm).toBe(isoPayload.GrpHdr.CreDtTm)
      expect(body.TxInfAndSts.StsRsnInf.Rsn.Cd).toBe(isoPayload.TxInfAndSts.StsRsnInf.Rsn.Cd)
    })
  })

  describe('fxQuotes ISO Tests -->', () => {
    const generatePostFxArgs = () => ({
      initiatingFsp: 'pinkbank',
      counterPartyFsp: 'greenbank',
      conversionRequestId: mocks.generateULID(),
      conversionId: mocks.generateULID(),
      determiningTransferId: mocks.generateULID()
    })

    test('should validate ISO POST /fxQuotes payload, and forward it in ISO format', async () => {
      const postFxArgs = generatePostFxArgs()
      const response = await qsClient.postIsoFxQuotes(postFxArgs)
      expect(response.status).toBe(202)

      await sleep(3000)

      const { data } = await hubClient.getHistory()
      expect(data.history.length).toBe(1)
      const { body, headers } = data.history[0]
      expect(headers['content-type']).toContain(ISO_HEADER_PART)
      expect(body.CdtTrfTxInf.PmtId.TxId).toBe(postFxArgs.conversionRequestId)
      expect(body.CdtTrfTxInf.PmtId.InstrId).toBe(postFxArgs.conversionId)
      expect(body.CdtTrfTxInf.PmtId.EndToEndId).toBe(postFxArgs.determiningTransferId)
    })

    test('should validate ISO PUT /fxQuotes/{id}/error payload, but send error callback due to not existing id in DB', async () => {
      const postFxArgs = generatePostFxArgs()
      const postResponse = await qsClient.postIsoFxQuotes(postFxArgs)
      expect(postResponse.status).toBe(202)
      await sleep(3000)
      const postCallback = await hubClient.getHistory()
      expect(postCallback.data.history.length).toBe(1)
      await hubClient.clearHistory()

      const errorCode = '3100'
      const fspiopPayload = mocks.errorPayloadDto({ errorCode })

      const id = postFxArgs.conversionRequestId
      const from = postFxArgs.initiatingFsp
      const to = postFxArgs.counterPartyFsp
      const response = await qsClient.putErrorIsoFxQuotes(id, fspiopPayload, from, to)
      expect(response.status).toBe(200)
      await sleep(3000)

      const { data } = await hubClient.getHistory()
      expect(data.history.length).toBe(1)
      const { body, headers } = data.history[0]
      expect(headers['content-type']).toContain(ISO_HEADER_PART)
      expect(body.TxInfAndSts.StsRsnInf.Rsn.Cd).toBe(errorCode)
    })

    test('should validate ISO PUT /fxQuotes/{id}/error payload and forward error if quote exists in db', async () => {
      const postFxArgs = generatePostFxArgs()
      const postResponse = await qsClient.postIsoFxQuotes(postFxArgs)
      expect(postResponse.status).toBe(202)
      await sleep(3000)

      const { data: postData } = await hubClient.getHistory()
      expect(postData.history.length).toBe(1)
      const { body: postBody, headers: postHeaders } = postData.history[0]
      expect(postHeaders['content-type']).toContain(ISO_HEADER_PART)
      expect(postBody.CdtTrfTxInf.PmtId.TxId).toBe(postFxArgs.conversionRequestId)
      expect(postBody.CdtTrfTxInf.PmtId.InstrId).toBe(postFxArgs.conversionId)
      expect(postBody.CdtTrfTxInf.PmtId.EndToEndId).toBe(postFxArgs.determiningTransferId)

      await hubClient.clearHistory()

      const fspiopPayload = mocks.errorPayloadDto()
      const isoPayload = (await TransformFacades.FSPIOP.fxQuotes.putError({ body: fspiopPayload })).body
      const response = await qsClient.putErrorFxQuotes(postFxArgs.conversionRequestId, isoPayload, postFxArgs.initiatingFsp, postFxArgs.counterPartyFsp)
      expect(response.status).toBe(200)

      await sleep(3000)

      const { data: putData } = await hubClient.getHistory()
      expect(putData.history.length).toBe(1)
      const { body, headers } = putData.history[0]
      expect(headers['content-type']).toContain(ISO_HEADER_PART)

      expect(body.GrpHdr.MsgId).toBe(isoPayload.GrpHdr.MsgId)
      expect(body.GrpHdr.CreDtTm).toBe(isoPayload.GrpHdr.CreDtTm)
      expect(body.TxInfAndSts.StsRsnInf.Rsn.Cd).toBe(isoPayload.TxInfAndSts.StsRsnInf.Rsn.Cd)
    })
  })
})
