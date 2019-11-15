/*****
 License
 --------------
 Copyright © 2017 Bill & Melinda Gates Foundation
 The Mojaloop files are made available by the Bill & Melinda Gates Foundation under the Apache License, Version 2.0 (the 'License') and you may not use these files except in compliance with the License. You may obtain a copy of the License at
 http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, the Mojaloop files are distributed on an 'AS IS' BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.

 Initial contribution
 --------------------
 The initial functionality and code base was donated by the Mowali project working in conjunction with MTN and Orange as service provides.
 * Project: Mowali

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

 * ModusBox
 - Georgi Georgiev <georgi.georgiev@modusbox.com>
 - Matt Kingston <matt.kingston@modusbox.com>
 - Vassilis Barzokas <vassilis.barzokas@modusbox.com>
 --------------
 ******/
'use strict'

const axios = require('axios')

const clone = require('@mojaloop/central-services-shared').Util.clone
const ErrorHandler = require('@mojaloop/central-services-error-handling')
const EventSdk = require('@mojaloop/event-sdk')

const Db = require('../../../src/data/database')
const envConfig = require('../../../config/default')
const QuotesModel = require('../../../src/model/quotes')
const rules = require('../../../config/rules')
const RulesEngine = require('../../../src/model/rules')

jest.mock('axios')
jest.mock('@mojaloop/central-services-logger')
jest.mock('../../../src/data/database')
jest.mock('../../../src/model/rules')

