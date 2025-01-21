/*****
 License
 --------------
 Copyright © 2020-2025 Mojaloop Foundation
 The Mojaloop files are made available by the Mojaloop Foundation under the Apache License, Version 2.0 (the "License") and you may not use these files except in compliance with the License. You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, the Mojaloop files are distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.

 Contributors
 --------------
 This is the official list of the Mojaloop project contributors for this file.
 Names of the original copyright holders (individuals or organizations)
 should be listed with a '*' in the first column. People who have
 contributed from an organization can be listed under the organization
 that actually holds the copyright for their contributions (see the
 Mojaloop Foundation for an example). Those individuals should have
 their names indented and be marked with a '-'. Email address can be added
 optionally within square brackets <email>.

 * Mojaloop Foundation
 - Name Surname <name.surname@mojaloop.io>

 --------------
 ******/

const MockIoRedis = require('../../MockIoRedis')
jest.mock('ioredis', () => MockIoRedis)

const { decodePayload } = require('@mojaloop/central-services-shared').Util.StreamingProtocol
const dto = require('../../../src/lib/dto')
const Config = require('../../../src/lib/config')
const { TransformFacades, logger } = require('../../../src/lib')
const { createPayloadCache } = require('../../../src/lib/payloadCache')
const { PAYLOAD_STORAGES } = require('../../../src/constants')
const mocks = require('../../mocks')

TransformFacades.FSPIOP.configure({ isTestingMode: true, logger })

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
      const request = mocks.mockHttpRequest({
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
      const request = mocks.mockHttpRequest({
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
    test('should transform POST /quotes ISO payload to FSPIOP format', async () => {
      const transactionType = mocks.transactionTypeDto({ initiatorType: 'BUSINESS' })
      const postQuotes = mocks.postQuotesPayloadDto({ transactionType })

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
