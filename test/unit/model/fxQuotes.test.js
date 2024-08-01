const { randomUUID } = require('node:crypto')
const ErrorHandler = require('@mojaloop/central-services-error-handling')
const FxQuotesModel = require('../../../src/model/fxQuotes')
const Config = require('../../../src/lib/config')

const config = new Config()

describe('FxQuotesModel Tests -->', () => {
  let fxQuotesModel
  let db
  let requestId
  let proxyClient

  beforeEach(() => {
    db = { config } // add needed functionality
    requestId = randomUUID()
    fxQuotesModel = new FxQuotesModel({ db, requestId, proxyClient })
  })

  afterEach(() => {
    jest.restoreAllMocks()
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
