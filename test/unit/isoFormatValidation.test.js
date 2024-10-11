/*****
 License
 --------------
 Copyright © 2017 Bill & Melinda Gates Foundation
 The Mojaloop files are made available by the Bill & Melinda Gates Foundation under the Apache License, Version 2.0 (the "License") and you may not use these files except in compliance with the License. You may obtain a copy of the License at
 http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, the Mojaloop files are distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.

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
 --------------
 **********/

const { API_TYPES } = require('../../src/constants')
Object.assign(process.env, {
  QUOTE_API_TYPE: API_TYPES.iso20022,
  QUOTE_PORT: '13002'
})

jest.mock('@mojaloop/central-services-stream', () => ({
  Util: {
    Producer: {
      connectAll: jest.fn(),
      disconnect: jest.fn(),
      produceMessage: jest.fn()
    }
  }
}))
jest.mock('../../src/model/quotes')

const { randomUUID } = require('node:crypto')
const { TransformFacades } = require('../../src/lib')
const serverStart = require('../../src/server')
const mocks = require('../mocks')

describe('ISO format validation Tests -->', () => {
  let server

  beforeAll(async () => {
    server = await serverStart()
    expect(server).toBeTruthy()
  })

  afterAll(async () => {
    await server?.stop({ timeout: 100 })
  })

  describe('quotes endpoints tests -->', () => {
    const headers = mocks.headersDto({
      resource: 'quotes',
      isIsoApi: true
    })

    test('should validate ISO payload for POST /quotes callback', async () => {
      const { body } = await TransformFacades.FSPIOP.quotes.post({
        body: mocks.postQuotesPayloadDto({
          quoteId: Date.now(),
          transactionId: Date.now()
        })
      })
      const request = {
        method: 'POST',
        url: '/quotes',
        headers,
        payload: body
      }
      const response = await server.inject(request)
      expect(response.statusCode).toBe(202)
    })

    // todo: unskip after transformerLib is fixed
    test.skip('should validate ISO payload for PUT /quotes/{id} callback', async () => {
      const { body } = await TransformFacades.FSPIOP.quotes.put({
        body: mocks.putQuotesPayloadDto()
      })
      const request = {
        method: 'PUT',
        url: `/quotes/${randomUUID()}`,
        headers,
        payload: body
      }
      const response = await server.inject(request)
      expect(response.statusCode).toBe(200)
    })

    test('should validate ISO payload for PUT /quotes/{id}/error callback', async () => {
      const { body } = await TransformFacades.FSPIOP.quotes.putError({
        body: mocks.errorPayloadDto()
      })
      const request = {
        method: 'PUT',
        url: `/quotes/${randomUUID()}/error`,
        headers,
        payload: body
      }
      const response = await server.inject(request)
      expect(response.statusCode).toBe(200)
    })
  })

  describe('fxQuotes endpoints tests -->', () => {
    const headers = mocks.headersDto({
      resource: 'fxQuotes',
      isIsoApi: true
    })

    test.skip('should validate ISO payload for POST /fxQuotes callback', async () => {
      const fspiopPatload = mocks.postFxQuotesPayloadDto({
        conversionRequestId: Date.now(),
        conversionId: Date.now()
      })
      const { body } = await TransformFacades.FSPIOP.fxQuotes.post({
        body: fspiopPatload
      })
      body.CdtTrfTxInf.PmtId.TxId = '123456778'
      const request = {
        method: 'POST',
        url: '/fxQuotes',
        headers,
        payload: body
      }
      const response = await server.inject(request)
      expect(response.statusCode).toBe(202)
    })

    test.skip('should validate ISO payload for PUT /fxQuotes/{id} callback', async () => {
      const fspiopPayload = mocks.putFxQuotesPayloadDto({
        fxQuotesPostPayload: mocks.postFxQuotesPayloadDto({
          conversionRequestId: Date.now(),
          conversionId: Date.now()
        })
      })
      const { body } = await TransformFacades.FSPIOP.fxQuotes.put({
        body: fspiopPayload
      })
      const request = {
        method: 'PUT',
        url: `/fxQuotes/${randomUUID()}`,
        headers,
        payload: body
      }
      const response = await server.inject(request)
      expect(response.statusCode).toBe(200)
    })

    test('should validate ISO payload for PUT /fxQuotes/{id}/error callback', async () => {
      const { body } = await TransformFacades.FSPIOP.fxQuotes.putError({
        body: mocks.errorPayloadDto()
      })
      const request = {
        method: 'PUT',
        url: `/fxQuotes/${randomUUID()}/error`,
        headers,
        payload: body
      }
      const response = await server.inject(request)
      expect(response.statusCode).toBe(200)
    })
  })
})
