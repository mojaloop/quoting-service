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
 * Steven Oderayi <steven.oderayi@infitx.com>
 --------------
 **********/
process.env.LOG_LEVEL = 'debug'

const { randomUUID } = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')
const axios = require('axios')

jest.mock('axios')
axios.create = jest.fn(() => axios)

const ErrorHandler = require('@mojaloop/central-services-error-handling')
const ENUM = require('@mojaloop/central-services-shared').Enum
const { FSPIOPError } = require('@mojaloop/central-services-error-handling/src/factory')
const Metrics = require('@mojaloop/central-services-metrics')

const FxQuotesModel = require('../../../src/model/fxQuotes')
const { createDeps } = require('../../../src/model/deps')
const Config = require('../../../src/lib/config')
const LOCAL_ENUM = require('../../../src/lib/enum')
const { logger } = require('../../../src/lib')
const { makeAppInteroperabilityHeader } = require('../../../src/lib/util')
const { HEADERS, RESOURCES, ERROR_MESSAGES } = require('../../../src/constants')
const { fxQuoteMocks } = require('../../mocks')

Metrics.setup(new Config().instrumentationMetricsConfig)

describe('FxQuotesModel Tests -->', () => {
  let fxQuotesModel
  let db
  let proxyClient
  let requestId
  let envConfig
  let httpRequest
  let log
  let deps

  let headers
  let conversionRequestId
  let request
  let updateRequest
  let span
  let childSpan
  let mockEndpoint
  let destination

  const endpointType = ENUM.EndPoints.FspEndpointTypes.FSPIOP_CALLBACK_URL_FX_QUOTES

  beforeEach(() => {
    db = fxQuoteMocks.db()
    proxyClient = fxQuoteMocks.proxyClient()
    requestId = randomUUID()
    envConfig = new Config()
    httpRequest = jest.fn().mockResolvedValue({ status: 200 })
    log = logger.child({ test: 'fxQuotesModel' })
    deps = createDeps({ db, proxyClient, requestId, envConfig, httpRequest, log })

    headers = fxQuoteMocks.headers()
    request = fxQuoteMocks.fxQuoteRequest()
    conversionRequestId = request.conversionRequestId
    updateRequest = fxQuoteMocks.fxQuoteUpdateRequest()
    span = fxQuoteMocks.span()
    childSpan = span.getChild()
    mockEndpoint = 'https://some.endpoint'
    destination = fxQuoteMocks.destination
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('constructor', () => {
    test('should create an instance of FXQuotesModel', async () => {
      const fxQuotesModel = new FxQuotesModel(deps)
      expect(fxQuotesModel).toBeInstanceOf(FxQuotesModel)
      expect(fxQuotesModel.db).toBe(db)
      expect(fxQuotesModel.proxyClient).toBe(proxyClient)
      expect(fxQuotesModel.requestId).toBe(requestId)
      expect(fxQuotesModel.envConfig).toEqual(envConfig)
      expect(fxQuotesModel.httpRequest).toEqual(httpRequest)
      expect(fxQuotesModel.log).toBeDefined()
    })
  })

  describe('validateFxQuoteRequest', () => {
    test('should not function correctly with proxy cache disabled', async () => {
      deps.proxyClient = undefined
      fxQuotesModel = new FxQuotesModel(deps)

      await expect(fxQuotesModel.validateFxQuoteRequest(destination, request)).resolves.toBeUndefined()

      expect(db.getParticipant).toBeCalledTimes(2)
      expect(db.getParticipant).toHaveBeenNthCalledWith(1, destination, LOCAL_ENUM.COUNTERPARTY_FSP, 'ZMW', ENUM.Accounts.LedgerAccountType.POSITION)
      expect(db.getParticipant).toHaveBeenNthCalledWith(2, destination, LOCAL_ENUM.COUNTERPARTY_FSP, 'TZS', ENUM.Accounts.LedgerAccountType.POSITION)
    })

    test('should not validate participant if proxy cache returns a proxy', async () => {
      proxyClient.isConnected = false
      fxQuotesModel = new FxQuotesModel(deps)

      await expect(fxQuotesModel.validateFxQuoteRequest(destination, request)).resolves.toBeUndefined()

      expect(proxyClient.lookupProxyByDfspId).toBeCalledTimes(1)
      expect(db.getParticipant).not.toHaveBeenCalled()
    })

    test('should validate participant if proxy cache returns no proxy', async () => {
      proxyClient.lookupProxyByDfspId = jest.fn().mockResolvedValue(undefined)
      fxQuotesModel = new FxQuotesModel(deps)

      await expect(fxQuotesModel.validateFxQuoteRequest(destination, request)).resolves.toBeUndefined()

      expect(proxyClient.lookupProxyByDfspId).toBeCalledTimes(1)
      expect(db.getParticipant).toBeCalledTimes(2)
    })

    test('should throw error if participant validation fails', async () => {
      proxyClient.lookupProxyByDfspId = jest.fn().mockResolvedValue(undefined)
      db.getParticipant = jest.fn().mockRejectedValue(new Error('DB Error'))
      fxQuotesModel = new FxQuotesModel(deps)

      await expect(fxQuotesModel.validateFxQuoteRequest(destination, request)).rejects.toThrow()

      expect(proxyClient.lookupProxyByDfspId).toBeCalledTimes(1)
      expect(db.getParticipant).toBeCalledTimes(2)
    })
  })

  describe('handleFxQuoteRequest', () => {
    test('should handle fx quote request', async () => {
      deps.libUtil.fetchParticipantInfo = jest.fn(() => ({ payer: 'payer', payee: 'payee' }))
      fxQuotesModel = new FxQuotesModel(deps)
      jest.spyOn(fxQuotesModel, 'forwardFxQuoteRequest').mockResolvedValue()
      jest.spyOn(fxQuotesModel, 'validateFxQuoteRequest')

      await expect(fxQuotesModel.handleFxQuoteRequest(headers, request, span, request)).resolves.toBeUndefined()

      expect(fxQuotesModel.validateFxQuoteRequest).toBeCalledWith(headers['fspiop-destination'], request)
      expect(fxQuotesModel.forwardFxQuoteRequest).toBeCalledWith(headers, request, request, span.getChild())
    })

    test('should throw error if request is a duplicate', async () => {
      fxQuotesModel = new FxQuotesModel(deps)
      fxQuotesModel.envConfig.simpleRoutingMode = false
      jest.spyOn(fxQuotesModel, 'checkDuplicateFxQuoteRequest').mockResolvedValue({
        isResend: false,
        isDuplicateId: true
      })
      jest.spyOn(fxQuotesModel, 'handleException')

      await expect(fxQuotesModel.handleFxQuoteRequest(headers, request, span)).resolves.toBeUndefined()
      expect(fxQuotesModel.handleException).toBeCalled()
    })

    test('should handle resends', async () => {
      fxQuotesModel = new FxQuotesModel(deps)
      fxQuotesModel.envConfig.simpleRoutingMode = false
      jest.spyOn(fxQuotesModel, 'handleFxQuoteRequestResend')
      jest.spyOn(fxQuotesModel, 'forwardFxQuoteRequest')
      jest.spyOn(fxQuotesModel, 'checkDuplicateFxQuoteRequest').mockResolvedValue({
        isResend: true,
        isDuplicateId: true
      })

      await expect(fxQuotesModel.handleFxQuoteRequest(headers, request, span)).resolves.toBeUndefined()
      expect(fxQuotesModel.handleFxQuoteRequestResend).toBeCalled()
      expect(fxQuotesModel.forwardFxQuoteRequest).toBeCalled()
    })

    test('should handle fx quote request in persistent mode', async () => {
      deps.libUtil.fetchParticipantInfo = jest.fn(() => ({ payer: 'payer', payee: 'payee' }))
      fxQuotesModel = new FxQuotesModel(deps)
      fxQuotesModel.envConfig.simpleRoutingMode = false

      jest.spyOn(fxQuotesModel, 'checkDuplicateFxQuoteRequest').mockResolvedValue({
        isResend: false,
        isDuplicateId: false
      })
      jest.spyOn(fxQuotesModel, 'forwardFxQuoteRequest').mockResolvedValue()
      jest.spyOn(db, 'createFxQuote').mockResolvedValue({
        fxQuoteId: 1
      })
      jest.spyOn(db, 'createFxQuoteConversionTerms')
      jest.spyOn(db, 'createFxQuoteConversionTermsExtension')
      jest.spyOn(db, 'createFxQuoteDuplicateCheck')

      await expect(fxQuotesModel.handleFxQuoteRequest(headers, request, span, request)).resolves.toBeUndefined()

      expect(fxQuotesModel.forwardFxQuoteRequest).toBeCalledWith(headers, request, request, span.getChild())
      expect(db.createFxQuote).toBeCalled()
      expect(db.createFxQuoteConversionTerms).toBeCalled()
      expect(db.createFxQuoteConversionTermsExtension).toBeCalled()
      expect(db.createFxQuoteDuplicateCheck).toBeCalled()
    })

    test('it should rollback db changes on error in persistent mode', async () => {
      fxQuotesModel = new FxQuotesModel(deps)
      fxQuotesModel.envConfig.simpleRoutingMode = false

      jest.spyOn(fxQuotesModel, 'checkDuplicateFxQuoteRequest').mockResolvedValue({
        isResend: false,
        isDuplicateId: false
      })
      jest.spyOn(fxQuotesModel, 'forwardFxQuoteRequest').mockResolvedValue()
      jest.spyOn(db, 'createFxQuote').mockRejectedValue(new Error('DB Error'))

      await expect(fxQuotesModel.handleFxQuoteRequest(headers, request, span)).resolves.toBeUndefined()
      expect(db.rollback).toBeCalled()
    })

    test('should handle error thrown', async () => {
      deps.libUtil.fetchParticipantInfo = jest.fn(() => ({ payer: 'payer', payee: 'payee' }))
      fxQuotesModel = new FxQuotesModel(deps)
      jest.spyOn(fxQuotesModel, 'forwardFxQuoteRequest').mockRejectedValue(new Error('Forward Error'))
      jest.spyOn(fxQuotesModel, 'validateFxQuoteRequest')
      jest.spyOn(fxQuotesModel, 'handleException').mockResolvedValue()

      await expect(fxQuotesModel.handleFxQuoteRequest(headers, request, span, request))
        .resolves.toBeUndefined()

      expect(fxQuotesModel.validateFxQuoteRequest).toBeCalledWith(headers['fspiop-destination'], request)
      expect(fxQuotesModel.forwardFxQuoteRequest).toBeCalledWith(headers, request, request, span.getChild())
      expect(fxQuotesModel.handleException).toBeCalledWith(headers['fspiop-source'], request.conversionRequestId, expect.any(Error), headers, span.getChild())
      expect(span.getChild().finish).toBeCalledTimes(1)
    })
  })

  describe('forwardFxQuoteRequest', () => {
    test('should forward fx quote request', async () => {
      fxQuotesModel = new FxQuotesModel(deps)
      fxQuotesModel._getParticipantEndpoint = jest.fn().mockResolvedValue(mockEndpoint)

      await expect(fxQuotesModel.forwardFxQuoteRequest(headers, request, request, childSpan)).resolves.toBeUndefined()

      const expectedHeaders = {
        Accept: headers.accept,
        'Content-Type': headers['content-type'],
        'FSPIOP-Source': headers['fspiop-source'],
        'FSPIOP-Destination': headers['fspiop-destination'],
        Date: headers.date
      }
      expect(httpRequest).toHaveBeenCalledWith({
        headers: expectedHeaders,
        method: ENUM.Http.RestMethods.POST,
        url: `${mockEndpoint}${ENUM.EndPoints.FspEndpointTemplates.FX_QUOTES_POST}`,
        data: expect.objectContaining(request)
      }, headers['fspiop-source'])
    })

    test('should forward quote request to proxy', async () => {
      const mockProxyEndpoint = 'https://proxy.endpoint'
      const mockProxy = 'mockProxy'

      proxyClient.lookupProxyByDfspId = jest.fn().mockResolvedValue(mockProxy)
      db.getParticipantEndpoint = jest.fn().mockImplementation((fspId, _endpointType) => {
        if (fspId === destination) return null
        if (fspId === mockProxy) return mockProxyEndpoint
        return 'https://some.other.endpoint'
      })

      fxQuotesModel = new FxQuotesModel(deps)
      await expect(fxQuotesModel.forwardFxQuoteRequest(headers, request, request, childSpan)).resolves.toBeUndefined()

      expect(httpRequest).toBeCalled()
      expect(proxyClient.lookupProxyByDfspId).toBeCalledTimes(1)
      expect(db.getParticipantEndpoint).toBeCalledTimes(2)
      expect(db.getParticipantEndpoint).toHaveBeenNthCalledWith(1, destination, endpointType)
      expect(db.getParticipantEndpoint).toHaveBeenNthCalledWith(2, mockProxy, endpointType)
    })

    test('should format error thrown and re-throw', async () => {
      httpRequest.mockRejectedValue(new Error('HTTP Error'))

      fxQuotesModel = new FxQuotesModel(deps)
      fxQuotesModel._getParticipantEndpoint = jest.fn().mockResolvedValue(undefined)

      await expect(fxQuotesModel.forwardFxQuoteRequest(headers, conversionRequestId, request, childSpan)).rejects.toThrow(FSPIOPError)
    })
  })

  describe('handleFxQuoteUpdate', () => {
    test('headers should not contain accept property', async () => {
      fxQuotesModel = new FxQuotesModel(deps)
      jest.spyOn(fxQuotesModel, 'forwardFxQuoteUpdate').mockResolvedValue()
      jest.spyOn(fxQuotesModel, 'handleException').mockResolvedValue()

      await expect(fxQuotesModel.handleFxQuoteUpdate(headers, conversionRequestId, updateRequest, span)).resolves.toBeUndefined()

      expect(fxQuotesModel.forwardFxQuoteUpdate).not.toBeCalled()
      expect(fxQuotesModel.handleException).toBeCalledWith(headers['fspiop-source'], conversionRequestId, expect.any(Error), headers, span.getChild())
    })

    test('should throw error if request is a duplicate', async () => {
      delete headers.accept

      fxQuotesModel = new FxQuotesModel(deps)
      fxQuotesModel.envConfig.simpleRoutingMode = false
      jest.spyOn(fxQuotesModel, 'checkDuplicateFxQuoteResponse').mockResolvedValue({
        isResend: false,
        isDuplicateId: true
      })
      jest.spyOn(fxQuotesModel, 'handleException')

      await expect(fxQuotesModel.handleFxQuoteUpdate(headers, conversionRequestId, updateRequest, span)).resolves.toBeUndefined()
      expect(fxQuotesModel.handleException).toBeCalled()
    })

    test('should handle resends', async () => {
      delete headers.accept

      fxQuotesModel = new FxQuotesModel(deps)
      fxQuotesModel.envConfig.simpleRoutingMode = false
      jest.spyOn(fxQuotesModel, 'handleFxQuoteUpdateResend')
      jest.spyOn(fxQuotesModel, 'forwardFxQuoteUpdate')
      jest.spyOn(fxQuotesModel, 'checkDuplicateFxQuoteResponse').mockResolvedValue({
        isResend: true,
        isDuplicateId: true
      })

      await expect(fxQuotesModel.handleFxQuoteUpdate(headers, conversionRequestId, updateRequest, span)).resolves.toBeUndefined()
      expect(fxQuotesModel.handleFxQuoteUpdateResend).toBeCalled()
      expect(fxQuotesModel.forwardFxQuoteUpdate).toBeCalled()
    })

    test('should handle fx quote update in persistent mode', async () => {
      delete headers.accept

      fxQuotesModel = new FxQuotesModel(deps)
      fxQuotesModel.envConfig.simpleRoutingMode = false

      jest.spyOn(fxQuotesModel, 'checkDuplicateFxQuoteResponse').mockResolvedValue({
        isResend: false,
        isDuplicateId: false
      })
      jest.spyOn(fxQuotesModel, 'forwardFxQuoteUpdate').mockResolvedValue()
      jest.spyOn(db, 'createFxQuoteResponse').mockResolvedValue({
        fxQuoteResponseId: 1
      })
      jest.spyOn(db, 'createFxQuoteResponseFxCharge')
      jest.spyOn(db, 'createFxQuoteResponseConversionTerms')
      jest.spyOn(db, 'createFxQuoteResponseConversionTermsExtension')
      jest.spyOn(db, 'createFxQuoteResponseDuplicateCheck')

      await expect(fxQuotesModel.handleFxQuoteUpdate(headers, conversionRequestId, updateRequest, span, updateRequest))
        .resolves.toBeUndefined()

      expect(fxQuotesModel.forwardFxQuoteUpdate).toBeCalledWith(headers, conversionRequestId, updateRequest, updateRequest, span.getChild())
      expect(db.createFxQuoteResponse).toBeCalled()
      expect(db.createFxQuoteResponseFxCharge).toBeCalled()
      expect(db.createFxQuoteResponseConversionTerms).toBeCalled()
      expect(db.createFxQuoteResponseConversionTermsExtension).toBeCalled()
      expect(db.createFxQuoteResponseDuplicateCheck).toBeCalled()
    })

    test('it should rollback db changes on error in persistent mode', async () => {
      delete headers.accept

      fxQuotesModel = new FxQuotesModel(deps)
      fxQuotesModel.envConfig.simpleRoutingMode = false

      jest.spyOn(fxQuotesModel, 'checkDuplicateFxQuoteResponse').mockResolvedValue({
        isResend: false,
        isDuplicateId: false
      })
      jest.spyOn(fxQuotesModel, 'forwardFxQuoteUpdate').mockResolvedValue()
      jest.spyOn(db, 'createFxQuoteResponse').mockRejectedValue(new Error('DB Error'))

      await expect(fxQuotesModel.handleFxQuoteUpdate(headers, conversionRequestId, updateRequest, span, updateRequest)).resolves.toBeUndefined()
      expect(db.rollback).toBeCalled()
    })
  })

  describe('forwardFxQuoteUpdate', () => {
    test('should forward fx quote update', async () => {
      fxQuotesModel = new FxQuotesModel(deps)
      jest.spyOn(fxQuotesModel, '_getParticipantEndpoint').mockResolvedValue(mockEndpoint)

      await expect(fxQuotesModel.forwardFxQuoteUpdate(headers, conversionRequestId, updateRequest, updateRequest, childSpan)).resolves.toBeUndefined()

      expect(httpRequest).toHaveBeenCalledWith({
        headers: {
          'Content-Type': headers['content-type'],
          'FSPIOP-Source': headers['fspiop-source'],
          'FSPIOP-Destination': headers['fspiop-destination'],
          Date: headers.date
        },
        method: ENUM.Http.RestMethods.PUT,
        url: `${mockEndpoint}/fxQuotes/${conversionRequestId}`,
        data: expect.objectContaining(updateRequest)
      }, headers['fspiop-source'])
    })

    test('should send error callback if no endpoint found', async () => {
      fxQuotesModel = new FxQuotesModel(deps)
      jest.spyOn(fxQuotesModel, '_getParticipantEndpoint').mockResolvedValue(undefined)
      jest.spyOn(fxQuotesModel, 'sendErrorCallback').mockResolvedValue()

      await expect(fxQuotesModel.forwardFxQuoteUpdate(headers, updateRequest.conversionRequestId, updateRequest, updateRequest, childSpan)).resolves.toBeUndefined()
      expect(fxQuotesModel.sendErrorCallback).toBeCalledWith(headers['fspiop-source'], expect.any(Error), updateRequest.conversionRequestId, headers, childSpan, true)
      expect(httpRequest).not.toBeCalled()
    })

    test('should format error thrown and re-throw', async () => {
      deps.httpRequest = jest.fn().mockRejectedValue(new Error('HTTP Error'))

      fxQuotesModel = new FxQuotesModel(deps)
      fxQuotesModel._getParticipantEndpoint = jest.fn().mockResolvedValue(mockEndpoint)

      await expect(fxQuotesModel.forwardFxQuoteUpdate(headers, updateRequest.conversionRequestId, updateRequest, updateRequest, childSpan))
        .rejects.toThrow(FSPIOPError)
    })

    test('should rethrow error if metrics is disabled', async () => {
      deps.httpRequest = jest.fn().mockRejectedValue(new Error('HTTP Error'))

      fxQuotesModel = new FxQuotesModel(deps)
      fxQuotesModel._getParticipantEndpoint = jest.fn().mockResolvedValue(mockEndpoint)
      fxQuotesModel.envConfig.instrumentationMetricsDisabled = true

      await expect(fxQuotesModel.forwardFxQuoteUpdate(headers, conversionRequestId, updateRequest, updateRequest, childSpan))
        .rejects.toThrow()
    })
  })

  describe('handleFxQuoteGet', () => {
    test('should handle fx quote get', async () => {
      fxQuotesModel = new FxQuotesModel(deps)
      jest.spyOn(fxQuotesModel, 'forwardFxQuoteGet').mockResolvedValue()
      jest.spyOn(fxQuotesModel, 'handleException').mockResolvedValue()

      await expect(fxQuotesModel.handleFxQuoteGet(headers, conversionRequestId, span)).resolves.toBeUndefined()

      expect(fxQuotesModel.forwardFxQuoteGet).toBeCalledWith(headers, conversionRequestId, span.getChild())
      expect(fxQuotesModel.handleException).not.toBeCalled()
    })

    test('should handle error thrown', async () => {
      fxQuotesModel = new FxQuotesModel(deps)
      jest.spyOn(fxQuotesModel, 'forwardFxQuoteGet').mockRejectedValue(new Error('Forward Error'))
      jest.spyOn(fxQuotesModel, 'handleException').mockResolvedValue()

      await expect(fxQuotesModel.handleFxQuoteGet(headers, conversionRequestId, span)).resolves.toBeUndefined()

      expect(fxQuotesModel.forwardFxQuoteGet).toBeCalledWith(headers, conversionRequestId, span.getChild())
      expect(fxQuotesModel.handleException).toBeCalledWith(headers['fspiop-source'], conversionRequestId, expect.any(Error), headers, span.getChild())
    })
  })

  describe('forwardFxQuoteGet', () => {
    test('should forward fx quote get', async () => {
      fxQuotesModel = new FxQuotesModel(deps)
      jest.spyOn(fxQuotesModel, '_getParticipantEndpoint').mockResolvedValue(mockEndpoint)

      await expect(fxQuotesModel.forwardFxQuoteGet(headers, conversionRequestId, childSpan)).resolves.toBeUndefined()

      expect(httpRequest).toHaveBeenCalledWith({
        headers: {
          Accept: headers.accept,
          'Content-Type': headers['content-type'],
          'FSPIOP-Source': headers['fspiop-source'],
          'FSPIOP-Destination': headers['fspiop-destination'],
          Date: headers.date
        },
        method: ENUM.Http.RestMethods.GET,
        url: `${mockEndpoint}/fxQuotes/${conversionRequestId}`
      }, headers['fspiop-source'])
    })

    test('should format error thrown and re-throw', async () => {
      fxQuotesModel = new FxQuotesModel(deps)
      fxQuotesModel._getParticipantEndpoint = jest.fn().mockResolvedValue(undefined)

      await expect(fxQuotesModel.forwardFxQuoteGet(headers, conversionRequestId, updateRequest, childSpan)).rejects.toThrow(FSPIOPError)
    })

    test('should rethrow error if metrics is disabled', async () => {
      fxQuotesModel = new FxQuotesModel(deps)
      fxQuotesModel._getParticipantEndpoint = jest.fn().mockResolvedValue(mockEndpoint)
      fxQuotesModel.envConfig.instrumentationMetricsDisabled = true

      await expect(fxQuotesModel.forwardFxQuoteGet(headers, conversionRequestId, updateRequest, childSpan)).rejects.toThrow()
    })
  })

  describe('handleFxQuoteError', () => {
    test('should handle fx quote error', async () => {
      fxQuotesModel = new FxQuotesModel(deps)
      jest.spyOn(fxQuotesModel, 'sendErrorCallback').mockResolvedValue()

      const error = { errorCode: '3201', errorDescription: 'Destination FSP error' }
      await expect(fxQuotesModel.handleFxQuoteError(headers, conversionRequestId, error, span, error)).resolves.toBeUndefined()

      const fspiopError = ErrorHandler.CreateFSPIOPErrorFromErrorInformation(error)
      expect(fxQuotesModel.sendErrorCallback).toBeCalledWith(headers['fspiop-destination'], fspiopError, conversionRequestId, headers, childSpan, false, error)
    })

    test('should handle fx quote error in persistent mode', async () => {
      fxQuotesModel = new FxQuotesModel(deps)
      fxQuotesModel.envConfig.simpleRoutingMode = false
      jest.spyOn(fxQuotesModel, 'sendErrorCallback').mockResolvedValue()
      jest.spyOn(db, 'createFxQuoteError')

      const error = { errorCode: '3201', errorDescription: 'Destination FSP error' }
      await expect(fxQuotesModel.handleFxQuoteError(headers, conversionRequestId, error, span, error)).resolves.toBeUndefined()

      const fspiopError = ErrorHandler.CreateFSPIOPErrorFromErrorInformation(error)
      expect(fxQuotesModel.sendErrorCallback).toBeCalledWith(headers['fspiop-destination'], fspiopError, conversionRequestId, headers, childSpan, false, error)
      expect(db.createFxQuoteError).toBeCalledWith(expect.anything(), conversionRequestId, {
        errorCode: Number(error.errorCode),
        errorDescription: error.errorDescription
      })
    })

    test('should handle error thrown in persistent mode', async () => {
      fxQuotesModel = new FxQuotesModel(deps)
      fxQuotesModel.envConfig.simpleRoutingMode = false
      jest.spyOn(fxQuotesModel, 'sendErrorCallback').mockResolvedValue()
      jest.spyOn(db, 'createFxQuoteError').mockRejectedValue(new Error('DB Error'))

      const error = { errorCode: '3201', errorDescription: 'Destination FSP error' }
      await expect(fxQuotesModel.handleFxQuoteError(headers, conversionRequestId, error, span)).resolves.toBeUndefined()
      expect(db.rollback).toBeCalled()
    })

    test('should handle error thrown', async () => {
      fxQuotesModel = new FxQuotesModel(deps)
      jest.spyOn(fxQuotesModel, 'sendErrorCallback').mockRejectedValue(new Error('Send Error Callback Error'))
      jest.spyOn(fxQuotesModel, 'handleException').mockResolvedValue()

      const error = { errorCode: '3201', errorDescription: 'Destination FSP error' }
      await expect(fxQuotesModel.handleFxQuoteError(headers, conversionRequestId, error, span, error)).resolves.toBeUndefined()

      const fspiopError = ErrorHandler.CreateFSPIOPErrorFromErrorInformation(error)
      expect(fxQuotesModel.sendErrorCallback).toBeCalledWith(headers['fspiop-destination'], fspiopError, conversionRequestId, headers, childSpan, false, error)
      expect(fxQuotesModel.handleException).toBeCalledWith(headers['fspiop-source'], conversionRequestId, expect.any(Error), headers, childSpan)
    })
  })

  describe('handleFxQuoteRequestResend', () => {
    test('should handle fx quote request resend', async () => {
      fxQuotesModel = new FxQuotesModel(deps)
      jest.spyOn(fxQuotesModel, 'forwardFxQuoteRequest').mockResolvedValue()

      await expect(fxQuotesModel.handleFxQuoteRequestResend(headers, request, span, request)).resolves.toBeUndefined()

      expect(fxQuotesModel.forwardFxQuoteRequest).toBeCalledWith(headers, request.conversionRequestId, request, span.getChild())
    })

    test('should handle error thrown', async () => {
      fxQuotesModel = new FxQuotesModel(deps)
      jest.spyOn(fxQuotesModel, 'forwardFxQuoteRequest').mockRejectedValue(new Error('Forward Error'))
      jest.spyOn(fxQuotesModel, 'handleException').mockResolvedValue()

      await expect(fxQuotesModel.handleFxQuoteRequestResend(headers, request, span, request)).resolves.toBeUndefined()

      expect(fxQuotesModel.forwardFxQuoteRequest).toBeCalledWith(headers, request.conversionRequestId, request, span.getChild())
      expect(fxQuotesModel.handleException).toBeCalledWith(headers['fspiop-source'], request.conversionRequestId, expect.any(Error), headers, span.getChild())
    })

    test('should rethrow internal errors', async () => {
      fxQuotesModel = new FxQuotesModel(deps)
      const error = new Error('Span Error')
      jest.spyOn(span, 'getChild').mockImplementation(() => { throw error })
      const logError = jest.spyOn(fxQuotesModel.log, 'error')

      await expect(fxQuotesModel.handleFxQuoteRequestResend(headers, request, span, request))
        .rejects.toThrow()
      expect(logError).toBeCalledWith(expect.any(String), error)
    })
  })

  describe('handleFxQuoteUpdateResend', () => {
    test('should handle fx quote update resend', async () => {
      fxQuotesModel = new FxQuotesModel(deps)
      jest.spyOn(fxQuotesModel, 'forwardFxQuoteUpdate').mockResolvedValue()

      await expect(fxQuotesModel.handleFxQuoteUpdateResend(headers, request.conversionRequestId, request, request, span)).resolves.toBeUndefined()

      expect(fxQuotesModel.forwardFxQuoteUpdate).toBeCalledWith(headers, request.conversionRequestId, request, request, span.getChild())
    })

    test('should handle error thrown', async () => {
      fxQuotesModel = new FxQuotesModel(deps)
      jest.spyOn(fxQuotesModel, 'forwardFxQuoteUpdate').mockRejectedValue(new Error('Forward Error'))
      jest.spyOn(fxQuotesModel, 'handleException').mockResolvedValue()

      await expect(fxQuotesModel.handleFxQuoteUpdateResend(headers, request.conversionRequestId, request, request, span)).resolves.toBeUndefined()

      expect(fxQuotesModel.forwardFxQuoteUpdate).toBeCalledWith(headers, request.conversionRequestId, request, request, span.getChild())
      expect(fxQuotesModel.handleException).toBeCalledWith(headers['fspiop-source'], request.conversionRequestId, expect.any(Error), headers, span.getChild())
    })

    test('should rethrow internal errors', async () => {
      fxQuotesModel = new FxQuotesModel(deps)
      jest.spyOn(span, 'getChild').mockImplementation(() => { throw new Error('Span Error') })
      const logError = jest.spyOn(fxQuotesModel.log, 'error')

      await expect(fxQuotesModel.handleFxQuoteUpdateResend(headers, request.conversionRequestId, request, span)).rejects.toThrow()
      expect(logError).toBeCalledWith(expect.any(String), expect.any(Error))
    })
  })

  describe('handleException', () => {
    test('should handle exception', async () => {
      fxQuotesModel = new FxQuotesModel(deps)
      jest.spyOn(fxQuotesModel, 'sendErrorCallback').mockResolvedValue()

      const error = new Error('Test Error')
      await expect(fxQuotesModel.handleException(headers['fspiop-source'], conversionRequestId, error, headers, span)).resolves.toBeUndefined()

      const fspiopError = ErrorHandler.ReformatFSPIOPError(error)
      expect(fxQuotesModel.sendErrorCallback).toBeCalledWith(headers['fspiop-source'], fspiopError, conversionRequestId, headers, childSpan, true)
    })

    test('should handle error thrown', async () => {
      const error = new Error('Send Error Callback Error')
      fxQuotesModel = new FxQuotesModel(deps)
      jest.spyOn(fxQuotesModel, 'sendErrorCallback').mockRejectedValue(error)
      const logError = jest.spyOn(log.mlLogger, 'error')

      await expect(fxQuotesModel.handleException(headers['fspiop-source'], conversionRequestId, error, headers, span)).resolves.toBeUndefined()

      const fspiopError = ErrorHandler.ReformatFSPIOPError(error)
      expect(fxQuotesModel.sendErrorCallback).toBeCalledWith(headers['fspiop-source'], fspiopError, conversionRequestId, headers, childSpan, true)
      expect(logError.mock.lastCall[1].message).toBe(error.message)
    })
  })

  describe('checkDuplicateFxQuoteRequest', () => {
    test('should return isResend false, isDuplicateId true, if ids are same but hashes dont match', async () => {
      const fxQuoteRequest = { conversionRequestId: 1 }
      const duplicateFxQuoteRequest = { conversionRequestId: 1, hash: '481bd172c6dbfba81e8f864332eb0350d1bea77bdf33e9db196efdb1bbb4668' }
      fxQuotesModel.db.getFxQuoteDuplicateCheck = jest.fn().mockResolvedValue(duplicateFxQuoteRequest)

      expect(await fxQuotesModel.checkDuplicateFxQuoteRequest(fxQuoteRequest)).toStrictEqual({
        isResend: false,
        isDuplicateId: true
      })
    })

    test('should return isResend true, isDuplicateId true, if ids are same and hashes match', async () => {
      const fxQuoteRequest = { conversionRequestId: 1 }
      const duplicateFxQuoteRequest = { conversionRequestId: 1, hash: '481bd172c6dbfba81e8f864332eb0350d1bea77bdf33e9db196efdb1bbb4668d' }
      fxQuotesModel.db.getFxQuoteDuplicateCheck = jest.fn().mockResolvedValue(duplicateFxQuoteRequest)

      expect(await fxQuotesModel.checkDuplicateFxQuoteRequest(fxQuoteRequest)).toStrictEqual({
        isResend: true,
        isDuplicateId: true
      })
    })

    test('should return isResend false, isDuplicateId false, match not found in db', async () => {
      const fxQuoteRequest = { conversionRequestId: 1 }
      fxQuotesModel.db.getFxQuoteDuplicateCheck = jest.fn().mockResolvedValue(null)

      expect(await fxQuotesModel.checkDuplicateFxQuoteRequest(fxQuoteRequest)).toStrictEqual({
        isResend: false,
        isDuplicateId: false
      })
    })

    test('throws error if db query fails', async () => {
      const fxQuoteRequest = { conversionRequestId: 1 }
      fxQuotesModel.db.getFxQuoteDuplicateCheck = jest.fn().mockRejectedValue(new Error('DB Error'))

      await expect(fxQuotesModel.checkDuplicateFxQuoteRequest(fxQuoteRequest)).rejects.toThrow()
    })

    test('should rethrow error if metrics is disabled', async () => {
      fxQuotesModel.envConfig.instrumentationMetricsDisabled = true
      const fxQuoteRequest = { conversionRequestId: 1 }
      fxQuotesModel.db.getFxQuoteDuplicateCheck = jest.fn().mockRejectedValue(new Error('DB Error'))

      await expect(fxQuotesModel.checkDuplicateFxQuoteRequest(fxQuoteRequest)).rejects.toThrow()
    })
  })

  describe('checkDuplicateFxQuoteResponse', () => {
    test('should return isResend false, isDuplicateId true, if ids are same but hashes dont match', async () => {
      const conversionRequestId = 1
      const fxQuoteResponse = { conversionRequestId: 1 }
      const duplicateFxQuoteResponse = { conversionRequestId: 1, hash: '481bd172c6dbfba81e8f864332eb0350d1bea77bdf33e9db196efdb1bbb4668' }
      fxQuotesModel.db.getFxQuoteResponseDuplicateCheck = jest.fn().mockResolvedValue(duplicateFxQuoteResponse)

      expect(await fxQuotesModel.checkDuplicateFxQuoteResponse(conversionRequestId, fxQuoteResponse)).toStrictEqual({
        isResend: false,
        isDuplicateId: true
      })
    })

    test('should return isResend true, isDuplicateId true, if ids are same and hashes match', async () => {
      const conversionRequestId = 1
      const fxQuoteResponse = { conversionRequestId: 1 }
      const duplicateFxQuoteResponse = { conversionRequestId: 1, hash: '481bd172c6dbfba81e8f864332eb0350d1bea77bdf33e9db196efdb1bbb4668d' }
      fxQuotesModel.db.getFxQuoteResponseDuplicateCheck = jest.fn().mockResolvedValue(duplicateFxQuoteResponse)

      expect(await fxQuotesModel.checkDuplicateFxQuoteResponse(conversionRequestId, fxQuoteResponse)).toStrictEqual({
        isResend: true,
        isDuplicateId: true
      })
    })

    test('should return isResend false, isDuplicateId false, match not found in db', async () => {
      const conversionRequestId = 1
      const fxQuoteResponse = { conversionRequestId: 1 }
      fxQuotesModel.db.getFxQuoteResponseDuplicateCheck = jest.fn().mockResolvedValue(null)

      expect(await fxQuotesModel.checkDuplicateFxQuoteResponse(conversionRequestId, fxQuoteResponse)).toStrictEqual({
        isResend: false,
        isDuplicateId: false
      })
    })

    test('throws error if db query fails', async () => {
      const conversionRequestId = 1
      const fxQuoteResponse = { conversionRequestId: 1 }
      fxQuotesModel.db.getFxQuoteResponseDuplicateCheck = jest.fn().mockRejectedValue(new Error('DB Error'))

      await expect(fxQuotesModel.checkDuplicateFxQuoteResponse(conversionRequestId, fxQuoteResponse)).rejects.toThrow()
    })

    test('should rethrow error if metrics is disabled', async () => {
      fxQuotesModel.envConfig.instrumentationMetricsDisabled = true
      const conversionRequestId = 1
      const fxQuoteResponse = { conversionRequestId: 1 }
      fxQuotesModel.db.getFxQuoteResponseDuplicateCheck = jest.fn().mockRejectedValue(new Error('DB Error'))

      await expect(fxQuotesModel.checkDuplicateFxQuoteResponse(conversionRequestId, fxQuoteResponse)).rejects.toThrow()
    })
  })

  describe('sendErrorCallback', () => {
    test('should throw fspiop error if no destination found', async () => {
      fxQuotesModel = new FxQuotesModel(deps)
      fxQuotesModel._getParticipantEndpoint = jest.fn().mockResolvedValue(undefined)
      const fspiopError = ErrorHandler.CreateFSPIOPError({ code: 2001, message: 'Generic server error' }, '', new Error('Test error'))
      await expect(fxQuotesModel.sendErrorCallback(headers['fspiop-source'], fspiopError, conversionRequestId, headers, childSpan)).rejects.toThrow(ERROR_MESSAGES.NO_FX_CALLBACK_ENDPOINT(headers['fspiop-source'], conversionRequestId))
    })

    test('should send error callback with flag modifyHeaders === false', async () => {
      headers['fspiop-signature'] = 'signature'
      fxQuotesModel = new FxQuotesModel(deps)
      fxQuotesModel._getParticipantEndpoint = jest.fn().mockResolvedValue(mockEndpoint)
      jest.spyOn(fxQuotesModel, 'sendHttpRequest')
      jest.spyOn(axios, 'request').mockResolvedValue({ status: 200 })
      const fspiopError = ErrorHandler.CreateFSPIOPError({ code: 2001, message: 'Generic server error' }, '', new Error('Test error'))

      await expect(fxQuotesModel.sendErrorCallback(headers['fspiop-source'], fspiopError, conversionRequestId, headers, childSpan, false)).resolves.toBeUndefined()

      expect(fxQuotesModel.sendHttpRequest).toBeCalledTimes(1)
      const [args] = fxQuotesModel.sendHttpRequest.mock.calls[0]
      expect(args.headers['FSPIOP-Source']).toBe(headers['fspiop-source'])
      expect(args.headers['FSPIOP-Destination']).toBe(headers['fspiop-destination'])
      expect(args.headers['FSPIOP-Signature']).toBe(headers['fspiop-signature'])
      expect(args.headers.Date).toBe(headers.date)
      expect(args.headers['Content-Type']).toBe(headers['content-type'])
      expect(args.headers.Accept).toBeUndefined()
      expect(args.method).toBe(ENUM.Http.RestMethods.PUT)
      expect(args.url).toBe(`${mockEndpoint}/fxQuotes/${conversionRequestId}/error`)
      expect(args.data).toStrictEqual(fspiopError.toApiErrorObject())
    })

    test('should reformat and re-throw http request error to fspiop error', async () => {
      fxQuotesModel = new FxQuotesModel(deps)
      fxQuotesModel._getParticipantEndpoint = jest.fn().mockResolvedValue(mockEndpoint)
      fxQuotesModel.sendHttpRequest = jest.fn(async () => { throw new Error('Test error') })
      const fspiopError = ErrorHandler.CreateFSPIOPError({ code: 2001, message: 'Generic server error' }, '', new Error('Test error'))

      await expect(fxQuotesModel.sendErrorCallback(headers['fspiop-source'], fspiopError, conversionRequestId, headers, childSpan, false)).rejects.toThrow(FSPIOPError)
    })

    test('should re-throw error response from callback if not OK', async () => {
      fxQuotesModel = new FxQuotesModel(deps)
      fxQuotesModel._getParticipantEndpoint = jest.fn().mockResolvedValue(mockEndpoint)
      fxQuotesModel.sendHttpRequest = jest.fn(async () => ({ status: 500 }))
      const fspiopError = ErrorHandler.CreateFSPIOPError({ code: 2001, message: 'Generic server error' }, '', new Error('Test error'))

      await expect(fxQuotesModel.sendErrorCallback(headers['fspiop-source'], fspiopError, conversionRequestId, headers, childSpan, false)).rejects.toThrow(ERROR_MESSAGES.CALLBACK_UNSUCCESSFUL_HTTP_RESPONSE)
    })

    test('should jws sign the request if jwsSign is true', async () => {
      envConfig.jws.jwsSign = true
      envConfig.jws.jwsSigningKey = fs.readFileSync(path.join(__dirname, '../../../secrets/jwsSigningKey.key'), 'utf-8')
      fxQuotesModel = new FxQuotesModel(deps)
      fxQuotesModel._getParticipantEndpoint = jest.fn().mockResolvedValue(mockEndpoint)
      fxQuotesModel.sendHttpRequest = jest.fn(async () => ({ status: 200 }))
      const fspiopError = ErrorHandler.CreateFSPIOPError({ code: 2001, message: 'Generic server error' }, '', new Error('Test error'))

      await expect(fxQuotesModel.sendErrorCallback(headers['fspiop-source'], fspiopError, conversionRequestId, headers, childSpan, true)).resolves.toBeUndefined()

      expect(fxQuotesModel.sendHttpRequest).toBeCalledTimes(1)
      const [args] = fxQuotesModel.sendHttpRequest.mock.calls[0]
      expect(args.headers['fspiop-signature']).toContain('signature')
    })

    test('should send errorCallback with fspiopSource as hub (flag modifyHeaders === true) [CSI-414]', async () => {
      const apiErrorCode = { code: 2001, message: 'Generic server error' }
      const fspiopError = ErrorHandler.CreateFSPIOPError(apiErrorCode, '', new Error('XXX'))
      const source = `source-${Date.now()}`
      const conversionRequestId = `conversionRequestId-${Date.now()}`
      const headers = {}
      const modifyHeaders = true
      fxQuotesModel = new FxQuotesModel(deps)
      fxQuotesModel._getParticipantEndpoint = jest.fn(async () => `https://some.endpoint/${Date.now()}`)
      fxQuotesModel.sendHttpRequest = jest.fn(async () => ({ status: 200 }))

      const result = await fxQuotesModel.sendErrorCallback(source, fspiopError, conversionRequestId, headers, null, modifyHeaders)
      expect(result).toBeUndefined()
      expect(fxQuotesModel.sendHttpRequest).toBeCalledTimes(1)
      const [args] = fxQuotesModel.sendHttpRequest.mock.calls[0]
      expect(args.headers[HEADERS.fspiopSource]).toBe(envConfig.hubName)
    })

    test('should set fxQuotes resource in accept and contentType headers (fspiop-source is hub)', async () => {
      const resource = RESOURCES.fxQuotes
      const version = envConfig.protocolVersions.CONTENT.DEFAULT
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
      expect(args.headers[HEADERS.fspiopSource]).toBe(envConfig.hubName)
    })

    test('should rethrow error if metrics is disabled', async () => {
      fxQuotesModel.envConfig.instrumentationMetricsDisabled = true
      const fspiopError = ErrorHandler.CreateFSPIOPError({ code: 2001, message: 'Generic server error' }, '', new Error('Test error'))
      fxQuotesModel._getParticipantEndpoint = jest.fn().mockImplementation(() => { throw new Error('Test error') })
      await expect(fxQuotesModel.sendErrorCallback(headers['fspiop-source'], fspiopError, conversionRequestId, headers, childSpan)).rejects.toThrow()
    })
  })

  describe('sendHttpRequest', () => {
    test('should rethrow an error if error is thrown', async () => {
      const options = { method: 'GET', url: 'https://example.com' }
      const fspiopSource = 'source'
      const fspiopDest = 'destination'
      const error = new Error('Network Error')

      fxQuotesModel = new FxQuotesModel(deps)
      jest.spyOn(axios, 'request').mockImplementation(() => { throw error })

      await expect(fxQuotesModel.sendHttpRequest(options, fspiopSource, fspiopDest)).rejects.toThrow('Network Error')

      expect(axios.request).toBeCalledWith(options)
    })

    test('should rethrow error if metrics is disabled', async () => {
      const options = { method: 'GET', url: 'https://example.com' }
      const fspiopSource = 'source'
      const fspiopDest = 'destination'
      const error = new Error('Network Error')

      fxQuotesModel = new FxQuotesModel(deps)
      jest.spyOn(axios, 'request').mockImplementation(() => { throw error })
      fxQuotesModel.envConfig.instrumentationMetricsDisabled = true

      await expect(fxQuotesModel.sendHttpRequest(options, fspiopSource, fspiopDest)).rejects.toThrow()
    })
  })
})
