const { randomUUID } = require('node:crypto')
const ErrorHandler = require('@mojaloop/central-services-error-handling')
const ENUM = require('@mojaloop/central-services-shared').Enum
const LOCAL_ENUM = require('../../../src/lib/enum')
const FxQuotesModel = require('../../../src/model/fxQuotes')
const Config = require('../../../src/lib/config')
jest.mock('../../../src/lib/http')
const LibHttp = require('../../../src/lib/http')
const { fxQuoteMocks } = require('../mocks')

const config = new Config()

describe('FxQuotesModel Tests -->', () => {
  let fxQuotesModel
  let db
  let requestId
  let proxyClient
  let log

  beforeEach(() => {
    db = fxQuoteMocks.db()
    proxyClient = fxQuoteMocks.proxyClient()
    log = fxQuoteMocks.logger()
    requestId = randomUUID()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('validateFxQuoteRequest', () => {
    test('should not function correctly with proxy cache disabled', async () => {
      const destination = fxQuoteMocks.destination
      const request = fxQuoteMocks.fxQuoteRequest()
      fxQuotesModel = new FxQuotesModel({ db, requestId, proxyClient: undefined, log })

      await expect(fxQuotesModel.validateFxQuoteRequest(destination, request)).resolves.toBeUndefined()

      expect(db.getParticipant).toBeCalledTimes(2)
      expect(db.getParticipant).toHaveBeenNthCalledWith(1, destination, LOCAL_ENUM.COUNTERPARTY_FSP, 'ZMW', ENUM.Accounts.LedgerAccountType.POSITION)
      expect(db.getParticipant).toHaveBeenNthCalledWith(2, destination, LOCAL_ENUM.COUNTERPARTY_FSP, 'TZS', ENUM.Accounts.LedgerAccountType.POSITION)
    })

    test('should not validate participant if proxy cache returns a proxy', async () => {
      const destination = fxQuoteMocks.destination
      const request = fxQuoteMocks.fxQuoteRequest()
      fxQuotesModel = new FxQuotesModel({ db, requestId, proxyClient, log })

      await expect(fxQuotesModel.validateFxQuoteRequest(destination, request)).resolves.toBeUndefined()

      expect(proxyClient.lookupProxyByDfspId).toBeCalledTimes(1)
      expect(db.getParticipant).not.toHaveBeenCalled()
    })

    test('should validate participant if proxy cache returns no proxy', async () => {
      const destination = fxQuoteMocks.destination
      const request = fxQuoteMocks.fxQuoteRequest()
      proxyClient.lookupProxyByDfspId = jest.fn().mockResolvedValue(undefined)
      fxQuotesModel = new FxQuotesModel({ db, requestId, proxyClient, log })

      await expect(fxQuotesModel.validateFxQuoteRequest(destination, request)).resolves.toBeUndefined()

      expect(proxyClient.lookupProxyByDfspId).toBeCalledTimes(1)
      expect(db.getParticipant).toBeCalledTimes(2)
    })

    test('should throw error if participant validation fails', async () => {
      const destination = fxQuoteMocks.destination
      const request = fxQuoteMocks.fxQuoteRequest()
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
      const headers = fxQuoteMocks.headers()
      const request = fxQuoteMocks.fxQuoteRequest()
      const span = fxQuoteMocks.span()

      fxQuotesModel = new FxQuotesModel({ db, requestId, proxyClient, log })
      jest.spyOn(fxQuotesModel, 'forwardFxQuoteRequest').mockResolvedValue()
      jest.spyOn(fxQuotesModel, 'validateFxQuoteRequest')

      await expect(fxQuotesModel.handleFxQuoteRequest(headers, request, span)).resolves.toBeUndefined()

      expect(fxQuotesModel.validateFxQuoteRequest).toBeCalledWith(headers['fspiop-destination'], request)
      expect(fxQuotesModel.forwardFxQuoteRequest).toBeCalledWith(headers, request.conversionRequestId, request, span.getChild())
    })

    test('should handle error thrown', async () => {
      const headers = fxQuoteMocks.headers()
      const request = fxQuoteMocks.fxQuoteRequest()
      const span = fxQuoteMocks.span()

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
    test('should forward fx quote request, participant not proxy mapped', async () => {
      const headers = fxQuoteMocks.headers()
      const request = fxQuoteMocks.fxQuoteRequest()
      const conversionRequestId = request.conversionRequestId
      const span = fxQuoteMocks.span().getChild()
      const mockEndpoint = 'https://some.endpoint'

      jest.spyOn(LibHttp, 'httpRequest').mockResolvedValue({ status: 200 })
      fxQuotesModel = new FxQuotesModel({ db, requestId, proxyClient, log })
      fxQuotesModel._getParticipantEndpoint = jest.fn().mockResolvedValue(mockEndpoint)

      await expect(fxQuotesModel.forwardFxQuoteRequest(headers, conversionRequestId, request, span)).resolves.toBeUndefined()

      const expectedHeaders = {
        Accept: headers.Accept,
        'Content-Type': headers['Content-Type'],
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
