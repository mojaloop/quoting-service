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
process.env.LOG_LEVEL = 'debug'

const { randomUUID } = require('node:crypto')
const ErrorHandler = require('@mojaloop/central-services-error-handling')
const FxQuotesModel = require('../../../src/model/fxQuotes')
const Config = require('../../../src/lib/config')
const { makeAppInteroperabilityHeader } = require('../../../src/lib/util')
const { HEADERS, RESOURCES } = require('../../../src/constants')

const config = new Config()

describe('FxQuotesModel Tests -->', () => {
  let fxQuotesModel
  let db
  let requestId
  let proxyClient

  const createFxQuotesModel = () => {
    fxQuotesModel = new FxQuotesModel({ db, requestId, proxyClient })
    fxQuotesModel._getParticipantEndpoint = jest.fn(async () => `https://some.endpoint/${Date.now()}`)
    fxQuotesModel.sendHttpRequest = jest.fn(async () => ({ status: 200 }))
    return fxQuotesModel
  }

  beforeEach(() => {
    db = { config } // add needed functionality
    requestId = randomUUID()
    fxQuotesModel = createFxQuotesModel()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('sendErrorCallback method Tests', () => {
    test('should send errorCallback with fspiopSource as hub (flag modifyHeaders === true) [CSI-414]', async () => {
      const apiErrorCode = { code: 2001, message: 'Generic server error' }
      const fspiopError = ErrorHandler.CreateFSPIOPError(apiErrorCode, '', new Error('XXX'))
      const source = `source-${Date.now()}`
      const conversionRequestId = `conversionRequestId-${Date.now()}`
      const headers = {}
      const modifyHeaders = true

      const result = await fxQuotesModel.sendErrorCallback(source, fspiopError, conversionRequestId, headers, null, modifyHeaders)
      expect(result).toBeUndefined()
      expect(fxQuotesModel.sendHttpRequest).toBeCalledTimes(1)
      const [args] = fxQuotesModel.sendHttpRequest.mock.calls[0]
      expect(args.headers[HEADERS.fspiopSource]).toBe(config.hubName)
    })

    test('should set fxQuotes resource in accept and contentType headers (fspiop-source is hub)', async () => {
      const resource = RESOURCES.fxQuotes
      const version = config.protocolVersions.CONTENT.DEFAULT
      const headers = {
        [HEADERS.contentType]: makeAppInteroperabilityHeader(resource, version)
      }
      const source = `source-${Date.now()}`
      const conversionRequestId = `conversionRequestId-${Date.now()}`
      const apiErrorCode = { code: 2001, message: 'Generic server error' }
      const fspiopError = ErrorHandler.CreateFSPIOPError(apiErrorCode, '', new Error('Some error'))

      await fxQuotesModel.sendErrorCallback(source, fspiopError, conversionRequestId, headers, null)
      expect(fxQuotesModel.sendHttpRequest).toBeCalledTimes(1)
      const [args] = fxQuotesModel.sendHttpRequest.mock.calls[0]
      expect(args.headers[HEADERS.contentType]).toBe(headers[HEADERS.contentType])
      expect(args.headers[HEADERS.fspiopSource]).toBe(config.hubName)
    })
  })
})
