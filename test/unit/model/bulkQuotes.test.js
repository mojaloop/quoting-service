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

 Initial contribution
 --------------------
 The initial functionality and code base was donated by the Mowali project working in conjunction with MTN and Orange as service provides.
 * Project: Mowali

 - Rajiv Mothilal <rajiv.mothilal@modusbox.com>
 --------------
 ******/
'use strict'

// jest has a buggy system for mocking dependencies that can be overcome by mocking
// the target module before requiring it.
// more info on https://github.com/facebook/jest/issues/2582#issuecomment-321607875
let mockConfig

jest.mock('axios')
jest.mock('@mojaloop/central-services-logger')
jest.mock('../../../src/data/database')
jest.mock('../../../src/lib/config', () => {
  return jest.fn().mockImplementation(() => mockConfig)
})
jest.mock('../../../src/lib/util', () => {
  const originalUtil = jest.requireActual('../../../src/lib/util')
  const partialMock = Object.keys(originalUtil).reduce((pre, methodName) => {
    pre[methodName] = jest.fn()
    return pre
  }, {})
  return {
    ...partialMock,
    rethrowAndCountFspiopError: originalUtil.rethrowAndCountFspiopError
  }
})
jest.mock('../../../src/lib/http')

const axios = require('axios')

const Enum = require('@mojaloop/central-services-shared').Enum
const LibUtil = require('@mojaloop/central-services-shared').Util
const ErrorHandler = require('@mojaloop/central-services-error-handling')
const EventSdk = require('@mojaloop/event-sdk')
const JwsSigner = require('@mojaloop/sdk-standard-components').Jws.signer
const Metrics = require('@mojaloop/central-services-metrics')

const BulkQuotesModel = require('../../../src/model/bulkQuotes')
const { createDeps } = require('../../../src/model/deps')
const Config = jest.requireActual('../../../src/lib/config')
const Db = require('../../../src/data/database')
const Http = require('../../../src/lib/http')
const Util = require('../../../src/lib/util')
const { jwsSigningKey } = require('#test/mocks')

Metrics.setup(new Config().instrumentationMetricsConfig)

