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

 * Eugen Klymniuk <eugen.klymniuk@infitx.com>
 --------------
 **********/

const idGenerator = require('@mojaloop/central-services-shared').Util.id
const { API_TYPES } = require('../../src/constants')
Object.assign(process.env, {
  QUOTE_API_TYPE: API_TYPES.iso20022,
  QUOTE_PORT: '33002'
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
const { TransformFacades, logger } = require('../../src/lib')
const { RESOURCES } = require('../../src/constants')
const serverStart = require('../../src/server')
const mocks = require('../mocks')
const generateULID = idGenerator({ type: 'ulid' })

TransformFacades.FSPIOP.configure({ isTestingMode: true, logger })

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
      resource: RESOURCES.quotes,
      isIsoApi: true
    })

    test('should validate ISO payload for POST /quotes callback', async () => {
      const { body } = await TransformFacades.FSPIOP.quotes.post({
        body: mocks.postQuotesPayloadDto({
          quoteId: generateULID(),
          transactionId: generateULID()
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

    test('should validate ISO payload for PUT /quotes/{id} callback', async () => {
      const { ilpPacket, condition } = mocks.mockIlp4Combo()
      const { body } = await TransformFacades.FSPIOP.quotes.put({
        body: mocks.putQuotesPayloadDto({ ilpPacket, condition }),
        params: { ID: mocks.generateULID() },
        headers
      })
      const request = {
        method: 'PUT',
        url: `/quotes/${mocks.generateULID()}`,
        headers,
        payload: body
      }
      const response = await server.inject(request)
      expect(response.statusCode).toBe(200)
    })

    test('should validate ISO payload for PUT /quotes/{id} callback SDK GP', async () => {
      const payload = {
        CdtTrfTxInf: {
          Cdtr: {
            Id: {
              PrvtId: {
                Othr: {
                  Id: '17039811902',
                  SchmeNm: { Prtry: 'MSISDN' }
                }
              }
            }
          },
          CdtrAgt: {
            FinInstnId: {
              Othr: { Id: 'payeefsp' }
            }
          },
          ChrgBr: 'CRED',
          ChrgsInf: {
            Amt: {
              ActiveOrHistoricCurrencyAndAmount: '0',
              Ccy: 'XXX'
            },
            Agt: {
              FinInstnId: {
                Othr: { Id: 'sourcefsp' }
              }
            }
          },
          Dbtr: {
            Id: {
              PrvtId: {
                Othr: {
                  Id: '17039811901',
                  SchmeNm: { Prtry: 'MSISDN' }
                }
              }
            }
          },
          DbtrAgt: {
            FinInstnId: {
              Othr: { Id: 'payerfsp' }
            }
          },
          IntrBkSttlmAmt: {
            ActiveCurrencyAndAmount: '5',
            Ccy: 'XXX'
          },
          PmtId: {
            TxId: '01JBEH4H1ZFFER80RZ9QJV38AY'
          },
          VrfctnOfTerms: {
            IlpV4PrepPacket: 'DIICpgAAAAAAAAAFMjAyNDEwMzAxMDU3NTQ5OTAcHxvYGqwbG-kxRL7EpwlPRFhZIN3NJM59NCkz3yhHAApnLm1vamFsb29wggJfZXlKeGRXOTBaVWxrSWpvaU1ERktRa1ZJTkVneFdrWkdSVkk0TUZKYU9WRktWak00UVZraUxDSjBjbUZ1YzJGamRHbHZia2xrSWpvaU1ERktRa1ZJTkVneU1ERXpSakJTT1RnMVdFWXdNazVYTTFFaUxDSjBjbUZ1YzJGamRHbHZibFI1Y0dVaU9uc2ljMk5sYm1GeWFXOGlPaUpVVWtGT1UwWkZVaUlzSW1sdWFYUnBZWFJ2Y2lJNklsQkJXVVZTSWl3aWFXNXBkR2xoZEc5eVZIbHdaU0k2SWtKVlUwbE9SVk5USW4wc0luQmhlV1ZsSWpwN0luQmhjblI1U1dSSmJtWnZJanA3SW5CaGNuUjVTV1JVZVhCbElqb2lUVk5KVTBST0lpd2ljR0Z5ZEhsSlpHVnVkR2xtYVdWeUlqb2lNVGN3TXprNE1URTVNRElpTENKbWMzQkpaQ0k2SW5CaGVXVmxabk53SW4xOUxDSndZWGxsY2lJNmV5SndZWEowZVVsa1NXNW1ieUk2ZXlKd1lYSjBlVWxrVkhsd1pTSTZJazFUU1ZORVRpSXNJbkJoY25SNVNXUmxiblJwWm1sbGNpSTZJakUzTURNNU9ERXhPVEF4SWl3aVpuTndTV1FpT2lKd1lYbGxjbVp6Y0NKOWZTd2laWGh3YVhKaGRHbHZiaUk2SWpJd01qUXRNVEF0TXpCVU1UQTZOVGM2TlRRdU9Ua3dXaUlzSW1GdGIzVnVkQ0k2ZXlKaGJXOTFiblFpT2lJMUlpd2lZM1Z5Y21WdVkza2lPaUpZV0ZnaWZYMA'
          }
        },
        GrpHdr: {
          CreDtTm: '2024-10-30T10:56:54.996Z',
          MsgId: '01JBEH4H6K5Z8H2A3N934V8G3C',
          NbOfTxs: '1',
          PmtInstrXpryDtTm: '2024-10-30T10:57:54.990Z',
          SttlmInf: {
            SttlmMtd: 'CLRG'
          }
        }
      }
      const request = {
        method: 'PUT',
        url: `/quotes/${mocks.generateULID()}`,
        headers,
        payload
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
        url: `/quotes/${mocks.generateULID()}/error`,
        headers,
        payload: body
      }
      const response = await server.inject(request)
      expect(response.statusCode).toBe(200)
    })

    test('should validate ISO payload for GET /quotes/{id} callback', async () => {
      const request = {
        method: 'GET',
        url: `/quotes/${mocks.generateULID()}`,
        headers
      }
      const response = await server.inject(request)
      expect(response.statusCode).toBe(202)
    })
  })

  describe('fxQuotes endpoints tests -->', () => {
    const headers = mocks.headersDto({
      resource: 'fxQuotes',
      isIsoApi: true
    })

    test('should validate ISO payload for POST /fxQuotes request', async () => {
      const fspiopPayload = mocks.postFxQuotesPayloadDto()
      const { body } = await TransformFacades.FSPIOP.fxQuotes.post({
        body: fspiopPayload
      })
      const request = {
        method: 'POST',
        url: '/fxQuotes',
        headers,
        payload: body
      }
      const response = await server.inject(request)
      expect(response.statusCode).toBe(202)
    })

    test('should validate ISO payload for PUT /fxQuotes/{id} callback', async () => {
      const fspiopPayload = mocks.putFxQuotesPayloadDto({
        fxQuotesPostPayload: mocks.postFxQuotesPayloadDto(),
        condition: mocks.mockIlp4Combo().condition
      })
      fspiopPayload.conversionTerms.determiningTransferId = mocks.generateULID()
      const { body } = await TransformFacades.FSPIOP.fxQuotes.put({
        body: fspiopPayload,
        params: { ID: mocks.generateULID() }
      })
      const request = {
        method: 'PUT',
        url: `/fxQuotes/${mocks.generateULID()}`,
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

    test('should validate ISO payload for GET /fxQuotes/{id} callback', async () => {
      const request = {
        method: 'GET',
        url: `/fxQuotes/${mocks.generateULID()}`,
        headers
      }
      const response = await server.inject(request)
      expect(response.statusCode).toBe(202)
    })
  })
})