describe('QuotesModel', () => {
  const defaultEnvConfig = JSON.parse(JSON.stringify(envConfig))
  const defaultRules = JSON.parse(JSON.stringify(rules))

  let mockData
  let mockTransaction
  let mockChildSpan
  let mockSpan
  let quotesModel

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
      isFinished: undefined,
      finish: jest.fn()
    }
    mockSpan = {
      getChild: jest.fn(() => mockChildSpan),
      error: jest.fn(),
      finish: jest.fn()
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
        'fspiop-source': 'dfsp1',
        'fspiop-destination': 'dfsp2'
      },
      initiatorType: 'fakeInitiatorType',
      initiator: 'fakeInitiator',
      quoteId: 'test123',
      quoteRequest: {
        quoteId: 'test123',
        transactionId: 'abc123',
        payee: {
          partyIdInfo: {
            partyIdType: 'MSISDN',
            partyIdentifier: '27824592509',
            fspId: 'dfsp2'
          }
        },
        payer: {
          partyIdInfo: {
            partyIdType: 'MSISDN',
            partyIdentifier: '27713803905',
            fspId: 'dfsp1'
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
        }
      },
      quoteUpdate: {
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
        geoCode: {
          latitude: '42.69751',
          longitude: '23.32415'
        },
        ilpPacket: '<ilpPacket>',
        condition: 'HOr22-H3AfTDHrSkPjJtVPRdKouuMkDXTR4ejlQa8Ks',
        extensionList: {
          extension: [{
            key: 'key1',
            value: 'value1'
          }]
        }
      },
      rules: [
        {
          conditions: {
            all: [
              {
                fact: 'json-path',
                params: {
                  fact: 'payload',
                  path: '$.payload.extensionList[?(@.key == "KYCPayerTier")].value'
                },
                operator: 'deepEqual',
                value: ['1']
              },
              {
                fact: 'payload',
                path: '.amount.currency',
                operator: 'notIn',
                value: {
                  fact: 'json-path',
                  params: {
                    fact: 'payee',
                    path: '$.payee.accounts[?(@.ledgerAccountType == "SETTLEMENT")].currency'
                  }
                }
              }
            ]
          },
          event: {
            type: 'INTERCEPT_QUOTE',
            params: {
              rerouteToFsp: 'DFSPEUR'
            }
          }
        },
        {
          conditions: {
            all: [
              {
                fact: 'json-path',
                params: {
                  fact: 'payload',
                  path: '$.payload.extensionList[?(@.key == "KYCPayerTier")].value'
                },
                operator: 'notDeepEqual',
                value: ['1']
              },
              {
                fact: 'payload',
                path: '.amount.currency',
                operator: 'notIn',
                value: {
                  fact: 'json-path',
                  params: {
                    fact: 'payee',
                    path: '$.payee.accounts[?(@.ledgerAccountType == "SETTLEMENT")].currency'
                  }
                }
              }
            ]
          },
          event: {
            type: 'INVALID_QUOTE_REQUEST',
            params: {
              FSPIOPError: 'PAYEE_UNSUPPORTED_CURRENCY',
              message: 'The requested payee does not support the payment currency'
            }
          }
        }
      ],
      scenario: 'fakeScenario',
      subScenario: 'fakeSubScenario',
      transactionReference: 'fakeTxRef'
    }

    quotesModel = new QuotesModel({
      db: new Db(),
      requestId: mockData.quoteRequest.quoteId
    })
    quotesModel.db.newTransaction.mockImplementation(() => mockTransaction)

    quotesModel.db.createTransactionReference.mockImplementation(() => mockData.transactionReference)
    quotesModel.db.getInitiatorType.mockImplementation(() => mockData.initiatorType)
    quotesModel.db.getInitiator.mockImplementation(() => mockData.initiator)
    quotesModel.db.getScenario.mockImplementation(() => mockData.scenario)
    quotesModel.db.getSubScenario.mockImplementation(() => mockData.subScenario)
    quotesModel.db.getAmountType.mockImplementation(() => mockData.amountTypeId)
    quotesModel.db.createQuote.mockImplementation(() => mockData.quoteRequest.quoteId)
    quotesModel.db.createPayerQuoteParty.mockImplementation(() => mockData.quoteRequest.payer.partyIdInfo.fspId)
    quotesModel.db.createPayeeQuoteParty.mockImplementation(() => mockData.quoteRequest.payee.partyIdInfo.fspId)
    quotesModel.db.createGeoCode.mockImplementation(() => mockData.geoCode)

    // make all methods of the quotesModel instance be a mock. This helps us re-mock in every
    // method's test suite.
    const propertyNames = Object.getOwnPropertyNames(QuotesModel.prototype)
    propertyNames.forEach((methodName) => {
      jest.spyOn(quotesModel, methodName).mockImplementation(() => {
        return {}
      })
    })

    // some unit tests rely on specific results from some methods so we explicitly define them below
    jest.spyOn(quotesModel, 'handleRuleEvents').mockImplementation(jest.fn(() => {
      return {
        headers: mockData.headers,
        quoteRequest: mockData.quoteRequest
      }
    }))
  })
  afterEach(() => {
    // Clears the mock.calls and mock.instances properties of all mocks.
    // Equivalent to calling .mockClear() on every mocked function.
    jest.clearAllMocks()

    // reset the configuration values to their initials, but without changing the object's reference
    // as we use the same object between the current unit tests file and the code's implementation
    Object.keys(defaultEnvConfig).forEach(key => {
      envConfig[key] = defaultEnvConfig[key]
    })

    Object.keys(defaultRules).forEach(key => {
      rules[key] = defaultRules[key]
    })
  })

  describe('executeRules', () => {
    beforeEach(() => {
      quotesModel.executeRules.mockRestore()
    })

    describe('Failures:', () => {
      describe('In case a non empty set of rules is loaded', () => {
        it('throws an unhandled exception if the first attempt of `axios.request` throws an exception', async () => {
          axios.request.mockImplementationOnce(() => { throw new Error('foo') })

          await expect(quotesModel.executeRules(mockData.headers, mockData.quoteRequest))
            .rejects
            .toHaveProperty('message', 'foo')

          expect(axios.request.mock.calls.length).toBe(1)
          expect(axios.request.mock.calls[0][0]).toEqual({ url: 'http://localhost:3001/participants/' + mockData.headers['fspiop-source'] })
        })

        it('throws an unhandled exception if the second attempt of `axios.request` throws an exception', async () => {
          axios.request
            .mockImplementationOnce(() => { return { success: true } })
            .mockImplementationOnce(() => { throw new Error('foo') })

          await expect(quotesModel.executeRules(mockData.headers, mockData.quoteRequest))
            .rejects
            .toHaveProperty('message', 'foo')

          expect(axios.request.mock.calls.length).toBe(2)
          expect(axios.request.mock.calls[0][0]).toEqual({ url: 'http://localhost:3001/participants/' + mockData.headers['fspiop-source'] })
          expect(axios.request.mock.calls[1][0]).toEqual({ url: 'http://localhost:3001/participants/' + mockData.headers['fspiop-destination'] })
        })

        it('throws an unhandled exception if the first attempt of `axios.request` fails', async () => {
          axios.request
            .mockImplementationOnce(() => { return Promise.reject(new Error('foo')) })
            .mockImplementationOnce(() => { return Promise.resolve({ ok: true }) })

          await expect(quotesModel.executeRules(mockData.headers, mockData.quoteRequest))
            .rejects
            .toHaveProperty('message', 'foo')

          expect(axios.request.mock.calls[0][0]).toEqual({ url: 'http://localhost:3001/participants/' + mockData.headers['fspiop-source'] })
          expect(axios.request.mock.calls[1][0]).toEqual({ url: 'http://localhost:3001/participants/' + mockData.headers['fspiop-destination'] })
        })

        it('throws an unhandled exception if the second attempt of `axios.request` fails', async () => {
          axios.request
            .mockImplementationOnce(() => { return Promise.resolve({ ok: true }) })
            .mockImplementationOnce(() => { return Promise.reject(new Error('foo')) })

          await expect(quotesModel.executeRules(mockData.headers, mockData.quoteRequest))
            .rejects
            .toHaveProperty('message', 'foo')

          expect(axios.request.mock.calls.length).toBe(2)
          expect(axios.request.mock.calls[0][0]).toEqual({ url: 'http://localhost:3001/participants/' + mockData.headers['fspiop-source'] })
          expect(axios.request.mock.calls[1][0]).toEqual({ url: 'http://localhost:3001/participants/' + mockData.headers['fspiop-destination'] })
        })

        it('throws an unhandled exception if `RulesEngine.run` throws an exception', async () => {
          RulesEngine.run.mockImplementation(() => { throw new Error('foo') })

          await expect(quotesModel.executeRules(mockData.headers, mockData.quoteRequest))
            .rejects
            .toHaveProperty('message', 'foo')

          expect(axios.request.mock.calls.length).toBe(2)
          expect(axios.request.mock.calls[0][0]).toEqual({ url: 'http://localhost:3001/participants/' + mockData.headers['fspiop-source'] })
          expect(axios.request.mock.calls[1][0]).toEqual({ url: 'http://localhost:3001/participants/' + mockData.headers['fspiop-destination'] })
        })
      })
    })

    describe('Success:', () => {
      describe('In case an empty set of rules is loaded', () => {
        beforeEach(() => {
          // keep the reference to the original rules array, as it the same values are used by
          // the current unit tests file and the code's implementation
          rules.length = 0
        })

        it('stops execution', async () => {
          expect(rules.length).toBe(0)

          await expect(quotesModel.executeRules(mockData.headers, mockData.quoteRequest))
            .resolves
            .toEqual([])

          expect(axios.request.mock.calls.length).toBe(0)
        })
      })
      describe('In case a non empty set of rules is loaded', () => {
        it('returns the result of `RulesEngine.run`', async () => {
          const expectedEvents = []

          expect(rules.length).not.toBe(0)

          rules.forEach((rule) => {
            expectedEvents.push(rule.event)
          })

          RulesEngine.run.mockImplementation(() => {
            return {
              events: expectedEvents
            }
          })

          await expect(quotesModel.executeRules(mockData.headers, mockData.quoteRequest))
            .resolves
            .toEqual(expectedEvents)

          expect(axios.request.mock.calls.length).toBe(2)
          expect(axios.request.mock.calls[0][0]).toEqual({ url: 'http://localhost:3001/participants/' + mockData.headers['fspiop-source'] })
          expect(axios.request.mock.calls[1][0]).toEqual({ url: 'http://localhost:3001/participants/' + mockData.headers['fspiop-destination'] })
        })
      })
    })
  })

  describe('handleRuleEvents', () => {
    beforeEach(() => {
      quotesModel.handleRuleEvents.mockRestore()
    })

    describe('Failures:', () => {
      describe('In case one event is passed', () => {
        let mockEvents

        describe('In case it has type of `INVALID_QUOTE_REQUEST`', () => {
          beforeEach(() => {
            mockEvents = [mockData.rules[1].event]
          })

          it('throws an exception according to the error type specified inside the event\'s parameters', async () => {
            await expect(quotesModel.handleRuleEvents(mockEvents, mockData.headers, mockData.quoteRequest))
              .rejects
              .toHaveProperty('apiErrorCode.code', ErrorHandler.Enums.FSPIOPErrorCodes[mockData.rules[1].event.params.FSPIOPError].code)
          })
        })
        describe('In case it has an unknown type', () => {
          beforeEach(() => {
            mockEvents = [mockData.rules[0].event]
            mockEvents[0].type = 'something-that-is-not-known'
          })

          it('throws an exception with an appropriate error message', async () => {
            await expect(quotesModel.handleRuleEvents(mockEvents, mockData.headers, mockData.quoteRequest))
              .rejects
              .toHaveProperty('message', 'Unhandled event returned by rules engine')
          })
        })
      })
      describe('In case multiple events are passed', () => {
        let mockEvents

        describe('In case one of them has type of `INVALID_QUOTE_REQUEST`', () => {
          beforeEach(() => {
            mockEvents = [mockData.rules[0].event, mockData.rules[1].event]
          })

          it('throws an exception according to the error type specified inside the event\'s parameters', async () => {
            await expect(quotesModel.handleRuleEvents(mockEvents, mockData.headers, mockData.quoteRequest))
              .rejects
              .toHaveProperty('apiErrorCode.code', ErrorHandler.Enums.FSPIOPErrorCodes[mockData.rules[1].event.params.FSPIOPError].code)
          })
        })
        describe('In case more than one have type of `INTERCEPT_QUOTE`', () => {
          beforeEach(() => {
            mockEvents = [mockData.rules[0].event, mockData.rules[0].event]
          })

          it('throws an exception with an appropriate error message', async () => {
            await expect(quotesModel.handleRuleEvents(mockEvents, mockData.headers, mockData.quoteRequest))
              .rejects
              .toHaveProperty('message', 'Multiple intercept quote events received')
          })
        })
        describe('In case one of them has an unknown type and one of them has type of `INTERCEPT_QUOTE`', () => {
          beforeEach(() => {
            mockEvents = [
              clone(mockData.rules[0].event),
              clone(mockData.rules[0].event)
            ]
            mockEvents[0].type = 'something-that-is-not-known'
          })

          it('throws an exception with an appropriate error message', async () => {
            await expect(quotesModel.handleRuleEvents(mockEvents, mockData.headers, mockData.quoteRequest))
              .rejects
              .toHaveProperty('message', 'Unhandled event returned by rules engine')
          })
        })
        describe('In case all of them have an unknown type', () => {
          beforeEach(() => {
            mockEvents = [
              clone(mockData.rules[0].event),
              clone(mockData.rules[0].event)
            ]
            mockEvents[0].type = 'something-that-is-not-known-1'
            mockEvents[1].type = 'something-that-is-not-known-2'
          })

          it('throws an exception with an appropriate error message', async () => {
            await expect(quotesModel.handleRuleEvents(mockEvents, mockData.headers, mockData.quoteRequest))
              .rejects
              .toHaveProperty('message', 'Unhandled event returned by rules engine')
          })
        })
      })
    })
    describe('Success:', () => {
      describe('In case no events are passed', () => {
        it('terminates execution and passes back an appropriate result', async () => {
          await expect(quotesModel.handleRuleEvents([], mockData.headers, mockData.quoteRequest)).resolves.toStrictEqual({
            terminate: false,
            quoteRequest: mockData.quoteRequest,
            headers: mockData.headers
          })
        })
      })
      describe('In case one event is passed', () => {
        let mockEvents

        describe('In case it has type of `INTERCEPT_QUOTE`', () => {
          beforeEach(() => {
            mockEvents = [mockData.rules[0].event]
          })

          it('returns an expected response object', async () => {
            await expect(quotesModel.handleRuleEvents(mockEvents, mockData.headers, mockData.quoteRequest))
              .resolves
              .toStrictEqual({
                terminate: false,
                quoteRequest: mockData.quoteRequest,
                headers: {
                  ...mockData.headers,
                  'fspiop-destination': mockEvents[0].params.rerouteToFsp
                }
              })
          })
        })
      })
    })
  })
  describe('validateQuoteRequest', () => {
    beforeEach(() => {
      // restore the current method in test to its original implementation
      quotesModel.validateQuoteRequest.mockRestore()
    })

    it('should validate fspiopSource and fspiopDestination', async () => {
      expect.assertions(5)

      const fspiopSource = 'dfsp1'
      const fspiopDestination = 'dfsp2'

      expect(quotesModel.db.getParticipant).not.toHaveBeenCalled() // Validates mockClear()

      await quotesModel.validateQuoteRequest(fspiopSource, fspiopDestination, mockData.quoteRequest)

      expect(quotesModel.db).toBeTruthy() // Constructor should have been called
      expect(quotesModel.db.getParticipant).toHaveBeenCalledTimes(2)
      expect(quotesModel.db.getParticipant.mock.calls[0][0]).toBe(fspiopSource)
      expect(quotesModel.db.getParticipant.mock.calls[1][0]).toBe(fspiopDestination)
    })
    it('should throw internal error if no quoteRequest was supplied', async () => {
      expect.assertions(4)

      const fspiopSource = 'dfsp1'
      const fspiopDestination = 'dfsp2'
      const quoteRequest = undefined

      expect(quotesModel.db.getParticipant).not.toHaveBeenCalled() // Validates mockClear()

      await expect(quotesModel.validateQuoteRequest(fspiopSource, fspiopDestination, quoteRequest))
        .rejects
        .toHaveProperty('apiErrorCode.code', ErrorHandler.Enums.FSPIOPErrorCodes.INTERNAL_SERVER_ERROR.code)

      expect(quotesModel.db).toBeTruthy() // Constructor should have been called
      expect(quotesModel.db.getParticipant).not.toHaveBeenCalled()
    })
  })
  describe('validateQuoteUpdate', () => {
    beforeEach(() => {
      // restore the current method in test to its original implementation
      quotesModel.validateQuoteUpdate.mockRestore()
    })

    it('should validate quote update', async () => {
      const result = await quotesModel.validateQuoteUpdate()
      expect(result).toBeNull()
    })
  })
  describe('handleQuoteRequest', () => {
    beforeEach(() => {
      // restore the current method in test to its original implementation
      quotesModel.handleQuoteRequest.mockRestore()
    })

    describe('Failures:', () => {
      describe('Before forwarding the request:', () => {
        it('throws an exception if `executeRules` fails', async () => {
          expect.assertions(1)

          const fspiopError = ErrorHandler.CreateFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.INTERNAL_SERVER_ERROR)

          quotesModel.executeRules = jest.fn(() => { throw fspiopError })

          await expect(quotesModel.handleQuoteRequest(mockData.headers, mockData.quoteRequest, mockSpan))
            .rejects
            .toBe(fspiopError)
        })
        it('throws an exception if `handleRuleEvents` fails', async () => {
          expect.assertions(1)

          const fspiopError = ErrorHandler.CreateFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.INTERNAL_SERVER_ERROR)

          quotesModel.handleRuleEvents = jest.fn(() => { throw fspiopError })

          await expect(quotesModel.handleQuoteRequest(mockData.headers, mockData.quoteRequest, mockSpan))
            .rejects
            .toBe(fspiopError)
        })
        it('stops execution and returns an undefined value if `handleRuleEvents` returns a truthy value for `terminate`', async () => {
          expect.assertions(3)

          quotesModel.handleRuleEvents = jest.fn(() => {
            return {
              terminate: true
            }
          })

          await expect(quotesModel.handleQuoteRequest(mockData.headers, mockData.quoteRequest, mockSpan))
            .resolves
            .toBe(undefined)
          expect(quotesModel.validateQuoteRequest).not.toBeCalled()
          expect(quotesModel.forwardQuoteRequest).not.toBeCalled()
        })
        it('throws an exception if `validateQuoteRequest` fails', async () => {
          expect.assertions(1)

          const fspiopError = ErrorHandler.CreateFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.INTERNAL_SERVER_ERROR)

          quotesModel.validateQuoteRequest = jest.fn(() => { throw fspiopError })

          await expect(quotesModel.handleQuoteRequest(mockData.headers, mockData.quoteRequest, mockSpan))
            .rejects
            .toBe(fspiopError)
        })
        describe('In case environment is not configured for simple routing mode', () => {
          beforeEach(() => {
            envConfig.SIMPLE_ROUTING_MODE = false
          })

          it('throws an exception if `db.newTransaction` fails', async () => {
            expect.assertions(1)

            const dbError = new Error('foo')
            const fspiopError = ErrorHandler.ReformatFSPIOPError(dbError)

            quotesModel.db.newTransaction = jest.fn(() => { throw dbError })

            await expect(quotesModel.handleQuoteRequest(mockData.headers, mockData.quoteRequest, mockSpan))
              .rejects
              .toEqual(fspiopError)
          })
          it('throws an exception if `checkDuplicateQuoteRequest` fails', async () => {
            expect.assertions(1)

            const fspiopError = ErrorHandler.CreateFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.INTERNAL_SERVER_ERROR)
            quotesModel.checkDuplicateQuoteRequest = jest.fn(() => { throw fspiopError })

            await expect(quotesModel.handleQuoteRequest(mockData.headers, mockData.quoteRequest, mockSpan))
              .rejects
              .toBe(fspiopError)
          })
          it('throws an exception if the request is marked as duplicate and is instructed not to resend', async () => {
            expect.assertions(1)

            quotesModel.checkDuplicateQuoteRequest = jest.fn(() => {
              return {
                isDuplicateId: true,
                resend: false
              }
            })

            await expect(quotesModel.handleQuoteRequest(mockData.headers, mockData.quoteRequest, mockSpan))
              .rejects
              .toHaveProperty('apiErrorCode.code', ErrorHandler.Enums.FSPIOPErrorCodes.MODIFIED_REQUEST.code)
          })
          it('throws an exception if `calculateRequestHash` fails', async () => {
            expect.assertions(1)

            const fspiopError = ErrorHandler.CreateFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.INTERNAL_SERVER_ERROR)

            quotesModel.calculateRequestHash = jest.fn(() => { throw fspiopError })

            await expect(quotesModel.handleQuoteRequest(mockData.headers, mockData.quoteRequest, mockSpan))
              .rejects
              .toBe(fspiopError)
          })
          it('throws an exception if `db.createQuoteDuplicateCheck` fails', async () => {
            expect.assertions(1)

            const dbError = new Error('foo')
            const fspiopError = ErrorHandler.ReformatFSPIOPError(dbError)

            quotesModel.db.createQuoteDuplicateCheck = jest.fn(() => { throw dbError })

            await expect(quotesModel.handleQuoteRequest(mockData.headers, mockData.quoteRequest, mockSpan))
              .rejects
              .toEqual(fspiopError)
          })
          it('throws an exception if `db.createTransactionReference` fails', async () => {
            expect.assertions(1)

            const dbError = new Error('foo')
            const fspiopError = ErrorHandler.ReformatFSPIOPError(dbError)

            quotesModel.db.createTransactionReference = jest.fn(() => { throw dbError })

            await expect(quotesModel.handleQuoteRequest(mockData.headers, mockData.quoteRequest, mockSpan))
              .rejects
              .toEqual(fspiopError)
          })
          it('throws an exception if `db.getInitiatorType` fails', async () => {
            expect.assertions(1)

            const dbError = new Error('foo')
            const fspiopError = ErrorHandler.ReformatFSPIOPError(dbError)

            quotesModel.db.getInitiatorType = jest.fn(() => { throw dbError })

            await expect(quotesModel.handleQuoteRequest(mockData.headers, mockData.quoteRequest, mockSpan))
              .rejects
              .toEqual(fspiopError)
          })
          it('throws an exception if `db.getInitiator` fails', async () => {
            expect.assertions(1)

            const dbError = new Error('foo')
            const fspiopError = ErrorHandler.ReformatFSPIOPError(dbError)

            quotesModel.db.getInitiator = jest.fn(() => { throw dbError })

            await expect(quotesModel.handleQuoteRequest(mockData.headers, mockData.quoteRequest, mockSpan))
              .rejects
              .toEqual(fspiopError)
          })
          it('throws an exception if `db.getScenario` fails', async () => {
            expect.assertions(1)

            const dbError = new Error('foo')
            const fspiopError = ErrorHandler.ReformatFSPIOPError(dbError)

            quotesModel.db.getScenario = jest.fn(() => { throw dbError })

            await expect(quotesModel.handleQuoteRequest(mockData.headers, mockData.quoteRequest, mockSpan))
              .rejects
              .toEqual(fspiopError)
          })
          describe('In case a sub scenario is specified in the incoming quote request:', () => {
            it('throws an exception if `db.getSubScenario` fails', async () => {
              expect.assertions(1)

              mockData.quoteRequest.transactionType.subScenario = true

              const dbError = new Error('foo')
              const fspiopError = ErrorHandler.ReformatFSPIOPError(dbError)

              quotesModel.db.getSubScenario = jest.fn(() => { throw dbError })

              await expect(quotesModel.handleQuoteRequest(mockData.headers, mockData.quoteRequest, mockSpan))
                .rejects
                .toEqual(fspiopError)
            })
          })
          it('throws an exception if `db.getAmountType` fails', async () => {
            expect.assertions(1)

            const dbError = new Error('foo')
            const fspiopError = ErrorHandler.ReformatFSPIOPError(dbError)

            quotesModel.db.getAmountType = jest.fn(() => { throw dbError })

            await expect(quotesModel.handleQuoteRequest(mockData.headers, mockData.quoteRequest, mockSpan))
              .rejects
              .toEqual(fspiopError)
          })
          it('throws an exception if `db.createQuote` fails', async () => {
            expect.assertions(1)

            const dbError = new Error('foo')
            const fspiopError = ErrorHandler.ReformatFSPIOPError(dbError)

            quotesModel.db.createQuote = jest.fn(() => { throw dbError })

            await expect(quotesModel.handleQuoteRequest(mockData.headers, mockData.quoteRequest, mockSpan))
              .rejects
              .toEqual(fspiopError)
          })
          it('throws an exception if `db.createPayerQuoteParty` fails', async () => {
            expect.assertions(1)

            const dbError = new Error('foo')
            const fspiopError = ErrorHandler.ReformatFSPIOPError(dbError)

            quotesModel.db.createPayerQuoteParty = jest.fn(() => { throw dbError })

            await expect(quotesModel.handleQuoteRequest(mockData.headers, mockData.quoteRequest, mockSpan))
              .rejects
              .toEqual(fspiopError)
          })
          it('throws an exception if `db.createPayeeQuoteParty` fails', async () => {
            expect.assertions(1)

            const dbError = new Error('foo')
            const fspiopError = ErrorHandler.ReformatFSPIOPError(dbError)

            quotesModel.db.createPayeeQuoteParty = jest.fn(() => { throw dbError })

            await expect(quotesModel.handleQuoteRequest(mockData.headers, mockData.quoteRequest, mockSpan))
              .rejects
              .toEqual(fspiopError)
          })
          describe('In case a `geoCode` exists in the incoming quote request:', () => {
            it('throws an exception if `db.createGeoCode` fails', async () => {
              expect.assertions(1)

              const dbError = new Error('foo')
              const fspiopError = ErrorHandler.ReformatFSPIOPError(dbError)

              quotesModel.db.createGeoCode = jest.fn(() => { throw dbError })

              mockData.quoteRequest.geoCode = {
                latitude: '42.69751',
                longitude: '23.32415'
              }

              await expect(quotesModel.handleQuoteRequest(mockData.headers, mockData.quoteRequest, mockSpan))
                .rejects
                .toEqual(fspiopError)
            })
          })
          it('throws an exception if `db.commit` of the returned DB transaction fails', async () => {
            expect.assertions(2)

            const dbError = new Error('foo')
            const fspiopError = ErrorHandler.ReformatFSPIOPError(dbError)
            mockTransaction.commit = jest.fn(() => { throw dbError })

            await expect(quotesModel.handleQuoteRequest(mockData.headers, mockData.quoteRequest, mockSpan))
              .rejects
              .toEqual(fspiopError)
            expect(mockTransaction.commit.mock.calls.length).toBe(1)
          })
        })
        it('throws an exception if `span.getChild` fails', async () => {
          expect.assertions(2)

          const spanError = new Error('foo')
          const fspiopError = ErrorHandler.ReformatFSPIOPError(spanError)
          mockSpan.getChild = jest.fn(() => { throw spanError })

          await expect(quotesModel.handleQuoteRequest(mockData.headers, mockData.quoteRequest, mockSpan))
            .rejects
            .toEqual(fspiopError)
          expect(mockSpan.getChild.mock.calls.length).toBe(1)
        })
      })
      describe('While forwarding the request:', () => {
        describe('In case environment is configured for simple routing mode', () => {
          beforeEach(() => {
            envConfig.SIMPLE_ROUTING_MODE = true
          })

          it('calls `handleException` with the proper arguments if `span.audit` fails', async () => {
            expect.assertions(4)

            const spanError = new Error('foo')
            const fspiopError = ErrorHandler.ReformatFSPIOPError(spanError)
            mockChildSpan.audit = jest.fn(() => { throw spanError })

            const expectedHandleExceptionArgs = [mockData.headers['fspiop-source'], mockData.quoteId, fspiopError, mockData.headers,
              mockChildSpan]

            const result = await quotesModel.handleQuoteRequest(mockData.headers, mockData.quoteRequest, mockSpan)

            expect(mockChildSpan.audit.mock.calls.length).toBe(1)
            expect(quotesModel.handleException).toBeCalledWith(...expectedHandleExceptionArgs)
            expect(quotesModel.handleException.mock.calls.length).toBe(1)
            expect(result).toEqual({})
          })

          it('calls `handleException` with the proper arguments if `forwardQuoteRequest` fails', async () => {
            expect.assertions(6)

            const fspiopError = ErrorHandler.CreateFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.INTERNAL_SERVER_ERROR)

            quotesModel.forwardQuoteRequest = jest.fn(() => { throw fspiopError })

            const expectedHandleExceptionArgs = [mockData.headers['fspiop-source'], mockData.quoteId, fspiopError, mockData.headers,
              mockChildSpan]
            const expectedForwardQuoteRequestArgs = [mockData.headers, mockData.quoteRequest.quoteId, mockData.quoteRequest, mockChildSpan]

            const result = await quotesModel.handleQuoteRequest(mockData.headers, mockData.quoteRequest, mockSpan)

            expect(mockChildSpan.audit.mock.calls.length).toBe(1)
            expect(quotesModel.forwardQuoteRequest.mock.calls.length).toBe(1)
            expect(quotesModel.forwardQuoteRequest).toBeCalledWith(...expectedForwardQuoteRequestArgs)
            expect(quotesModel.handleException).toBeCalledWith(...expectedHandleExceptionArgs)
            expect(quotesModel.handleException.mock.calls.length).toBe(1)
            expect(result).toEqual({})
          })
        })
        describe('In case environment is not configured for simple routing mode', () => {
          let expectedResult

          beforeEach(() => {
            envConfig.SIMPLE_ROUTING_MODE = false

            expectedResult = {
              amountTypeId: mockData.amountTypeId,
              quoteId: mockData.quoteRequest.quoteId,
              payerId: mockData.quoteRequest.payer.partyIdInfo.fspId,
              payeeId: mockData.quoteRequest.payee.partyIdInfo.fspId,
              transactionInitiatorTypeId: mockData.initiatorType,
              transactionInitiatorId: mockData.initiator,
              transactionReferenceId: mockData.transactionReference,
              transactionScenarioId: mockData.scenario,
              transactionSubScenarioId: mockData.quoteRequest.transactionType.subScenario
            }
          })

          it('calls `handleException` with the proper arguments if `span.audit` fails', async () => {
            expect.assertions(4)

            const spanError = new Error('foo')
            const fspiopError = ErrorHandler.ReformatFSPIOPError(spanError)
            mockChildSpan.audit = jest.fn(() => { throw spanError })

            const result = await quotesModel.handleQuoteRequest(mockData.headers, mockData.quoteRequest, mockSpan)

            const expectedHandleExceptionArgs = [mockData.headers['fspiop-source'], result.quoteId, fspiopError,
              mockData.headers, mockChildSpan]

            expect(quotesModel.handleException).toBeCalledWith(...expectedHandleExceptionArgs)
            expect(quotesModel.handleException.mock.calls.length).toBe(1)
            expect(mockChildSpan.audit.mock.calls.length).toBe(1)
            expect(result).toEqual(expectedResult)
          })

          it('calls `handleException` with the proper arguments if `forwardQuoteRequest` fails', async () => {
            expect.assertions(6)

            const fspiopError = ErrorHandler.CreateFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.INTERNAL_SERVER_ERROR)

            quotesModel.forwardQuoteRequest = jest.fn(() => { throw fspiopError })

            const result = await quotesModel.handleQuoteRequest(mockData.headers, mockData.quoteRequest, mockSpan)

            const expectedHandleExceptionArgs = [mockData.headers['fspiop-source'], mockData.quoteId, fspiopError, mockData.headers,
              mockChildSpan]
            const expectedForwardQuoteRequestArgs = [mockData.headers, result.quoteId, mockData.quoteRequest, mockChildSpan]

            expect(mockChildSpan.audit.mock.calls.length).toBe(1)
            expect(quotesModel.forwardQuoteRequest.mock.calls.length).toBe(1)
            expect(quotesModel.forwardQuoteRequest).toBeCalledWith(...expectedForwardQuoteRequestArgs)
            expect(quotesModel.handleException).toBeCalledWith(...expectedHandleExceptionArgs)
            expect(quotesModel.handleException.mock.calls.length).toBe(1)
            expect(result).toEqual(expectedResult)
          })
        })
      })
    })
    describe('Success:', () => {
      describe('Before forwarding the request:', () => {
        it('stops execution if `handleRuleEvents` returns a truthy value for `terminate`', async () => {
          expect.assertions(2)

          jest.spyOn(quotesModel, 'handleRuleEvents').mockImplementation(jest.fn(() => {
            return {
              terminate: true
            }
          }))

          const result = await quotesModel.handleQuoteRequest(mockData.headers, mockData.quoteRequest, mockSpan)

          expect(quotesModel.validateQuoteRequest.mock.calls.length).toBe(0)
          expect(result).toBe(undefined)
        })
      })
      describe('While forwarding the request:', () => {
        describe('In case environment is configured for simple routing mode', () => {
          beforeEach(() => {
            envConfig.SIMPLE_ROUTING_MODE = true
          })

          it('forwards the quote request properly', async () => {
            expect.assertions(5)

            mockChildSpan.isFinished = false

            const result = await quotesModel.handleQuoteRequest(mockData.headers, mockData.quoteRequest, mockSpan)

            const expectedValidateQuoteRequestArgs = [mockData.headers['fspiop-source'], mockData.headers['fspiop-destination'], mockData.quoteRequest]
            expect(quotesModel.validateQuoteRequest).toBeCalledWith(...expectedValidateQuoteRequestArgs)
            expect(mockSpan.getChild.mock.calls.length).toBe(1)

            const expectedAuditArgs = [{ headers: mockData.headers, payload: mockData.quoteRequest }, EventSdk.AuditEventAction.start]
            expect(mockChildSpan.audit).toBeCalledWith(...expectedAuditArgs)

            const expectedForwardRequestArgs = [mockData.headers, mockData.quoteRequest.quoteId, mockData.quoteRequest, mockChildSpan]
            expect(quotesModel.forwardQuoteRequest).toBeCalledWith(...expectedForwardRequestArgs)
            expect(result).toEqual({})
          })
        })
        describe('In case environment is not configured for simple routing mode', () => {
          let expectedResult

          beforeEach(() => {
            envConfig.SIMPLE_ROUTING_MODE = false

            expectedResult = {
              amountTypeId: mockData.amountTypeId,
              quoteId: mockData.quoteRequest.quoteId,
              payerId: mockData.quoteRequest.payer.partyIdInfo.fspId,
              payeeId: mockData.quoteRequest.payee.partyIdInfo.fspId,
              transactionInitiatorTypeId: mockData.initiatorType,
              transactionInitiatorId: mockData.initiator,
              transactionReferenceId: mockData.transactionReference,
              transactionScenarioId: mockData.scenario,
              transactionSubScenarioId: mockData.quoteRequest.transactionType.subScenario
            }
          })

          it('forwards the quote request properly', async () => {
            expect.assertions(5)

            mockChildSpan.isFinished = false

            const result = await quotesModel.handleQuoteRequest(mockData.headers, mockData.quoteRequest, mockSpan)

            const expectedValidateQuoteRequestArgs = [mockData.headers['fspiop-source'], mockData.headers['fspiop-destination'], mockData.quoteRequest]
            expect(quotesModel.validateQuoteRequest).toBeCalledWith(...expectedValidateQuoteRequestArgs)
            expect(mockSpan.getChild.mock.calls.length).toBe(1)

            const expectedAuditArgs = [{ headers: mockData.headers, payload: expectedResult }, EventSdk.AuditEventAction.start]
            expect(mockChildSpan.audit).toBeCalledWith(...expectedAuditArgs)

            const expectedForwardRequestArgs = [mockData.headers, mockData.quoteRequest.quoteId, mockData.quoteRequest, mockChildSpan]
            expect(quotesModel.forwardQuoteRequest).toBeCalledWith(...expectedForwardRequestArgs)
            expect(result).toEqual(expectedResult)
          })
        })
      })
    })
  })
  describe('forwardQuoteRequest', () => {
    beforeEach(() => {
      // restore the current method in test to its original implementation
      quotesModel.forwardQuoteRequest.mockRestore()
    })

    it('should get http status code 202 Accepted in simple routing mode', async () => {
      expect.assertions(2)
      envConfig.SIMPLE_ROUTING_MODE = true
      quotesModel.db.getParticipantEndpoint.mockReturnValueOnce(mockData.endpoints.payeefsp)

      await quotesModel.forwardQuoteRequest(mockData.headers, mockData.quoteRequest.quoteId, mockData.quoteRequest, mockChildSpan)

      expect(quotesModel.db.getParticipantEndpoint).toBeCalled()
      expect(quotesModel.db.getQuotePartyEndpoint).not.toBeCalled()
    })
    it('should get http status code 202 Accepted in switch mode', async () => {
      expect.assertions(2)

      envConfig.SIMPLE_ROUTING_MODE = false
      quotesModel.db.getQuotePartyEndpoint.mockReturnValueOnce(mockData.endpoints.payeefsp)

      await quotesModel.forwardQuoteRequest(mockData.headers, mockData.quoteRequest.quoteId, mockData.quoteRequest, mockChildSpan)

      expect(quotesModel.db.getParticipantEndpoint).not.toBeCalled()
      expect(quotesModel.db.getQuotePartyEndpoint).toBeCalled()
    })
    it('should throw when quoteRequest is undefined', async () => {
      expect.assertions(1)

      await expect(quotesModel.forwardQuoteRequest(mockData.headers, mockData.quoteRequest.quoteId, undefined, mockChildSpan))
        .rejects
        .toHaveProperty('apiErrorCode.code', ErrorHandler.Enums.FSPIOPErrorCodes.INTERNAL_SERVER_ERROR.code)
    })
    it('should throw when participant endpoint is not found', async () => {
      expect.assertions(1)

      envConfig.SIMPLE_ROUTING_MODE = false

      quotesModel.db.getQuotePartyEndpoint.mockReturnValueOnce(undefined)

      await expect(quotesModel.forwardQuoteRequest(mockData.headers, mockData.quoteRequest.quoteId, mockData.quoteRequest))
        .rejects
        .toHaveProperty('apiErrorCode.code', ErrorHandler.Enums.FSPIOPErrorCodes.DESTINATION_FSP_ERROR.code)
    })
    it('should not use spans when undefined and should throw when participant endpoint is invalid', async () => {
      expect.assertions(3)
      envConfig.SIMPLE_ROUTING_MODE = false
      quotesModel.db.getQuotePartyEndpoint.mockReturnValueOnce(mockData.endpoints.invalid)

      await expect(quotesModel.forwardQuoteRequest(mockData.headers, mockData.quoteRequest.quoteId, mockData.quoteRequest))
        .rejects
        .toHaveProperty('apiErrorCode.code', ErrorHandler.Enums.FSPIOPErrorCodes.DESTINATION_COMMUNICATION_ERROR.code)

      expect(mockChildSpan.injectContextToHttpRequest).not.toHaveBeenCalled()
      expect(mockChildSpan.audit).not.toHaveBeenCalled()
    })
    it('should throw when participant endpoint returns invalid response', async () => {
      expect.assertions(3)
      envConfig.SIMPLE_ROUTING_MODE = false
      quotesModel.db.getQuotePartyEndpoint.mockReturnValueOnce(mockData.endpoints.invalidResponse)

      await expect(quotesModel.forwardQuoteRequest(mockData.headers, mockData.quoteRequest.quoteId, mockData.quoteRequest))
        .rejects
        .toHaveProperty('apiErrorCode.code', ErrorHandler.Enums.FSPIOPErrorCodes.DESTINATION_COMMUNICATION_ERROR.code)

      expect(mockChildSpan.injectContextToHttpRequest).not.toHaveBeenCalled()
      expect(mockChildSpan.audit).not.toHaveBeenCalled()
    })
    it('should inspect and throw custom error as FSPIOPerror', async () => {
      expect.assertions(3)

      envConfig.SIMPLE_ROUTING_MODE = false
      const customErrorNoStack = new Error('Custom error')
      delete customErrorNoStack.stack
      quotesModel.db.getQuotePartyEndpoint.mockRejectedValueOnce(customErrorNoStack)

      await expect(quotesModel.forwardQuoteRequest(mockData.headers, mockData.quoteRequest.quoteId, mockData.quoteRequest))
        .rejects
        .toHaveProperty('apiErrorCode.code', ErrorHandler.Enums.FSPIOPErrorCodes.INTERNAL_SERVER_ERROR.code)

      expect(mockChildSpan.injectContextToHttpRequest).not.toHaveBeenCalled()
      expect(mockChildSpan.audit).not.toHaveBeenCalled()
    })
  })
  describe('handleQuoteRequestResend', () => {
    beforeEach(() => {
      // restore the current method in test to its original implementation
      quotesModel.handleQuoteRequestResend.mockRestore()
    })

    it('forward quote request', async () => {
      expect.assertions(5)
      mockChildSpan.isFinished = false

      await expect(quotesModel.handleQuoteRequestResend(mockData.headers, mockData.quoteRequest, mockSpan))
        .resolves
        .toBe(undefined)

      expect(mockSpan.getChild).toBeCalled()
      expect(mockChildSpan.audit).toBeCalled()
      const args = [mockData.headers, mockData.quoteRequest.quoteId, mockData.quoteRequest, mockChildSpan]
      expect(quotesModel.forwardQuoteRequest).toBeCalledWith(...args)
      expect(mockChildSpan.finish).toBeCalled()
    })
    it('handle fspiopError when forward quote fails', async () => {
      expect.assertions(4)
      mockChildSpan.isFinished = true
      const fspiopError = ErrorHandler.CreateFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.DESTINATION_FSP_ERROR)
      quotesModel.forwardQuoteRequest = jest.fn(() => { throw fspiopError })

      await expect(quotesModel.handleQuoteRequestResend(mockData.headers, mockData.quoteRequest, mockSpan))
        .resolves
        .toBe(undefined)

      expect(mockChildSpan.audit).toBeCalled()
      const args = [mockData.headers['fspiop-source'], mockData.quoteRequest.quoteId, fspiopError, mockData.headers, mockChildSpan]
      expect(quotesModel.handleException).toBeCalledWith(...args)
      expect(mockChildSpan.finish).not.toBeCalled()
    })
    it('handle custom error without stack when forward quote fails', async () => {
      expect.assertions(4)

      mockChildSpan.isFinished = true
      const customErrorNoStack = new Error('Custom error')
      delete customErrorNoStack.stack
      quotesModel.forwardQuoteRequest = jest.fn(() => { throw customErrorNoStack })

      await expect(quotesModel.handleQuoteRequestResend(mockData.headers, mockData.quoteRequest, mockSpan))
        .resolves
        .toBe(undefined)

      expect(mockChildSpan.audit).toBeCalled()
      const args = [mockData.headers['fspiop-source'], mockData.quoteRequest.quoteId, customErrorNoStack, mockData.headers, mockChildSpan]
      expect(quotesModel.handleException).toBeCalledWith(...args)
      expect(mockChildSpan.finish).not.toBeCalled()
    })
    it('handle custom error without stack when writeLog fails', async () => {
      expect.assertions(1)

      const errorMessage = 'Custom error'
      const customErrorNoStack = new Error(errorMessage)
      delete customErrorNoStack.stack
      quotesModel.writeLog = jest.fn(() => { throw customErrorNoStack })

      await expect(quotesModel.handleQuoteRequestResend(mockData.headers, mockData.quoteRequest, mockSpan))
        .rejects
        .toHaveProperty('message', errorMessage)
    })
    it('handle custom error without stack when writeLog fails', async () => {
      expect.assertions(1)

      const fspiopError = ErrorHandler.CreateFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.INTERNAL_SERVER_ERROR)
      quotesModel.writeLog = jest.fn().mockImplementationOnce(cb => cb(fspiopError))

      await expect(quotesModel.handleQuoteRequestResend(mockData.headers, mockData.quoteRequest, mockSpan))
        .rejects
        .toHaveProperty('apiErrorCode.code', ErrorHandler.Enums.FSPIOPErrorCodes.INTERNAL_SERVER_ERROR.code)
    })
  })
  describe('handleQuoteUpdate', () => {
    beforeEach(() => {
      // restore the current method in test to its original implementation
      quotesModel.handleQuoteUpdate.mockRestore()
    })

    it('should forward quote update in simple routing mode', async () => {
      expect.assertions(4)

      envConfig.SIMPLE_ROUTING_MODE = true
      mockChildSpan.isFinished = false

      const refs = await quotesModel.handleQuoteUpdate(mockData.headers, mockData.quoteId, mockData.quoteUpdate, mockSpan)

      expect(mockSpan.getChild.mock.calls.length).toBe(1)
      let args = [{ headers: mockData.headers, params: { quoteId: mockData.quoteRequest.quoteId }, payload: mockData.quoteUpdate }, EventSdk.AuditEventAction.start]
      expect(mockChildSpan.audit).toBeCalledWith(...args)
      args = [mockData.headers, mockData.quoteId, mockData.quoteUpdate, mockChildSpan]
      expect(quotesModel.forwardQuoteUpdate).toBeCalledWith(...args)
      expect(refs).toEqual({})
    })
    it('should handle exception in simple routing mode', async () => {
      expect.assertions(6)

      envConfig.SIMPLE_ROUTING_MODE = true
      const fspiopError = ErrorHandler.CreateFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.DESTINATION_FSP_ERROR)
      quotesModel.forwardQuoteUpdate = jest.fn(() => { throw fspiopError })
      mockChildSpan.isFinished = false

      const refs = await quotesModel.handleQuoteUpdate(mockData.headers, mockData.quoteId, mockData.quoteUpdate, mockSpan)

      expect(mockSpan.getChild.mock.calls.length).toBe(1)
      let args = [{ headers: mockData.headers, params: { quoteId: mockData.quoteRequest.quoteId }, payload: mockData.quoteUpdate }, EventSdk.AuditEventAction.start]
      expect(mockChildSpan.audit).toBeCalledWith(...args)
      args = [mockData.headers, mockData.quoteId, mockData.quoteUpdate, mockChildSpan]
      expect(quotesModel.forwardQuoteUpdate).toBeCalledWith(...args)
      args = [mockData.headers['fspiop-source'], mockData.quoteId, fspiopError, mockData.headers, mockChildSpan]
      expect(quotesModel.handleException).toBeCalledWith(...args)
      expect(quotesModel.handleException.mock.calls.length).toBe(1)

      expect(refs).toEqual({})
    })
    it('should throw modified update error when duplicate update is not a resend', async () => {
      expect.assertions(7)

      envConfig.SIMPLE_ROUTING_MODE = false
      quotesModel.checkDuplicateQuoteResponse = jest.fn(() => { return { isDuplicateId: true, isResend: false } })

      try {
        await quotesModel.handleQuoteUpdate(mockData.headers, mockData.quoteId, mockData.quoteUpdate, mockSpan)
      } catch (err) {
        expect(quotesModel.db.newTransaction.mock.calls.length).toBe(1)
        expect(quotesModel.checkDuplicateQuoteResponse).toBeCalledWith(mockData.quoteId, mockData.quoteUpdate)
        expect(mockTransaction.rollback.mock.calls.length).toBe(1)
        expect(mockSpan.error.mock.calls[0][0]).toEqual(err)
        expect(mockSpan.finish.mock.calls[0][0]).toEqual(err.message)
        expect(err instanceof ErrorHandler.Factory.FSPIOPError).toBeTruthy()
        expect(err.apiErrorCode.code).toBe(ErrorHandler.Enums.FSPIOPErrorCodes.MODIFIED_REQUEST.code)
      }
    })
    it('should handle quote update resend when duplicate update matches original', async () => {
      expect.assertions(4)

      envConfig.SIMPLE_ROUTING_MODE = false
      quotesModel.checkDuplicateQuoteResponse = jest.fn(() => { return { isDuplicateId: true, isResend: true } })
      quotesModel.handleQuoteUpdateResend = jest.fn(() => 'handleQuoteUpdateResendResult')

      const refs = await quotesModel.handleQuoteUpdate(mockData.headers, mockData.quoteId, mockData.quoteUpdate, mockSpan)

      expect(quotesModel.db.newTransaction.mock.calls.length).toBe(1)
      expect(quotesModel.checkDuplicateQuoteResponse).toBeCalledWith(mockData.quoteId, mockData.quoteUpdate)
      const args = [mockData.headers, mockData.quoteId, mockData.quoteUpdate, mockSpan]
      expect(quotesModel.handleQuoteUpdateResend).toBeCalledWith(...args)
      expect(refs).toBe('handleQuoteUpdateResendResult')
    })
    it('should store to db and forward quote update when switch mode', async () => {
      expect.assertions(9)

      envConfig.SIMPLE_ROUTING_MODE = false
      quotesModel.checkDuplicateQuoteResponse = jest.fn(() => { return { isDuplicateId: false, isResend: false } })
      quotesModel.calculateRequestHash = jest.fn(() => 'hash')
      const expected = {
        quoteResponseId: 'resp123'
      }
      quotesModel.db.createQuoteResponse.mockReturnValueOnce({ quoteResponseId: expected.quoteResponseId })
      mockChildSpan.isFinished = true
      const localQuoteUpdate = clone(mockData.quoteUpdate)
      delete localQuoteUpdate.geoCode

      const refs = await quotesModel.handleQuoteUpdate(mockData.headers, mockData.quoteId, localQuoteUpdate, mockSpan)

      expect(quotesModel.db.newTransaction.mock.calls.length).toBe(1)
      expect(quotesModel.checkDuplicateQuoteResponse).toBeCalledWith(mockData.quoteId, localQuoteUpdate)
      expect(mockTransaction.rollback.mock.calls.length).toBe(0)
      expect(mockTransaction.commit.mock.calls.length).toBe(1)
      expect(mockSpan.getChild.mock.calls.length).toBe(1)
      let args = [{ headers: mockData.headers, params: { quoteId: mockData.quoteRequest.quoteId }, payload: localQuoteUpdate }, EventSdk.AuditEventAction.start]
      expect(mockChildSpan.audit).toBeCalledWith(...args)
      args = [mockData.headers, mockData.quoteId, localQuoteUpdate, mockChildSpan]
      expect(quotesModel.forwardQuoteUpdate).toBeCalledWith(...args)
      expect(mockChildSpan.finish).not.toBeCalled()
      expect(refs).toMatchObject(expected)
    })
    it('should store to db and forward quote update with geoCode in switch mode', async () => {
      expect.assertions(9)

      envConfig.SIMPLE_ROUTING_MODE = false
      quotesModel.checkDuplicateQuoteResponse = jest.fn(() => { return { isDuplicateId: false, isResend: false } })
      quotesModel.calculateRequestHash = jest.fn(() => 'hash')
      const expected = {
        quoteResponseId: 'resp123',
        geoCodeId: 'geoCodeId'
      }
      quotesModel.db.createQuoteResponse.mockReturnValueOnce({ quoteResponseId: expected.quoteResponseId })
      quotesModel.db.createGeoCode.mockReturnValueOnce(expected.geoCodeId)
      quotesModel.db.getQuoteParty.mockReturnValueOnce('quotePartyRecord')
      mockChildSpan.isFinished = true

      const refs = await quotesModel.handleQuoteUpdate(mockData.headers, mockData.quoteId, mockData.quoteUpdate, mockSpan)

      expect(quotesModel.db.newTransaction.mock.calls.length).toBe(1)
      expect(quotesModel.checkDuplicateQuoteResponse).toBeCalledWith(mockData.quoteId, mockData.quoteUpdate)
      expect(mockTransaction.rollback.mock.calls.length).toBe(0)
      expect(mockTransaction.commit.mock.calls.length).toBe(1)
      expect(mockSpan.getChild.mock.calls.length).toBe(1)
      let args = [{ headers: mockData.headers, params: { quoteId: mockData.quoteRequest.quoteId }, payload: mockData.quoteUpdate }, EventSdk.AuditEventAction.start]
      expect(mockChildSpan.audit).toBeCalledWith(...args)
      args = [mockData.headers, mockData.quoteId, mockData.quoteUpdate, mockChildSpan]
      expect(quotesModel.forwardQuoteUpdate).toBeCalledWith(...args)
      expect(mockChildSpan.finish).not.toBeCalled()
      expect(refs).toEqual(expected)
    })
    it('should store to db and handle exception when forward quote update fails in switch mode', async () => {
      expect.assertions(4)

      envConfig.SIMPLE_ROUTING_MODE = false
      quotesModel.checkDuplicateQuoteResponse = jest.fn(() => { return { isDuplicateId: false, isResend: false } })
      quotesModel.calculateRequestHash = jest.fn(() => 'hash')
      const expected = {
        quoteResponseId: 'resp123',
        geoCodeId: 'geoCodeId'
      }
      quotesModel.db.createQuoteResponse.mockReturnValueOnce({ quoteResponseId: expected.quoteResponseId })
      quotesModel.db.createGeoCode.mockReturnValueOnce(expected.geoCodeId)
      quotesModel.db.getQuoteParty.mockReturnValueOnce('quotePartyRecord')

      const customError = new Error('Custom error')
      delete customError.stack
      quotesModel.forwardQuoteUpdate = jest.fn(() => { throw customError })
      mockChildSpan.isFinished = true
      const localQuoteUpdate = clone(mockData.quoteUpdate)
      delete localQuoteUpdate.expiration

      const refs = await quotesModel.handleQuoteUpdate(mockData.headers, mockData.quoteId, localQuoteUpdate, mockSpan)

      let args = [mockData.headers, mockData.quoteId, localQuoteUpdate, mockChildSpan]
      expect(quotesModel.forwardQuoteUpdate).toBeCalledWith(...args)
      args = [mockData.headers['fspiop-source'], mockData.quoteId, customError, mockData.headers, mockChildSpan]
      expect(quotesModel.handleException).toBeCalledWith(...args)
      expect(mockChildSpan.finish).not.toBeCalled()
      expect(refs).toEqual(expected)
    })
    it('should throw partyNotFound error when getQuoteParty coldn\'t find a record in switch mode', async () => {
      expect.assertions(6)

      envConfig.SIMPLE_ROUTING_MODE = false
      quotesModel.checkDuplicateQuoteResponse = jest.fn(() => { return { isDuplicateId: false, isResend: false } })
      quotesModel.calculateRequestHash = jest.fn(() => 'hash')
      const expected = {
        quoteResponseId: 'resp123',
        geoCodeId: 'geoCodeId'
      }
      quotesModel.db.createQuoteResponse.mockReturnValueOnce({ quoteResponseId: expected.quoteResponseId })
      quotesModel.db.createGeoCode.mockReturnValueOnce(expected.geoCodeId)

      try {
        await quotesModel.handleQuoteUpdate(mockData.headers, mockData.quoteId, mockData.quoteUpdate, mockSpan)
      } catch (err) {
        expect(quotesModel.db.newTransaction.mock.calls.length).toBe(1)
        expect(mockTransaction.rollback.mock.calls.length).toBe(1)
        expect(mockSpan.error.mock.calls[0][0]).toEqual(err)
        expect(mockSpan.finish.mock.calls[0][0]).toEqual(err.message)
        expect(err instanceof ErrorHandler.Factory.FSPIOPError).toBeTruthy()
        expect(err.apiErrorCode.code).toBe(ErrorHandler.Enums.FSPIOPErrorCodes.PARTY_NOT_FOUND.code)
      }
    })
    it('should throw validationError when headers contains accept', async () => {
      expect.assertions(3)

      const localHeaders = clone(mockData.headers)
      localHeaders.accept = 'application/vnd.interoperability.quotes+json;version=1.0'

      await expect(quotesModel.handleQuoteUpdate(localHeaders, mockData.quoteId, mockData.quoteUpdate))
        .rejects
        .toHaveProperty('apiErrorCode.code', ErrorHandler.Enums.FSPIOPErrorCodes.VALIDATION_ERROR.code)

      expect(quotesModel.db.newTransaction.mock.calls.length).toBe(0)
      expect(mockTransaction.rollback.mock.calls.length).toBe(0)
    })
    it('should store to db and throw custom error without error stack in switch mode', async () => {
      expect.assertions(3)

      envConfig.SIMPLE_ROUTING_MODE = false
      const customErrorNoStack = new Error('Custom error')
      delete customErrorNoStack.stack
      quotesModel.checkDuplicateQuoteResponse = jest.fn(() => { throw customErrorNoStack })

      await expect(quotesModel.handleQuoteUpdate(mockData.headers, mockData.quoteId, mockData.quoteUpdate, mockSpan))
        .rejects
        .toHaveProperty('apiErrorCode.code', ErrorHandler.Enums.FSPIOPErrorCodes.INTERNAL_SERVER_ERROR.code)

      expect(quotesModel.db.newTransaction.mock.calls.length).toBe(1)
      expect(mockTransaction.rollback.mock.calls.length).toBe(1)
    })
  })
  describe('forwardQuoteUpdate', () => {
    beforeEach(() => {
      // restore the current method in test to its original implementation
      quotesModel.forwardQuoteUpdate.mockRestore()
    })

    it('should get http status code 200 OK in simple routing mode', async () => {
      expect.assertions(3)
      envConfig.SIMPLE_ROUTING_MODE = true
      quotesModel.db.getParticipantEndpoint.mockReturnValueOnce(mockData.endpoints.payeefsp)

      await expect(quotesModel.forwardQuoteUpdate(mockData.headers, mockData.quoteId, mockData.quoteUpdate, mockChildSpan))
        .resolves
        .toBe(undefined)

      expect(quotesModel.db.getParticipantEndpoint).toBeCalled()
      expect(quotesModel.db.getQuotePartyEndpoint).not.toBeCalled()
    })
    it('should get http status code 200 OK in switch mode', async () => {
      expect.assertions(3)

      envConfig.SIMPLE_ROUTING_MODE = false
      quotesModel.db.getQuotePartyEndpoint.mockReturnValueOnce(mockData.endpoints.payeefsp)

      await expect(quotesModel.forwardQuoteUpdate(mockData.headers, mockData.quoteId, mockData.quoteUpdate, mockChildSpan))
        .resolves
        .toBe(undefined)

      expect(quotesModel.db.getParticipantEndpoint).not.toBeCalled()
      expect(quotesModel.db.getQuotePartyEndpoint).toBeCalled()
    })
    it('should throw when quoteUpdate is undefined', async () => {
      expect.assertions(1)

      await expect(quotesModel.forwardQuoteUpdate(mockData.headers, mockData.quoteId, undefined, mockChildSpan))
        .rejects
        .toHaveProperty('apiErrorCode.code', ErrorHandler.Enums.FSPIOPErrorCodes.INTERNAL_SERVER_ERROR.code)
    })
    it('should throw when participant endpoint is not found', async () => {
      expect.assertions(1)

      envConfig.SIMPLE_ROUTING_MODE = false
      const endpoint = undefined
      quotesModel.db.getQuotePartyEndpoint.mockReturnValueOnce(endpoint)
      quotesModel.sendErrorCallback = jest.fn((_, fspiopError) => { throw fspiopError })

      await expect(quotesModel.forwardQuoteUpdate(mockData.headers, mockData.quoteId, mockData.quoteUpdate, mockChildSpan))
        .rejects
        .toHaveProperty('apiErrorCode.code', ErrorHandler.Enums.FSPIOPErrorCodes.DESTINATION_FSP_ERROR.code)
    })
    it('should not use spans when undefined and should throw when participant endpoint is invalid', async () => {
      expect.assertions(3)

      envConfig.SIMPLE_ROUTING_MODE = false
      quotesModel.db.getQuotePartyEndpoint.mockReturnValueOnce(mockData.endpoints.invalid)

      await expect(quotesModel.forwardQuoteUpdate(mockData.headers, mockData.quoteId, mockData.quoteUpdate))
        .rejects
        .toHaveProperty('apiErrorCode.code', ErrorHandler.Enums.FSPIOPErrorCodes.DESTINATION_COMMUNICATION_ERROR.code)

      expect(mockChildSpan.injectContextToHttpRequest).not.toHaveBeenCalled()
      expect(mockChildSpan.audit).not.toHaveBeenCalled()
    })
    it('should throw when participant endpoint returns invalid response', async () => {
      expect.assertions(3)

      envConfig.SIMPLE_ROUTING_MODE = false
      quotesModel.db.getQuotePartyEndpoint.mockReturnValueOnce(mockData.endpoints.invalidResponse)

      await expect(quotesModel.forwardQuoteUpdate(mockData.headers, mockData.quoteId, mockData.quoteUpdate))
        .rejects
        .toHaveProperty('apiErrorCode.code', ErrorHandler.Enums.FSPIOPErrorCodes.DESTINATION_COMMUNICATION_ERROR.code)

      expect(mockChildSpan.injectContextToHttpRequest).not.toHaveBeenCalled()
      expect(mockChildSpan.audit).not.toHaveBeenCalled()
    })
    it('should inspect and throw custom error as FSPIOPerror', async () => {
      expect.assertions(3)

      envConfig.SIMPLE_ROUTING_MODE = false
      const customErrorNoStack = new Error('Custom error')
      delete customErrorNoStack.stack
      quotesModel.db.getQuotePartyEndpoint.mockRejectedValueOnce(customErrorNoStack)

      await expect(quotesModel.forwardQuoteUpdate(mockData.headers, mockData.quoteId, mockData.quoteUpdate))
        .rejects
        .toHaveProperty('apiErrorCode.code', ErrorHandler.Enums.FSPIOPErrorCodes.INTERNAL_SERVER_ERROR.code)

      expect(mockChildSpan.injectContextToHttpRequest).not.toHaveBeenCalled()
      expect(mockChildSpan.audit).not.toHaveBeenCalled()
    })
  })
  describe('handleQuoteUpdateResend', () => {
    beforeEach(() => {
      // restore the current method in test to its original implementation
      quotesModel.handleQuoteUpdateResend.mockRestore()
    })

    it('forward quote update', async () => {
      expect.assertions(5)

      mockChildSpan.isFinished = false

      await expect(quotesModel.handleQuoteUpdateResend(mockData.headers, mockData.quoteId, mockData.quoteUpdate, mockSpan))
        .resolves
        .toBe(undefined)

      expect(mockSpan.getChild).toBeCalled()
      expect(mockChildSpan.audit).toBeCalled()
      const args = [mockData.headers, mockData.quoteId, mockData.quoteUpdate, mockChildSpan]
      expect(quotesModel.forwardQuoteUpdate).toBeCalledWith(...args)
      expect(mockChildSpan.finish).toBeCalled()
    })
    it('handle fspiopError when forward quote fails', async () => {
      expect.assertions(4)

      mockChildSpan.isFinished = true
      const fspiopError = ErrorHandler.CreateFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.DESTINATION_FSP_ERROR)
      quotesModel.forwardQuoteUpdate = jest.fn(() => { throw fspiopError })

      await expect(quotesModel.handleQuoteUpdateResend(mockData.headers, mockData.quoteId, mockData.quoteUpdate, mockSpan))
        .resolves
        .toBe(undefined)

      expect(mockChildSpan.audit).toBeCalled()
      const args = [mockData.headers['fspiop-source'], mockData.quoteId, fspiopError, mockData.headers, mockChildSpan]
      expect(quotesModel.handleException).toBeCalledWith(...args)
      expect(mockChildSpan.finish).not.toBeCalled()
    })
    it('handle custom error without stack when forward quote fails', async () => {
      expect.assertions(4)

      mockChildSpan.isFinished = true
      const customErrorNoStack = new Error('Custom error')
      delete customErrorNoStack.stack
      quotesModel.forwardQuoteUpdate = jest.fn(() => { throw customErrorNoStack })

      await expect(quotesModel.handleQuoteUpdateResend(mockData.headers, mockData.quoteId, mockData.quoteUpdate, mockSpan))
        .resolves
        .toBe(undefined)

      expect(mockChildSpan.audit).toBeCalled()
      const args = [mockData.headers['fspiop-source'], mockData.quoteId, customErrorNoStack, mockData.headers, mockChildSpan]
      expect(quotesModel.handleException).toBeCalledWith(...args)
      expect(mockChildSpan.finish).not.toBeCalled()
    })
    it('handle custom error without stack when writeLog fails', async () => {
      expect.assertions(1)

      const errorMessage = 'Custom error'
      const customErrorNoStack = new Error(errorMessage)
      delete customErrorNoStack.stack
      quotesModel.writeLog = jest.fn(() => { throw customErrorNoStack })

      await expect(quotesModel.handleQuoteUpdateResend(mockData.headers, mockData.quoteId, mockData.quoteUpdate, mockSpan))
        .rejects
        .toHaveProperty('message', errorMessage)
    })
    it('handle custom error without stack when writeLog fails', async () => {
      expect.assertions(1)

      const fspiopError = ErrorHandler.CreateFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.INTERNAL_SERVER_ERROR)
      quotesModel.writeLog = jest.fn().mockImplementationOnce(cb => cb(fspiopError))

      await expect(quotesModel.handleQuoteUpdateResend(mockData.headers, mockData.quoteId, mockData.quoteUpdate, mockSpan))
        .rejects
        .toHaveProperty('apiErrorCode.code', ErrorHandler.Enums.FSPIOPErrorCodes.INTERNAL_SERVER_ERROR.code)
    })
  })
})