describe('BulkQuotesModel', () => {
  let mockData
  let mockTransaction
  let mockChildSpan
  let mockSpan
  let bulkQuotesModel
  let deps
  let proxyClient

  mockConfig = new Config()

  beforeEach(() => {
    axios.request.mockImplementation((opts) => {
      if (opts.url.search('http://invalid.com') === 0) {
        return Promise.reject(new Error('Unable to reach host'))
      } else if (opts.url.search('http://invalid-response.com') === 0) {
        return Promise.resolve({ status: 400 })
      }
      if (opts.method === 'POST') {
        return Promise.resolve({ status: 202 })
      } else {
        return Promise.resolve({ status: 200 })
      }
    })
    mockTransaction = {
      commit: jest.fn(),
      rollback: jest.fn()
    }
    mockChildSpan = {
      injectContextToHttpRequest: jest.fn(opts => opts),
      audit: jest.fn(),
      setTags: jest.fn(),
      isFinished: undefined,
      finish: jest.fn()
    }
    mockSpan = {
      getChild: jest.fn(() => mockChildSpan),
      error: jest.fn(),
      finish: jest.fn(),
      setTags: jest.fn()
    }
    mockData = {
      amountTypeId: 'fakeAmountTypeId',
      endpoints: {
        payerfsp: 'http://localhost:8444/payerfsp',
        payeefsp: 'http://localhost:8444/payeefsp',
        invalid: 'http://invalid.com/',
        invalidResponse: 'http://invalid-response.com/'
      },
      geoCode: {
        latitude: '42.69751',
        longitude: '23.32415'
      },
      headers: {
        Accept: 'application/vnd.interoperability.quotes+json;version=1.1',
        'Content-Type': 'application/vnd.interoperability.quotes+json;version=1.1',
        'fspiop-source': 'dfsp1',
        'fspiop-destination': 'dfsp2'
      },
      initiatorType: 'fakeInitiatorType',
      initiator: 'fakeInitiator',
      bulkQuoteId: 'test123',
      bulkQuotePostRequest: {
        bulkQuoteId: 'test123',
        payer: {
          partyIdInfo: {
            partyIdType: 'MSISDN',
            partyIdentifier: '27713803905',
            fspId: 'dfsp1'
          }
        },
        individualQuotes: [
          {
            quoteId: 'test123',
            transactionId: 'abc123',
            payee: {
              partyIdInfo: {
                partyIdType: 'MSISDN',
                partyIdentifier: '27824592509',
                fspId: 'dfsp2'
              }
            },
            amountType: 'SEND',
            amount: {
              amount: 100,
              currency: 'USD'
            },
            transactionType: {
              scenario: 'TRANSFER',
              initiator: 'PAYER',
              initiatorType: 'CONSUMER'
            },
            extensionList: {
              extension: [{
                key: 'key1',
                value: 'value1'
              }]
            }
          }
        ],
        geoCode: {
          latitude: '43.69751',
          longitude: '24.32415'
        },
        expiration: '2019-10-30T10:30:19.899Z',
        extensionList: {
          extension: [{
            key: 'key1',
            value: 'value1'
          }]
        }
      },
      bulkQuoteUpdate: {
        individualQuotesResults: [{
          bulkQuoteId: 'test123',
          payee: {
            partyIdInfo: {
              partyIdType: 'MSISDN',
              partyIdentifier: '27713803905',
              fspId: 'dfsp2'
            }
          },
          transferAmount: {
            amount: '100',
            currency: 'USD'
          },
          payeeReceiveAmount: {
            amount: '95',
            currency: 'USD'
          },
          payeeFspFee: {
            amount: '3',
            currency: 'USD'
          },
          payeeFspCommission: {
            amount: '2',
            currency: 'USD'
          },
          expiration: '2019-10-30T10:30:19.899Z',
          ilpPacket: '<ilpPacket>',
          condition: 'HOr22-H3AfTDHrSkPjJtVPRdKouuMkDXTR4ejlQa8Ks',
          extensionList: {
            extension: [{
              key: 'key1',
              value: 'value1'
            }]
          }
        }],
        expiration: '2019-10-30T10:30:19.899Z',
        extensionList: {
          extension: [{
            key: 'key1',
            value: 'value1'
          }]
        }
      },
      bulkQuoteResponse: {
        bulkQuoteId: 'test123'
      },
      scenario: 'fakeScenario',
      subScenario: 'fakeSubScenario',
      transactionReference: 'fakeTxRef'
    }

    deps = createDeps({
      db: new Db(),
      proxyClient,
      requestId: mockData.bulkQuotePostRequest.bulkQuoteId
    })
    bulkQuotesModel = new BulkQuotesModel(deps)
    bulkQuotesModel.db.newTransaction.mockImplementation(() => mockTransaction)
    bulkQuotesModel.db.config = mockConfig
    bulkQuotesModel.db.createTransactionReference.mockImplementation(() => mockData.transactionReference)
    bulkQuotesModel.db.getInitiatorType.mockImplementation(() => mockData.initiatorType)
    bulkQuotesModel.db.getInitiator.mockImplementation(() => mockData.initiator)
    bulkQuotesModel.db.getScenario.mockImplementation(() => mockData.scenario)
    bulkQuotesModel.db.getSubScenario.mockImplementation(() => mockData.subScenario)
    bulkQuotesModel.db.getAmountType.mockImplementation(() => mockData.amountTypeId)
    bulkQuotesModel.db.createQuote.mockImplementation(() => mockData.bulkQuotePostRequest.quoteId)
    bulkQuotesModel.db.createQuoteError.mockImplementation(() => mockData.bulkQuotePostRequest.quoteId)
    bulkQuotesModel.db.createPayerQuoteParty.mockImplementation(() => mockData.bulkQuotePostRequest.payer.partyIdInfo.fspId)
    bulkQuotesModel.db.createPayeeQuoteParty.mockImplementation(() => mockData.bulkQuotePostRequest.payee.partyIdInfo.fspId)
    bulkQuotesModel.db.createGeoCode.mockImplementation(() => mockData.geoCode)
    bulkQuotesModel.db.createQuoteExtensions.mockImplementation(() => mockData.bulkQuotePostRequest.extensionList.extension)

    // make all methods of the quotesModel instance be a mock. This helps us re-mock in every
    // method's test suite.
    const propertyNames = Object.getOwnPropertyNames(BulkQuotesModel.prototype)
    propertyNames.forEach((methodName) => {
      jest.spyOn(bulkQuotesModel, methodName).mockImplementation(() => {
        return {}
      })
    })
  })

  afterEach(() => {
    // Clears the mock.calls and mock.instances properties of all mocks.
    // Equivalent to calling .mockClear() on every mocked function.
    jest.clearAllMocks()

    // reset the configuration values to their initials
    mockConfig = new Config()
  })

  describe('constructor', () => {
    it('should create a new instance of BulkQuotesModel', () => {
      expect(bulkQuotesModel).toBeInstanceOf(BulkQuotesModel)
    })
  })

  describe('validateBulkQuoteRequest', () => {
    beforeEach(() => {
      // restore the current method in test to its original implementation
      bulkQuotesModel.validateBulkQuoteRequest.mockRestore()
    })

    it('should validate fspiopSource and fspiopDestination', async () => {
      expect.assertions(5)

      const fspiopSource = 'dfsp1'
      const fspiopDestination = 'dfsp2'

      expect(bulkQuotesModel.db.getParticipant).not.toHaveBeenCalled() // Validates mockClear()

      await bulkQuotesModel.validateBulkQuoteRequest(fspiopSource, fspiopDestination, mockData.bulkQuotePostRequest)

      expect(bulkQuotesModel.db).toBeTruthy() // Constructor should have been called
      expect(bulkQuotesModel.db.getParticipant).toHaveBeenCalledTimes(2)
      expect(bulkQuotesModel.db.getParticipant.mock.calls[0][0]).toBe(fspiopSource)
      expect(bulkQuotesModel.db.getParticipant.mock.calls[1][0]).toBe(fspiopDestination)
    })
  })

  describe('handleBulkQuoteRequest', () => {
    beforeEach(() => {
      // restore the current method in test to its original implementation
      bulkQuotesModel.handleBulkQuoteRequest.mockRestore()
    })

    describe('Failures:', () => {
      describe('Before forwarding the request:', () => {
        it('throws an exception if `validateQuoteRequest` fails', async () => {
          expect.assertions(1)

          const fspiopError = ErrorHandler.CreateFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.INTERNAL_SERVER_ERROR)

          bulkQuotesModel.validateBulkQuoteRequest = jest.fn(() => { throw fspiopError })

          await bulkQuotesModel.handleBulkQuoteRequest(mockData.headers, mockData.bulkQuotePostRequest, mockSpan)
          expect(bulkQuotesModel.handleException).toHaveBeenCalledTimes(1)
        })
        it('throws an exception if `span.getChild` fails', async () => {
          expect.assertions(2)

          const spanError = new Error('foo')
          mockSpan.getChild = jest.fn(() => { throw spanError })
          mockSpan.isFinished = false
          await bulkQuotesModel.handleBulkQuoteRequest(mockData.headers, mockData.bulkQuotePostRequest, mockSpan)
          expect(bulkQuotesModel.handleException).toHaveBeenCalledTimes(1)
          expect(mockSpan.getChild.mock.calls.length).toBe(1)
        })
      })
      describe('While forwarding the request:', () => {
        describe('In case environment is configured for simple routing mode', () => {
          beforeEach(() => {
            mockConfig.simpleRoutingMode = true
          })

          it('calls `handleException` with the proper arguments if `span.audit` fails', async () => {
            expect.assertions(4)

            const spanError = new Error('foo')
            const fspiopError = ErrorHandler.ReformatFSPIOPError(spanError)
            mockChildSpan.audit = jest.fn(() => { throw spanError })

            const expectedHandleExceptionArgs = [mockData.headers['fspiop-source'], mockData.bulkQuoteId, fspiopError, mockData.headers,
              mockChildSpan]

            const result = await bulkQuotesModel.handleBulkQuoteRequest(mockData.headers, mockData.bulkQuotePostRequest, mockSpan)

            expect(mockChildSpan.audit.mock.calls.length).toBe(1)
            expect(bulkQuotesModel.handleException).toBeCalledWith(...expectedHandleExceptionArgs)
            expect(bulkQuotesModel.handleException.mock.calls.length).toBe(1)
            expect(result).toEqual({})
          })

          it('calls `handleException` with the proper arguments if `forwardBulkQuoteRequest` fails', async () => {
            expect.assertions(6)

            const fspiopError = ErrorHandler.CreateFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.INTERNAL_SERVER_ERROR)

            bulkQuotesModel.forwardBulkQuoteRequest = jest.fn(() => { throw fspiopError })

            const expectedHandleExceptionArgs = [mockData.headers['fspiop-source'], mockData.bulkQuoteId, fspiopError, mockData.headers,
              mockChildSpan]
            const expectedForwardQuoteRequestArgs = [mockData.headers, mockData.bulkQuotePostRequest.bulkQuoteId, mockData.bulkQuotePostRequest, mockChildSpan]

            const result = await bulkQuotesModel.handleBulkQuoteRequest(mockData.headers, mockData.bulkQuotePostRequest, mockSpan)

            expect(mockChildSpan.audit.mock.calls.length).toBe(1)
            expect(bulkQuotesModel.forwardBulkQuoteRequest.mock.calls.length).toBe(1)
            expect(bulkQuotesModel.forwardBulkQuoteRequest).toBeCalledWith(...expectedForwardQuoteRequestArgs)
            expect(bulkQuotesModel.handleException).toBeCalledWith(...expectedHandleExceptionArgs)
            expect(bulkQuotesModel.handleException.mock.calls.length).toBe(1)
            expect(result).toEqual({})
          })
        })
      })
    })
    describe('Success:', () => {
      describe('While forwarding the request:', () => {
        describe('In case environment is configured for simple routing mode', () => {
          it('forwards the bulk quote request properly', async () => {
            expect.assertions(5)

            mockChildSpan.isFinished = false

            const result = await bulkQuotesModel.handleBulkQuoteRequest(mockData.headers, mockData.bulkQuotePostRequest, mockSpan)

            const expectedValidateQuoteRequestArgs = [mockData.headers['fspiop-source'], mockData.headers['fspiop-destination'], mockData.bulkQuotePostRequest]
            expect(bulkQuotesModel.validateBulkQuoteRequest).toBeCalledWith(...expectedValidateQuoteRequestArgs)
            expect(mockSpan.getChild.mock.calls.length).toBe(1)

            const expectedAuditArgs = [{ headers: mockData.headers, payload: mockData.bulkQuotePostRequest }, EventSdk.AuditEventAction.start]
            expect(mockChildSpan.audit).toBeCalledWith(...expectedAuditArgs)

            const expectedForwardRequestArgs = [mockData.headers, mockData.bulkQuotePostRequest.bulkQuoteId, mockData.bulkQuotePostRequest, mockChildSpan]
            expect(bulkQuotesModel.forwardBulkQuoteRequest).toBeCalledWith(...expectedForwardRequestArgs)
            expect(result).toEqual({})
          })
        })
      })
    })
  })

  describe('forwardBulkQuoteRequest', () => {
    beforeEach(() => {
      // restore the current method in test to its original implementation
      bulkQuotesModel.forwardBulkQuoteRequest.mockRestore()
    })

    it('should get http status code 202 Accepted in simple routing mode', async () => {
      expect.assertions(1)
      mockConfig.simpleRoutingMode = true
      bulkQuotesModel._getParticipantEndpoint.mockReturnValueOnce(mockData.endpoints.payeefsp)

      await bulkQuotesModel.forwardBulkQuoteRequest(mockData.headers, mockData.bulkQuotePostRequest.bulkQuoteId, mockData.bulkQuotePostRequest, mockChildSpan)

      expect(bulkQuotesModel._getParticipantEndpoint).toBeCalled()
    })

    it('should rethrow any errors', async () => {
      expect.assertions(1)
      const extensions = [{
        key: 'system',
        value: '["test"]'
      }]
      const fspiopError = ErrorHandler.Factory.reformatFSPIOPError(
        new Error('Test Error'),
        undefined,
        undefined,
        extensions
      )
      bulkQuotesModel._getParticipantEndpoint.mockRejectedValueOnce(fspiopError)

      await expect(bulkQuotesModel.forwardBulkQuoteRequest(mockData.headers, mockData.bulkQuotePostRequest.bulkQuoteId, mockData.bulkQuotePostRequest, mockChildSpan))
        .rejects
        .toThrowError()
    })

    it('should rethrow any errors if metrics is diabled', async () => {
      expect.assertions(1)
      bulkQuotesModel.envConfig.instrumentationMetricsDisabled = true
      bulkQuotesModel._getParticipantEndpoint.mockRejectedValueOnce(new Error('Test Error'))

      await expect(bulkQuotesModel.forwardBulkQuoteRequest(mockData.headers, mockData.bulkQuotePostRequest.bulkQuoteId, mockData.bulkQuotePostRequest, mockChildSpan))
        .rejects
        .toThrowError()
    })

    it('should throw an error if the participant endpoint is not found', async () => {
      expect.assertions(1)
      bulkQuotesModel._getParticipantEndpoint.mockReturnValueOnce(undefined)

      await expect(bulkQuotesModel.forwardBulkQuoteRequest(mockData.headers, mockData.bulkQuotePostRequest.bulkQuoteId, mockData.bulkQuotePostRequest, mockChildSpan))
        .rejects
        .toThrowError()
    })

    it('should throw an error if the participant endpoint is not found with metrics disabled', async () => {
      expect.assertions(1)
      bulkQuotesModel.envConfig.instrumentationMetricsDisabled = true
      bulkQuotesModel._getParticipantEndpoint.mockReturnValueOnce(undefined)

      await expect(bulkQuotesModel.forwardBulkQuoteRequest(mockData.headers, mockData.bulkQuotePostRequest.bulkQuoteId, mockData.bulkQuotePostRequest, mockChildSpan))
        .rejects
        .toThrowError()
    })
  })

  describe('handleBulkQuoteUpdate', () => {
    beforeEach(() => {
      // restore the current method in test to its original implementation
      bulkQuotesModel.handleBulkQuoteUpdate.mockRestore()
    })

    it('should forward quote update in simple routing mode', async () => {
      expect.assertions(3)
      mockChildSpan.isFinished = false
      await bulkQuotesModel.handleBulkQuoteUpdate(mockData.headers, mockData.bulkQuoteId, mockData.bulkQuoteUpdate, mockSpan)
      expect(mockSpan.getChild.mock.calls.length).toBe(1)
      let args = [{ headers: mockData.headers, params: { bulkQuoteId: mockData.bulkQuotePostRequest.bulkQuoteId }, payload: mockData.bulkQuoteUpdate }, EventSdk.AuditEventAction.start]
      expect(mockChildSpan.audit).toBeCalledWith(...args)
      args = [mockData.headers, mockData.bulkQuoteId, mockData.bulkQuoteUpdate, mockChildSpan]
      expect(bulkQuotesModel.forwardBulkQuoteUpdate).toBeCalledWith(...args)
    })
    it('should handle exception', async () => {
      expect.assertions(5)
      const extensions = [{
        key: 'system',
        value: '["test"]'
      }]
      const fspiopError = ErrorHandler.CreateFSPIOPError(
        ErrorHandler.Enums.FSPIOPErrorCodes.DESTINATION_FSP_ERROR,
        undefined,
        undefined,
        extensions
      )
      bulkQuotesModel.forwardBulkQuoteUpdate = jest.fn(() => { throw fspiopError })
      mockChildSpan.isFinished = false
      await bulkQuotesModel.handleBulkQuoteUpdate(mockData.headers, mockData.bulkQuoteId, mockData.bulkQuoteUpdate, mockSpan)
      expect(mockSpan.getChild.mock.calls.length).toBe(1)
      let args = [{ headers: mockData.headers, params: { bulkQuoteId: mockData.bulkQuotePostRequest.bulkQuoteId }, payload: mockData.bulkQuoteUpdate }, EventSdk.AuditEventAction.start]
      expect(mockChildSpan.audit).toBeCalledWith(...args)
      args = [mockData.headers, mockData.bulkQuoteId, mockData.bulkQuoteUpdate, mockChildSpan]
      expect(bulkQuotesModel.forwardBulkQuoteUpdate).toBeCalledWith(...args)
      args = [mockData.headers['fspiop-source'], mockData.bulkQuoteId, fspiopError, mockData.headers, mockChildSpan]
      expect(bulkQuotesModel.handleException).toBeCalledWith(...args)
      expect(bulkQuotesModel.handleException.mock.calls.length).toBe(1)
    })
    it('should throw validationError when headers contains accept', async () => {
      expect.assertions(3)

      const localHeaders = LibUtil.clone(mockData.headers)
      localHeaders.accept = 'application/vnd.interoperability.quotes+json;version=1.1'

      await expect(bulkQuotesModel.handleBulkQuoteUpdate(localHeaders, mockData.bulkQuoteId, mockData.bulkQuoteUpdate))
        .rejects
        .toHaveProperty('apiErrorCode.code', ErrorHandler.Enums.FSPIOPErrorCodes.VALIDATION_ERROR.code)

      expect(bulkQuotesModel.db.newTransaction.mock.calls.length).toBe(0)
      expect(mockTransaction.rollback.mock.calls.length).toBe(0)
    })
  })

  describe('forwardBulkQuoteUpdate', () => {
    beforeEach(() => {
      // restore the current method in test to its original implementation
      bulkQuotesModel.forwardBulkQuoteUpdate.mockRestore()
    })

    it('should get http status code 200 OK in simple routing mode', async () => {
      expect.assertions(2)
      bulkQuotesModel._getParticipantEndpoint.mockReturnValueOnce(mockData.endpoints.payeefsp)

      await expect(bulkQuotesModel.forwardBulkQuoteUpdate(mockData.headers, mockData.bulkQuoteId, mockData.bulkQuoteUpdate, mockChildSpan))
        .resolves
        .toBe(undefined)

      expect(bulkQuotesModel._getParticipantEndpoint).toBeCalled()
    })
    it('should throw when participant endpoint is not found', async () => {
      expect.assertions(1)

      const endpoint = undefined
      bulkQuotesModel._getParticipantEndpoint.mockReturnValueOnce(endpoint)
      bulkQuotesModel.sendErrorCallback = jest.fn((_, fspiopError) => { throw fspiopError })

      await expect(bulkQuotesModel.forwardBulkQuoteUpdate(mockData.headers, mockData.bulkQuoteId, mockData.bulkQuoteUpdate, mockChildSpan))
        .rejects
        .toHaveProperty('apiErrorCode.code', ErrorHandler.Enums.FSPIOPErrorCodes.DESTINATION_FSP_ERROR.code)
    })
    it('should not use spans when undefined and should throw when participant endpoint is invalid', async () => {
      expect.assertions(3)

      bulkQuotesModel._getParticipantEndpoint.mockReturnValueOnce(mockData.endpoints.invalid)
      Http.httpRequest.mockImplementationOnce(() => { throw ErrorHandler.CreateFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.DESTINATION_COMMUNICATION_ERROR) })

      await expect(bulkQuotesModel.forwardBulkQuoteUpdate(mockData.headers, mockData.bulkQuoteId, mockData.bulkQuoteUpdate))
        .rejects
        .toHaveProperty('apiErrorCode.code', ErrorHandler.Enums.FSPIOPErrorCodes.DESTINATION_COMMUNICATION_ERROR.code)

      expect(mockChildSpan.injectContextToHttpRequest).not.toHaveBeenCalled()
      expect(mockChildSpan.audit).not.toHaveBeenCalled()
    })
    it('should throw when participant endpoint returns invalid response', async () => {
      expect.assertions(3)

      bulkQuotesModel._getParticipantEndpoint.mockReturnValueOnce(mockData.endpoints.invalidResponse)
      Http.httpRequest.mockImplementationOnce(() => { throw ErrorHandler.CreateFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.DESTINATION_COMMUNICATION_ERROR) })

      await expect(bulkQuotesModel.forwardBulkQuoteUpdate(mockData.headers, mockData.bulkQuoteId, mockData.bulkQuoteUpdate))
        .rejects
        .toHaveProperty('apiErrorCode.code', ErrorHandler.Enums.FSPIOPErrorCodes.DESTINATION_COMMUNICATION_ERROR.code)

      expect(mockChildSpan.injectContextToHttpRequest).not.toHaveBeenCalled()
      expect(mockChildSpan.audit).not.toHaveBeenCalled()
    })
    it('should inspect and throw custom error as FSPIOPerror', async () => {
      expect.assertions(3)

      const customErrorNoStack = new Error('Custom error')
      delete customErrorNoStack.stack
      bulkQuotesModel._getParticipantEndpoint.mockRejectedValueOnce(customErrorNoStack)

      await expect(bulkQuotesModel.forwardBulkQuoteUpdate(mockData.headers, mockData.bulkQuoteId, mockData.bulkQuoteUpdate))
        .rejects
        .toHaveProperty('apiErrorCode.code', ErrorHandler.Enums.FSPIOPErrorCodes.INTERNAL_SERVER_ERROR.code)

      expect(mockChildSpan.injectContextToHttpRequest).not.toHaveBeenCalled()
      expect(mockChildSpan.audit).not.toHaveBeenCalled()
    })
    it('should handle FSPIOPerrors and rethrow them', async () => {
      expect.assertions(3)
      const fspiopError = ErrorHandler.CreateFSPIOPError(
        ErrorHandler.Enums.FSPIOPErrorCodes.DESTINATION_FSP_ERROR,
        undefined,
        undefined,
        [{ key: 'system', value: '["test"]' }]
      )
      bulkQuotesModel._getParticipantEndpoint.mockRejectedValueOnce(fspiopError)

      await expect(bulkQuotesModel.forwardBulkQuoteUpdate(mockData.headers, mockData.bulkQuoteId, mockData.bulkQuoteUpdate))
        .rejects
        .toHaveProperty('apiErrorCode.code', ErrorHandler.Enums.FSPIOPErrorCodes.DESTINATION_FSP_ERROR.code)

      expect(mockChildSpan.injectContextToHttpRequest).not.toHaveBeenCalled()
      expect(mockChildSpan.audit).not.toHaveBeenCalled()
    })
    it('should handle FSPIOPerrors and rethrow them with metrics disabled', async () => {
      expect.assertions(3)
      bulkQuotesModel.envConfig.instrumentationMetricsDisabled = true
      const fspiopError = ErrorHandler.CreateFSPIOPError(
        ErrorHandler.Enums.FSPIOPErrorCodes.DESTINATION_FSP_ERROR,
        undefined,
        undefined,
        [{ key: 'system', value: '["test"]' }]
      )
      bulkQuotesModel._getParticipantEndpoint.mockRejectedValueOnce(fspiopError)

      await expect(bulkQuotesModel.forwardBulkQuoteUpdate(mockData.headers, mockData.bulkQuoteId, mockData.bulkQuoteUpdate))
        .rejects
        .toHaveProperty('apiErrorCode.code', ErrorHandler.Enums.FSPIOPErrorCodes.DESTINATION_FSP_ERROR.code)

      expect(mockChildSpan.injectContextToHttpRequest).not.toHaveBeenCalled()
      expect(mockChildSpan.audit).not.toHaveBeenCalled()
    })
  })

  describe('handleBulkQuoteGet', () => {
    beforeEach(() => {
      // restore the current method in test to its original implementation
      bulkQuotesModel.handleBulkQuoteGet.mockRestore()
    })

    it('handles the bulk quote get with a child span', async () => {
      // Arrange
      expect.assertions(3)

      // Act
      await bulkQuotesModel.handleBulkQuoteGet(mockData.headers, mockData.bulkQuoteId, mockSpan)

      // Assert
      expect(mockChildSpan.audit.mock.calls.length).toBe(1)
      expect(mockChildSpan.finish.mock.calls.length).toBe(1)
      expect(bulkQuotesModel.forwardBulkQuoteGet.mock.calls.length).toBe(1)
    })

    it('handles an exception on `span.getChild`', async () => {
      // Arrange
      expect.assertions(1)
      mockSpan.getChild = jest.fn(() => { throw new Error('Test Error') })

      // Act
      const action = async () => bulkQuotesModel.handleBulkQuoteGet(mockData.headers, mockData.bulkQuoteId, mockSpan)

      // Assert
      await expect(action()).rejects.toThrowError('Test Error')
    })

    it('handles an exception on `childSpan.audit`', async () => {
      // Arrange
      expect.assertions(2)
      mockChildSpan.audit = jest.fn(() => { throw new Error('Test Error') })

      // Act
      await bulkQuotesModel.handleBulkQuoteGet(mockData.headers, mockData.bulkQuoteId, mockSpan)

      // Assert
      expect(mockChildSpan.finish.mock.calls.length).toBe(1)
      expect(bulkQuotesModel.handleException.mock.calls.length).toBe(1)
    })
  })

  describe('forwardBulkQuoteGet', () => {
    beforeEach(() => {
      // restore the current method in test to its original implementation
      bulkQuotesModel.forwardBulkQuoteGet.mockRestore()
    })

    it('fails to forward if the database has no endpoint for the dfsp', async () => {
      // Arrange
      expect.assertions(1)
      bulkQuotesModel._getParticipantEndpoint.mockImplementation(() => null)

      // Act
      const action = async () => bulkQuotesModel.forwardBulkQuoteGet(mockData.headers, mockData.bulkQuoteId, mockSpan)

      // Assert
      await expect(action()).rejects.toThrowError('No FSPIOP_CALLBACK_URL_BULK_QUOTES found for bulk quote GET test123')
    })

    it('should throw error if the participant endpoint is not found and metrics is disabled', async () => {
      expect.assertions(1)
      bulkQuotesModel.envConfig.instrumentationMetricsDisabled = true
      bulkQuotesModel._getParticipantEndpoint.mockImplementation(() => null)

      await expect(bulkQuotesModel.forwardBulkQuoteGet(mockData.headers, mockData.bulkQuoteId, mockSpan))
        .rejects
        .toThrowError('No FSPIOP_CALLBACK_URL_BULK_QUOTES found for bulk quote GET test123')
    })

    it('forwards the request to the payee dfsp without a span', async () => {
      // Arrange
      // expect.assertions(2)
      bulkQuotesModel._getParticipantEndpoint.mockImplementation(() => 'http://localhost:3333')
      const expectedOptions = {
        headers: {},
        method: 'GET',
        url: 'http://localhost:3333/bulkQuotes/test123'
      }
      Util.generateRequestHeaders.mockImplementationOnce(() => {
        return {}
      })
      // Act
      await bulkQuotesModel.forwardBulkQuoteGet(mockData.headers, mockData.bulkQuoteId)

      // Assert
      expect(Http.httpRequest).toBeCalledTimes(1)
      expect(Http.httpRequest).toBeCalledWith(expectedOptions, mockData.headers[Enum.Http.Headers.FSPIOP.SOURCE])
    })

    it('forwards the request to the payee dfsp', async () => {
      // Arrange
      expect.assertions(4)
      bulkQuotesModel._getParticipantEndpoint.mockImplementation(() => 'http://localhost:3333')
      mockSpan.injectContextToHttpRequest = jest.fn().mockImplementation(() => ({
        headers: {
          spanHeaders: '12345'
        }
      }))
      mockSpan.audit = jest.fn()
      const expectedOptions = {
        headers: {
          spanHeaders: '12345'
        }
      }

      // Act
      await bulkQuotesModel.forwardBulkQuoteGet(mockData.headers, mockData.bulkQuoteId, mockSpan)

      // Assert
      expect(mockSpan.injectContextToHttpRequest).toBeCalledTimes(1)
      expect(mockSpan.audit).toBeCalledTimes(1)
      expect(Http.httpRequest).toBeCalledTimes(1)
      expect(Http.httpRequest).toBeCalledWith(expectedOptions, mockData.headers[Enum.Http.Headers.FSPIOP.SOURCE])
    })

    it('handles a http error', async () => {
      // Arrange
      expect.assertions(1)
      bulkQuotesModel._getParticipantEndpoint.mockImplementation(() => 'http://localhost:3333')
      Http.httpRequest.mockImplementationOnce(() => { throw new Error('Test HTTP Error') })

      // Act
      const action = async () => bulkQuotesModel.forwardBulkQuoteGet(mockData.headers, mockData.bulkQuoteId)

      // Assert
      await expect(action()).rejects.toThrowError('Test HTTP Error')
    })

    it('should rethrow any errors if metrics is diabled', async () => {
      expect.assertions(1)
      bulkQuotesModel.envConfig.instrumentationMetricsDisabled = true
      bulkQuotesModel._getParticipantEndpoint.mockImplementation(() => 'http://localhost:3333')
      Http.httpRequest.mockImplementationOnce(() => { throw new Error('Test HTTP Error') })

      await expect(bulkQuotesModel.forwardBulkQuoteGet(mockData.headers, mockData.bulkQuoteId))
        .rejects
        .toThrowError()
    })
  })

  describe('handleBulkQuoteError', () => {
    beforeEach(() => {
      // restore the current method in test to its original implementation
      bulkQuotesModel.handleBulkQuoteError.mockRestore()
    })

    it('handles the quote error', async () => {
      // Arrange
      expect.assertions(2)
      const error = {
        errorCode: 2001,
        errorDescription: 'Test Error'
      }

      // Act
      const result = await bulkQuotesModel.handleBulkQuoteError(mockData.headers, mockData.bulkQuoteId, error, mockSpan)

      // Assert
      // For `handleQuoteError` response is undefined
      expect(result).toBe(undefined)
      expect(bulkQuotesModel.sendErrorCallback).toHaveBeenCalledTimes(1)
    })

    it('sends the error callback to the correct destination', async () => {
      // Arrange
      expect.assertions(3)
      const error = {
        errorCode: 2001,
        errorDescription: 'Test Error'
      }
      bulkQuotesModel.sendErrorCallback = jest.fn()

      // Act
      const result = await bulkQuotesModel.handleBulkQuoteError(mockData.headers, mockData.bulkQuoteId, error, mockSpan)

      // Assert
      // For `handleQuoteError` response is undefined
      expect(result).toBe(undefined)
      expect(bulkQuotesModel.sendErrorCallback).toHaveBeenCalledTimes(1)
      expect(bulkQuotesModel.sendErrorCallback.mock.calls[0][0])
        .toEqual(mockData.headers[Enum.Http.Headers.FSPIOP.DESTINATION])
    })

    it('handles bad error input', async () => {
      // Arrange
      expect.assertions(1)
      const error = {
        errorDescription: 'Test Error'
      }

      // Act
      const action = async () => bulkQuotesModel.handleBulkQuoteError(mockData.headers, mockData.bulkQuoteId, error, mockSpan)
      await action()
      // const es = 'Factory function createFSPIOPError failed due to apiErrorCode being invalid'
      // Assert
      expect(bulkQuotesModel.handleException).toHaveBeenCalledTimes(1)
    })
  })

  describe('handleException', () => {
    beforeEach(() => {
      // restore the current method in test to its original implementation
      bulkQuotesModel.handleException.mockRestore()
    })

    it('handles the error and finishes the child span', async () => {
      // Arrange
      expect.assertions(3)
      const error = new Error('Test Error')
      const expectedError = ErrorHandler.ReformatFSPIOPError(error)
      bulkQuotesModel.sendErrorCallback.mockImplementationOnce(() => true)

      // Act
      const result = await bulkQuotesModel.handleException('payeefsp', mockData.bulkQuoteId, error, mockData.headers, mockSpan)

      // Assert
      expect(bulkQuotesModel.sendErrorCallback).toHaveBeenCalledWith('payeefsp', expectedError, mockData.bulkQuoteId, mockData.headers, mockChildSpan, true)
      expect(result).toBe(true)
      expect(mockChildSpan.finish).toHaveBeenCalledTimes(1)
    })

    it('handles an error in sendErrorCallback', async () => {
      // Arrange
      expect.assertions(2)
      const error = new Error('Test Error')
      const expectedError = ErrorHandler.ReformatFSPIOPError(error)
      bulkQuotesModel.sendErrorCallback.mockImplementationOnce(() => { throw new Error('Error sending callback.') })

      // Act
      await bulkQuotesModel.handleException('payeefsp', mockData.bulkQuoteId, error, mockData.headers, mockSpan)

      // Assert
      expect(bulkQuotesModel.sendErrorCallback).toHaveBeenCalledWith('payeefsp', expectedError, mockData.bulkQuoteId, mockData.headers, mockChildSpan, true)
      expect(mockChildSpan.finish).toHaveBeenCalledTimes(1)
    })
  })

  describe('sendErrorCallback', () => {
    beforeEach(() => {
      // restore the current method in test to its original implementation
      bulkQuotesModel.sendErrorCallback.mockRestore()
    })

    it('sends the error callback without a span', async () => {
      // Arrange
      expect.assertions(1)
      bulkQuotesModel._getParticipantEndpoint.mockReturnValueOnce(mockData.endpoints.payeefsp)
      Util.generateRequestHeaders.mockReturnValueOnce({})
      const error = new Error('Test Error')
      const fspiopError = ErrorHandler.ReformatFSPIOPError(error)
      const expectedOptions = {
        method: Enum.Http.RestMethods.PUT,
        url: 'http://localhost:8444/payeefsp/bulkQuotes/test123/error',
        data: fspiopError.toApiErrorObject(mockConfig.errorHandling),
        headers: {}
      }

      // Act
      await bulkQuotesModel.sendErrorCallback('payeefsp', fspiopError, mockData.bulkQuoteId, mockData.headers)

      // Assert
      expect(axios.request).toBeCalledWith(expectedOptions)
    })

    it('sends the error callback and handles the span', async () => {
      // Arrange
      expect.assertions(3)
      bulkQuotesModel._getParticipantEndpoint.mockReturnValueOnce(mockData.endpoints.payeefsp)
      Util.generateRequestHeaders.mockReturnValueOnce({})
      const error = new Error('Test Error')
      const fspiopError = ErrorHandler.ReformatFSPIOPError(error)
      mockSpan.injectContextToHttpRequest = jest.fn().mockImplementation(() => ({
        headers: {
          spanHeaders: '12345'
        },
        method: Enum.Http.RestMethods.PUT,
        url: 'http://localhost:8444/payeefsp/quotes/test123/error',
        data: {}
      }))
      mockSpan.audit = jest.fn()
      const expectedOptions = {
        method: Enum.Http.RestMethods.PUT,
        url: 'http://localhost:8444/payeefsp/quotes/test123/error',
        data: {},
        headers: {
          spanHeaders: '12345'
        }
      }

      // Act
      await bulkQuotesModel.sendErrorCallback('payeefsp', fspiopError, mockData.bulkQuoteId, mockData.headers, mockSpan)

      // Assert
      expect(mockSpan.injectContextToHttpRequest).toBeCalledTimes(1)
      expect(mockSpan.audit).toBeCalledTimes(1)
      expect(axios.request).toBeCalledWith(expectedOptions)
    })

    it('sends the error callback JWS signed', async () => {
      // Arrange
      const jwsSignSpy = jest.spyOn(JwsSigner.prototype, 'getSignature')
      // expect.assertions(6)
      bulkQuotesModel._getParticipantEndpoint.mockReturnValueOnce(mockData.endpoints.payeefsp)
      Util.generateRequestHeaders.mockReturnValueOnce({})
      const error = new Error('Test Error')
      const fspiopError = ErrorHandler.ReformatFSPIOPError(error)
      mockSpan.injectContextToHttpRequest = jest.fn().mockImplementation(() => ({
        headers: {
          spanHeaders: '12345',
          'fspiop-source': mockConfig.hubName,
          'fspiop-destination': 'dfsp2'
        },
        method: Enum.Http.RestMethods.PUT,
        url: 'http://localhost:8444/payeefsp/quotes/test123/error',
        data: {}
      }))
      mockSpan.audit = jest.fn()
      mockConfig.jws.jwsSign = true
      mockConfig.jws.jwsSigningKey = jwsSigningKey
      // Act
      await bulkQuotesModel.sendErrorCallback('payeefsp', fspiopError, mockData.bulkQuoteId, mockData.headers, mockSpan, true)
      // Assert
      expect(mockSpan.injectContextToHttpRequest).toBeCalledTimes(1)
      expect(mockSpan.audit).toBeCalledTimes(1)
      expect(jwsSignSpy).toBeCalledTimes(1)
      expect(axios.request.mock.calls[0][0].headers).toHaveProperty('fspiop-signature')
      expect(axios.request.mock.calls[0][0].headers['fspiop-signature']).toEqual(expect.stringContaining('signature'))
      expect(axios.request.mock.calls[0][0].headers['fspiop-signature']).toEqual(expect.stringContaining('protectedHeader'))
      jwsSignSpy.mockRestore()
    })

    it('sends the error callback NOT JWS signed', async () => {
      // Arrange
      const jwsSignSpy = jest.spyOn(JwsSigner.prototype, 'getSignature')
      expect.assertions(5)
      bulkQuotesModel._getParticipantEndpoint.mockReturnValueOnce(mockData.endpoints.payeefsp)
      Util.generateRequestHeaders.mockReturnValueOnce({})
      const error = new Error('Test Error')
      const fspiopError = ErrorHandler.ReformatFSPIOPError(error)
      mockSpan.injectContextToHttpRequest = jest.fn().mockImplementation(() => ({
        headers: {
          spanHeaders: '12345',
          'fspiop-source': mockConfig.hubName,
          'fspiop-destination': 'dfsp2'
        },
        method: Enum.Http.RestMethods.PUT,
        url: 'http://localhost:8444/payeefsp/quotes/test123/error',
        data: {}
      }))
      mockSpan.audit = jest.fn()
      const expectedOptions = {
        method: Enum.Http.RestMethods.PUT,
        url: 'http://localhost:8444/payeefsp/quotes/test123/error',
        data: {},
        headers: {
          spanHeaders: '12345',
          'fspiop-source': mockConfig.hubName,
          'fspiop-destination': 'dfsp2'
        }
      }
      mockConfig.jws.jwsSign = false
      // Act
      await bulkQuotesModel.sendErrorCallback('payeefsp', fspiopError, mockData.bulkQuoteId, mockData.headers, mockSpan, true)
      // Assert
      expect(mockSpan.injectContextToHttpRequest).toBeCalledTimes(1)
      expect(mockSpan.audit).toBeCalledTimes(1)
      expect(jwsSignSpy).not.toHaveBeenCalled()
      expect(axios.request.mock.calls[0][0].headers).not.toHaveProperty('fspiop-signature')
      expect(axios.request).toBeCalledWith(expectedOptions)
      jwsSignSpy.mockRestore()
    })

    it('sends the error callback NOT JWS signed', async () => {
      // Arrange
      const jwsSignSpy = jest.spyOn(JwsSigner.prototype, 'getSignature')
      expect.assertions(5)
      bulkQuotesModel._getParticipantEndpoint.mockReturnValueOnce(mockData.endpoints.payeefsp)
      Util.generateRequestHeaders.mockReturnValueOnce({})
      const error = new Error('Test Error')
      const fspiopError = ErrorHandler.ReformatFSPIOPError(error)
      mockSpan.injectContextToHttpRequest = jest.fn().mockImplementation(() => ({
        headers: {
          spanHeaders: '12345',
          'fspiop-source': mockConfig.hubName,
          'fspiop-destination': 'dfsp2'
        },
        method: Enum.Http.RestMethods.PUT,
        url: 'http://localhost:8444/payeefsp/quotes/test123/error',
        data: {}
      }))
      mockSpan.audit = jest.fn()
      const expectedOptions = {
        method: Enum.Http.RestMethods.PUT,
        url: 'http://localhost:8444/payeefsp/quotes/test123/error',
        data: {},
        headers: {
          spanHeaders: '12345',
          'fspiop-source': mockConfig.hubName,
          'fspiop-destination': 'dfsp2'
        }
      }
      mockConfig.jws.jwsSign = false
      // Act
      await bulkQuotesModel.sendErrorCallback('payeefsp', fspiopError, mockData.bulkQuoteId, mockData.headers, mockSpan, false)
      // Assert
      expect(mockSpan.injectContextToHttpRequest).toBeCalledTimes(1)
      expect(mockSpan.audit).toBeCalledTimes(1)
      expect(jwsSignSpy).not.toHaveBeenCalled()
      expect(axios.request.mock.calls[0][0].headers).not.toHaveProperty('fspiop-signature')
      expect(axios.request).toBeCalledWith(expectedOptions)
      jwsSignSpy.mockRestore()
    })

    it('rethrows error thrown in JwsSigner with metrics disabled', async () => {
      // Arrange
      expect.assertions(1)
      const jwsSignSpy = jest.spyOn(JwsSigner.prototype, 'getSignature')
      bulkQuotesModel._getParticipantEndpoint.mockReturnValueOnce(mockData.endpoints.payeefsp)
      Util.generateRequestHeaders.mockReturnValueOnce({})
      const error = new Error('Test Error')
      const fspiopError = ErrorHandler.ReformatFSPIOPError(error)
      mockSpan.injectContextToHttpRequest = jest.fn().mockImplementation(() => ({
        headers: {
          spanHeaders: '12345',
          'fspiop-source': mockConfig.hubName,
          'fspiop-destination': 'dfsp2'
        },
        method: Enum.Http.RestMethods.PUT,
        url: 'http://localhost:8444/payeefsp/quotes/test123/error',
        data: {}
      }))
      mockSpan.audit = jest.fn()
      mockConfig.jws.jwsSign = true
      mockConfig.jws.jwsSigningKey = jwsSigningKey
      jwsSignSpy.mockImplementationOnce(() => { throw new Error('Test Error') })
      bulkQuotesModel.envConfig.instrumentationMetricsDisabled = true
      // Act
      await expect(bulkQuotesModel.sendErrorCallback('payeefsp', fspiopError, mockData.bulkQuoteId, mockData.headers, mockSpan, true))
        .rejects
        .toThrowError()
      // Assert
      jwsSignSpy.mockRestore()
    })

    it('handles when the endpoint could not be found', async () => {
      // Arrange
      expect.assertions(2)
      bulkQuotesModel._getParticipantEndpoint.mockReturnValueOnce(undefined)
      Util.generateRequestHeaders.mockReturnValueOnce({})
      const error = new Error('Test Error')
      const fspiopError = ErrorHandler.ReformatFSPIOPError(error)

      // Act
      const action = async () => bulkQuotesModel.sendErrorCallback('payeefsp', fspiopError, mockData.bulkQuoteId, mockData.headers, mockSpan)

      // Assert
      await expect(action()).rejects.toThrow('No FSPIOP_CALLBACK_URL_BULK_QUOTES found for payeefsp unable to make error callback')
      expect(axios.request).not.toHaveBeenCalled()
    })

    it('handles when the endpoint could not be found with metrics disabled', async () => {
      // Arrange
      expect.assertions(2)
      bulkQuotesModel.envConfig.instrumentationMetricsDisabled = true
      bulkQuotesModel._getParticipantEndpoint.mockReturnValueOnce(undefined)
      Util.generateRequestHeaders.mockReturnValueOnce({})
      const error = new Error('Test Error')
      const fspiopError = ErrorHandler.ReformatFSPIOPError(error)

      // Act
      const action = async () => bulkQuotesModel.sendErrorCallback('payeefsp', fspiopError, mockData.bulkQuoteId, mockData.headers, mockSpan)

      // Assert
      await expect(action()).rejects.toThrow('No FSPIOP_CALLBACK_URL_BULK_QUOTES found for payeefsp unable to make error callback')
      expect(axios.request).not.toHaveBeenCalled()
    })

    it('handles a http exception', async () => {
      // Arrange
      expect.assertions(2)
      bulkQuotesModel._getParticipantEndpoint.mockReturnValueOnce(mockData.endpoints.payeefsp)
      Util.generateRequestHeaders.mockReturnValueOnce({})
      const error = new Error('Test Error')
      const fspiopError = ErrorHandler.ReformatFSPIOPError(error)
      axios.request.mockImplementationOnce(() => { throw new Error('HTTP test error') })

      // Act
      const action = async () => bulkQuotesModel.sendErrorCallback('payeefsp', fspiopError, mockData.bulkQuoteId, mockData.headers)

      // Assert
      await expect(action()).rejects.toThrow('network error in sendErrorCallback: HTTP test error')
      expect(axios.request).toHaveBeenCalledTimes(1)
    })

    it('handles a http bad status code', async () => {
      // Arrange
      expect.assertions(2)
      bulkQuotesModel._getParticipantEndpoint.mockReturnValueOnce(mockData.endpoints.payeefsp)
      Util.generateRequestHeaders.mockReturnValueOnce({})
      const error = new Error('Test Error')
      const fspiopError = ErrorHandler.ReformatFSPIOPError(error)
      axios.request.mockReturnValueOnce({
        status: Enum.Http.ReturnCodes.BADREQUEST.CODE
      })

      // Act
      const action = async () => bulkQuotesModel.sendErrorCallback('payeefsp', fspiopError, mockData.bulkQuoteId, mockData.headers)

      // Assert
      await expect(action()).rejects.toThrow('Got non-success response sending error callback')
      expect(axios.request).toHaveBeenCalledTimes(1)
    })

    it('handles a http bad status code with metrics disabled', async () => {
      // Arrange
      expect.assertions(2)
      bulkQuotesModel.envConfig.instrumentationMetricsDisabled = true
      bulkQuotesModel._getParticipantEndpoint.mockReturnValueOnce(mockData.endpoints.payeefsp)
      Util.generateRequestHeaders.mockReturnValueOnce({})
      const error = new Error('Test Error')
      const fspiopError = ErrorHandler.ReformatFSPIOPError(error)
      axios.request.mockReturnValueOnce({
        status: Enum.Http.ReturnCodes.BADREQUEST.CODE
      })

      // Act
      const action = async () => bulkQuotesModel.sendErrorCallback('payeefsp', fspiopError, mockData.bulkQuoteId, mockData.headers)

      // Assert
      await expect(action()).rejects.toThrow('Got non-success response sending error callback')
      expect(axios.request).toHaveBeenCalledTimes(1)
    })
  })

  describe('writeLog', () => {
    beforeEach(() => {
      // restore the current method in test to its original implementation
      bulkQuotesModel.writeLog.mockRestore()
    })

    it('writes to the log', () => {
      // Arrange
      bulkQuotesModel.log.debug = jest.fn()
      // Act
      bulkQuotesModel.writeLog('test message')
      // Assert
      expect(bulkQuotesModel.log.debug).toBeCalledTimes(1)
    })
  })

  describe('_getParticipantEndpoint', () => {
    beforeEach(() => {
      // restore the current method in test to its original implementation
      bulkQuotesModel._getParticipantEndpoint.mockRestore()
      Util.getParticipantEndpoint.mockRestore()
    })

    it('should call util.getParticipantEndpoint', async () => {
      // Arrange
      const endpoint = 'http://localhost:8444/payeefsp'
      Util.getParticipantEndpoint.mockReturnValueOnce(endpoint)
      // Act
      await bulkQuotesModel._getParticipantEndpoint('payeefsp')
      // Assert
      expect(Util.getParticipantEndpoint).toBeCalledTimes(1)
    })
  })
})
