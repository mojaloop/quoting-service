const MockIoRedis = require('../../MockIoRedis')
jest.mock('ioredis', () => MockIoRedis)

const { decodePayload } = require('@mojaloop/central-services-shared').Util.StreamingProtocol
const dto = require('../../../src/lib/dto')
const Config = require('../../../src/lib/config')
const { createPayloadCache, TransformFacades } = require('../../../src/lib')
const { PAYLOAD_STORAGES } = require('../../../src/constants')
const mocks = require('../../mocks')
const { mockHttpRequest } = require('../mocks') // todo: combine 2 mocks files

describe('dto Tests -->', () => {
  describe('messageFromRequestDto Tests -->', () => {
    let payloadCache
    let config

    beforeEach(async () => {
      config = new Config()
      const { type, connectionConfig } = config.payloadCache

      payloadCache = createPayloadCache(type, connectionConfig)
      await payloadCache.connect()
      expect(payloadCache.isConnected).toBe(true)
    })

    afterEach(async () => {
      await payloadCache?.disconnect()
    })

    test('should provide empty objects, if no payload, params or span in request', async () => {
      const request = {
        headers: { 'content-type': 'application/json' }
      }
      const message = await dto.messageFromRequestDto({ request, type: 't', action: 'a' })
      expect(message).toBeDefined()
      expect(message.content.uriParams).toEqual({})
      expect(message.content.spanContext).toBeUndefined()
    })

    test('should store PUT /quotes/{id} ISO payload in redis cache', async () => {
      const originalPayloadStorage = PAYLOAD_STORAGES.redis
      const { ilpPacket, condition } = mocks.mockIlp4Combo()
      const putQuotes = mocks.putQuotesPayloadDto({ ilpPacket, condition })
      const isoPayload = await TransformFacades.FSPIOP.quotes.put({
        body: putQuotes,
        params: { ID: mocks.generateULID() },
        headers: mocks.headersDto({ isIsoApi: true })
      })

      const requestId = `requestId-${Date.now()}`
      const request = mockHttpRequest({
        requestId,
        payload: isoPayload.body,
        app: {
          config,
          payloadCache
        }
      })

      const message = await dto.messageFromRequestDto({
        request,
        type: 'quote',
        action: 'put',
        isIsoApi: true,
        originalPayloadStorage,
        payloadCache
      })
      expect(message).toBeTruthy()
      expect(message.content.context.originalRequestId).toBe(requestId)

      const cachedPayload = await payloadCache.getPayload(requestId)
      expect(cachedPayload).toBeTruthy()
      expect(decodePayload(cachedPayload)).toEqual(isoPayload.body)
      expect(decodePayload(message.content.payload)).toEqual(putQuotes)
    })

    test('should store PUT /quotes/{id} ISO payload in kafka message', async () => {
      const originalPayloadStorage = PAYLOAD_STORAGES.kafka
      const putQuotes = mocks.putQuotesPayloadDto(mocks.mockIlp4Combo())
      const isoPayload = await TransformFacades.FSPIOP.quotes.put({
        body: putQuotes,
        params: { ID: mocks.generateULID() },
        headers: mocks.headersDto({ isIsoApi: true })
      })

      const requestId = `requestId-${Date.now()}`
      const request = mockHttpRequest({
        requestId,
        payload: isoPayload.body,
        app: { config }
      })

      const message = await dto.messageFromRequestDto({
        request,
        type: 'quote',
        action: 'put',
        isIsoApi: true,
        originalPayloadStorage
      })

      expect(message.content).toBeTruthy()
      const { originalRequestPayload } = message.content.context
      expect(typeof originalRequestPayload).toBe('string')
      expect(decodePayload(originalRequestPayload)).toEqual(isoPayload.body)
    })
  })

  describe('transformPayloadToFspiopDto Tests -->', () => {
    test.skip('should transform POST /quotes ISO payload to FSPIOP format', async () => {
      const postQuotes = mocks.postQuotesPayloadDto()

      const { body: isoPayload } = await TransformFacades.FSPIOP.quotes.post({ body: postQuotes })

      const fspiopPayload = await dto.transformPayloadToFspiopDto(isoPayload, 'quote', 'post')
      expect(fspiopPayload).toEqual(postQuotes)
    })

    test('should transform PUT /quotes/{id} ISO payload to FSPIOP format', async () => {
      const { ilpPacket, condition } = mocks.mockIlp4Combo()
      const putQuotes = mocks.putQuotesPayloadDto({ ilpPacket, condition })

      const { body: isoPayload } = await TransformFacades.FSPIOP.quotes.put({
        body: putQuotes,
        params: { ID: mocks.generateULID() },
        headers: mocks.headersDto({ isIsoApi: true })
      })

      const fspiopPayload = await dto.transformPayloadToFspiopDto(isoPayload, 'quote', 'put')
      expect(fspiopPayload).toEqual(putQuotes)
    })

    test('should transform PUT /quotes/{id}/error ISO payload to FSPIOP format', async () => {
      const putErrorQuotes = mocks.errorPayloadDto()

      const { body: isoPayload } = await TransformFacades.FSPIOP.quotes.putError({ body: putErrorQuotes })

      const fspiopPayload = await dto.transformPayloadToFspiopDto(isoPayload, 'quote', 'put', true)
      expect(fspiopPayload).toEqual(putErrorQuotes)
    })

    test('should transform POST /fxQuotes ISO payload to FSPIOP format', async () => {
      const postFxQuotes = mocks.postFxQuotesPayloadDto({ extensionList: null })

      const { body: isoPayload } = await TransformFacades.FSPIOP.fxQuotes.post({ body: postFxQuotes })

      const fspiopPayload = await dto.transformPayloadToFspiopDto(isoPayload, 'fx-quote', 'post')
      expect(fspiopPayload).toEqual(postFxQuotes)
    })
  })
})
