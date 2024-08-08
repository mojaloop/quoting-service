const { randomUUID } = require('node:crypto')
const ErrorHandler = require('@mojaloop/central-services-error-handling')
const ENUM = require('@mojaloop/central-services-shared').Enum
const LOCAL_ENUM = require('../../../src/lib/enum')
const FxQuotesModel = require('../../../src/model/fxQuotes')
const Config = require('../../../src/lib/config')
jest.mock('../../../src/lib/http')
const LibHttp = require('../../../src/lib/http')
const { fxQuoteMocks } = require('../mocks')
const { FSPIOPError } = require('@mojaloop/central-services-error-handling/src/factory')

const config = new Config()

describe('FxQuotesModel Tests -->', () => {
  let fxQuotesModel
  let db
  let requestId
  let proxyClient
  let log

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
    log = fxQuoteMocks.logger()
    requestId = randomUUID()

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

  describe('validateFxQuoteRequest', () => {
    test('should not function correctly with proxy cache disabled', async () => {
      fxQuotesModel = new FxQuotesModel({ db, requestId, proxyClient: undefined, log })

      await expect(fxQuotesModel.validateFxQuoteRequest(destination, request)).resolves.toBeUndefined()

      expect(db.getParticipant).toBeCalledTimes(2)
      expect(db.getParticipant).toHaveBeenNthCalledWith(1, destination, LOCAL_ENUM.COUNTERPARTY_FSP, 'ZMW', ENUM.Accounts.LedgerAccountType.POSITION)
      expect(db.getParticipant).toHaveBeenNthCalledWith(2, destination, LOCAL_ENUM.COUNTERPARTY_FSP, 'TZS', ENUM.Accounts.LedgerAccountType.POSITION)
    })

    test('should not validate participant if proxy cache returns a proxy', async () => {
      fxQuotesModel = new FxQuotesModel({ db, requestId, proxyClient, log })

      await expect(fxQuotesModel.validateFxQuoteRequest(destination, request)).resolves.toBeUndefined()

      expect(proxyClient.lookupProxyByDfspId).toBeCalledTimes(1)
      expect(db.getParticipant).not.toHaveBeenCalled()
    })

    test('should validate participant if proxy cache returns no proxy', async () => {
      proxyClient.lookupProxyByDfspId = jest.fn().mockResolvedValue(undefined)
      fxQuotesModel = new FxQuotesModel({ db, requestId, proxyClient, log })

      await expect(fxQuotesModel.validateFxQuoteRequest(destination, request)).resolves.toBeUndefined()

      expect(proxyClient.lookupProxyByDfspId).toBeCalledTimes(1)
      expect(db.getParticipant).toBeCalledTimes(2)
    })

    test('should throw error if participant validation fails', async () => {
      proxyClient.lookupProxyByDfspId = jest.fn().mockResolvedValue(undefined)
      db.getParticipant = jest.fn().mockRejectedValue(new Error('DB Error'))
      fxQuotesModel = new FxQuotesModel({ db, requestId, proxyClient, log })

      await expect(fxQuotesModel.validateFxQuoteRequest(destination, request)).rejects.toThrow()

      expect(proxyClient.lookupProxyByDfspId).toBeCalledTimes(1)
      expect(db.getParticipant).toBeCalledTimes(2)
    })
  })

  describe('handleFxQuoteRequest', () => {
    test('should handle fx quote request', async () => {
      fxQuotesModel = new FxQuotesModel({ db, requestId, proxyClient, log })
      jest.spyOn(fxQuotesModel, 'forwardFxQuoteRequest').mockResolvedValue()
      jest.spyOn(fxQuotesModel, 'validateFxQuoteRequest')

      await expect(fxQuotesModel.handleFxQuoteRequest(headers, request, span)).resolves.toBeUndefined()

      expect(fxQuotesModel.validateFxQuoteRequest).toBeCalledWith(headers['fspiop-destination'], request)
      expect(fxQuotesModel.forwardFxQuoteRequest).toBeCalledWith(headers, request.conversionRequestId, request, span.getChild())
    })

    test('should handle error thrown', async () => {
      fxQuotesModel = new FxQuotesModel({ db, requestId, proxyClient, log })
      jest.spyOn(fxQuotesModel, 'forwardFxQuoteRequest').mockRejectedValue(new Error('Forward Error'))
      jest.spyOn(fxQuotesModel, 'validateFxQuoteRequest')
      jest.spyOn(fxQuotesModel, 'handleException').mockResolvedValue()

      await expect(fxQuotesModel.handleFxQuoteRequest(headers, request, span)).resolves.toBeUndefined()

      expect(fxQuotesModel.validateFxQuoteRequest).toBeCalledWith(headers['fspiop-destination'], request)
      expect(fxQuotesModel.forwardFxQuoteRequest).toBeCalledWith(headers, request.conversionRequestId, request, span.getChild())
      expect(fxQuotesModel.handleException).toBeCalledWith(headers['fspiop-source'], request.conversionRequestId, expect.any(Error), headers, span.getChild())
      expect(span.getChild().finish).toBeCalledTimes(1)
    })
  })

  describe('forwardFxQuoteRequest', () => {
    test('should forward fx quote request', async () => {
      jest.spyOn(LibHttp, 'httpRequest').mockResolvedValue({ status: 200 })
      fxQuotesModel = new FxQuotesModel({ db, requestId, proxyClient, log })
      fxQuotesModel._getParticipantEndpoint = jest.fn().mockResolvedValue(mockEndpoint)

      await expect(fxQuotesModel.forwardFxQuoteRequest(headers, conversionRequestId, request, childSpan)).resolves.toBeUndefined()

      const expectedHeaders = {
        Accept: headers.accept,
        'Content-Type': headers['content-type'],
        'FSPIOP-Source': headers['fspiop-source'],
        'FSPIOP-Destination': headers['fspiop-destination'],
        Date: headers.date
      }
      expect(LibHttp.httpRequest).toHaveBeenCalledWith({
        headers: expectedHeaders,
        method: ENUM.Http.RestMethods.POST,
        url: `${mockEndpoint}${ENUM.EndPoints.FspEndpointTemplates.FX_QUOTES_POST}`,
        data: JSON.stringify(request)
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
      jest.spyOn(LibHttp, 'httpRequest').mockResolvedValue({ status: 200 })

      fxQuotesModel = new FxQuotesModel({ db, requestId, proxyClient, log })
      await expect(fxQuotesModel.forwardFxQuoteRequest(headers, conversionRequestId, request, childSpan)).resolves.toBeUndefined()

      expect(LibHttp.httpRequest).toBeCalled()
      expect(proxyClient.lookupProxyByDfspId).toBeCalledTimes(1)
      expect(db.getParticipantEndpoint).toBeCalledTimes(2)
      expect(db.getParticipantEndpoint).toHaveBeenNthCalledWith(1, destination, endpointType)
      expect(db.getParticipantEndpoint).toHaveBeenNthCalledWith(2, mockProxy, endpointType)
    })

    test('should format error thrown and re-throw', async () => {
      jest.spyOn(LibHttp, 'httpRequest').mockRejectedValue(new Error('HTTP Error'))

      fxQuotesModel = new FxQuotesModel({ db, requestId, proxyClient, log })
      fxQuotesModel._getParticipantEndpoint = jest.fn().mockResolvedValue(undefined)

      await expect(fxQuotesModel.forwardFxQuoteRequest(headers, conversionRequestId, request, childSpan)).rejects.toThrow(FSPIOPError)
    })
  })

  describe('handleFxQuoteUpdate', () => {
    test('headers should not contain accept property', async () => {
      fxQuotesModel = new FxQuotesModel({ db, requestId, proxyClient, log })
      jest.spyOn(fxQuotesModel, 'forwardFxQuoteUpdate').mockResolvedValue()
      jest.spyOn(fxQuotesModel, 'handleException').mockResolvedValue()

      await expect(fxQuotesModel.handleFxQuoteUpdate(headers, conversionRequestId, updateRequest, span)).resolves.toBeUndefined()

      expect(fxQuotesModel.forwardFxQuoteUpdate).not.toBeCalled()
      expect(fxQuotesModel.handleException).toBeCalledWith(headers['fspiop-source'], conversionRequestId, expect.any(Error), headers, span.getChild())
    })

    test('should handle fx quote update', async () => {
      delete headers.accept

      fxQuotesModel = new FxQuotesModel({ db, requestId, proxyClient, log })
      jest.spyOn(fxQuotesModel, 'forwardFxQuoteUpdate').mockResolvedValue()
      jest.spyOn(fxQuotesModel, 'handleException').mockResolvedValue()

      await expect(fxQuotesModel.handleFxQuoteUpdate(headers, conversionRequestId, updateRequest, span)).resolves.toBeUndefined()

      expect(fxQuotesModel.forwardFxQuoteUpdate).toBeCalledWith(headers, conversionRequestId, updateRequest, span.getChild())
    })
  })

  describe('forwardFxQuoteUpdate', () => {
    test('should forward fx quote update', async () => {
      fxQuotesModel = new FxQuotesModel({ db, requestId, proxyClient, log })

      jest.spyOn(LibHttp, 'httpRequest').mockResolvedValue({ status: 200 })
      jest.spyOn(fxQuotesModel, '_getParticipantEndpoint').mockResolvedValue(mockEndpoint)

      await expect(fxQuotesModel.forwardFxQuoteUpdate(headers, conversionRequestId, updateRequest, childSpan)).resolves.toBeUndefined()

      expect(LibHttp.httpRequest).toHaveBeenCalledWith({
        headers: {
          'Content-Type': headers['content-type'],
          'FSPIOP-Source': headers['fspiop-source'],
          'FSPIOP-Destination': headers['fspiop-destination'],
          Date: headers.date
        },
        method: ENUM.Http.RestMethods.PUT,
        url: `${mockEndpoint}/fxQuotes/${conversionRequestId}`,
        data: JSON.stringify(updateRequest)
      }, headers['fspiop-source'])
    })

    test('should send error callback if no endpoint found', async () => {
      fxQuotesModel = new FxQuotesModel({ db, requestId, proxyClient, log })
      jest.spyOn(fxQuotesModel, 'sendErrorCallback').mockResolvedValue()

      await expect(fxQuotesModel.forwardFxQuoteUpdate(headers, conversionRequestId, updateRequest, childSpan)).resolves.toBeUndefined()

      expect(fxQuotesModel.sendErrorCallback).toBeCalledWith(headers['fspiop-source'], expect.any(Error), conversionRequestId, headers, childSpan, true)
    })
  })

  describe('sendErrorCallback method Tests', () => {
    test('should send errorCallback with flag modifyHeaders === true [CSI-414]', async () => {
      const destEndpoint = `https://some.endpoint/${Date.now()}`
      fxQuotesModel._getParticipantEndpoint = jest.fn(async () => destEndpoint)
      fxQuotesModel.sendHttpRequest = jest.fn(async () => ({ status: 200 }))
      const apiErrorCode = {
        code: 2001, message: 'Generic server error'
      }
      const fspiopError = ErrorHandler.CreateFSPIOPError(apiErrorCode, '', new Error('XXX'))
      const source = `source-${Date.now()}`
      const conversionRequestId = `conversionRequestId-${Date.now()}`
      const headers = {}
      const modifyHeaders = true

      const result = await fxQuotesModel.sendErrorCallback(source, fspiopError, conversionRequestId, headers, null, modifyHeaders)
      expect(result).toBeUndefined()
      expect(fxQuotesModel.sendHttpRequest).toBeCalledTimes(1)
      const [args] = fxQuotesModel.sendHttpRequest.mock.calls[0]
      expect(args.headers['FSPIOP-Source']).toBe(config.hubName)
      // use Enum.Http.Headers.FSPIOP.... headers
    })
  })
})
