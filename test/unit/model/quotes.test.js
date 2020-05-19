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
 - James Bush <james.bush@modusbox.com>
 --------------
 ******/
'use strict'

// jest has a buggy system for mocking dependencies that can be overcome by mocking
// the target module before requiring it.
// more info on https://github.com/facebook/jest/issues/2582#issuecomment-321607875
const mockRules = [{}]
let mockConfig

jest.mock('../../../config/rules.json', () => mockRules)
jest.mock('axios')
jest.mock('@mojaloop/central-services-logger')
jest.mock('../../../src/data/database')
jest.mock('../../../src/model/rules')
jest.mock('../../../src/lib/config', () => {
  return jest.fn().mockImplementation(() => mockConfig)
})
jest.mock('../../../src/lib/http')

const axios = require('axios')

const clone = require('@mojaloop/central-services-shared').Util.clone
const Enum = require('@mojaloop/central-services-shared').Enum
const LibUtil = require('@mojaloop/central-services-shared').Util
const ErrorHandler = require('@mojaloop/central-services-error-handling')
const EventSdk = require('@mojaloop/event-sdk')
const Logger = require('@mojaloop/central-services-logger')
const JwsSigner = require('@mojaloop/sdk-standard-components').Jws.signer

const Db = require('../../../src/data/database')
const Config = jest.requireActual('../../../src/lib/config')
const QuotesModel = require('../../../src/model/quotes')
const rules = require('../../../config/rules')
const RulesEngine = require('../../../src/model/rules')
const Http = require('../../../src/lib/http')

const jwsSigningKey = `-----BEGIN RSA PRIVATE KEY-----
MIIEowIBAAKCAQEA0eJEh3Op5p6x137lRkAsvmEBbd32dbRChrCUItZbtxjf/qfB
yD5k8Hn4n4vbqzP8XSGS0f6KmNC+iRaP74HVgzAqc4Uid4J8dtSBq3VmucYQYzLc
101QjuvD+SKmZwlw/q0PtulmqlASI2SbMfwcAraMi6ab7v5W4EGNeIPLEIo3BXsQ
DTCWqiZb7aXkHkcY7sOjAzK/2bNGYFmAthdYrHzvCkqnJ7LAHX3Oj7rJea5MqtuN
B9POZYaD10n9JuYWdwPqLrw6/hVgPSFEy+ulrVbXf54ZH0dfMThAYRvFrT81yulk
H95JhXWGdi6cTp6t8LVOKFhnNfxjWw0Jayj9xwIDAQABAoIBADB2u/Y/CgNbr5sg
DRccqHhJdAgHkep59kadrYch0knEL6zg1clERxCUSYmlxNKSjXp/zyQ4T46b3PNQ
x2m5pDDHxXWpT10jP1Q9G7gYwuCw0IXnb8EzdB+cZ0M28g+myXW1RoSo/nDjTlzn
1UJEgb9Kocd5cFZOWocr+9vRKumlZULMsA8yiNwlAfJHcMBM7acsa3myCqVhLyWt
4BQylVuLFa+A6QzpMXEwFCq8EOXf07gl1XVzC6LJ1fTa9gVM3N+YE+oEXKrsHCxG
/ACgKsjepL27QjJ7qvecWPP0F2LxEZYOm5tbXaKJTobzQUJHgUokanZMhjYprDsZ
zumLw9kCgYEA/DUWcnLeImlfq/EYdhejkl3J+WX3vhS23OqVgY1amu7CZzaai6vt
H0TRc8Zsbi4jgmFDU8PFzytP6qz6Tgom4R736z6oBi7bjnGyN17/NSbf+DaRVcM6
vnZr7jNC2FJlECmIN+dkwUA/YCr2SA7hxZXM9mIYSc+6+glDiIO5Cf0CgYEA1Qo/
uQbVHhW+Cp8H0kdMuhwUbkBquRrxRZlXS1Vrf3f9me9JLUy9UPWb3y3sKVurG5+O
SIlr4hDcZyXdE198MtDMhBIGqU9ORSjppJDNDVvtt+n2FD4XmWIU70vKBJBivX0+
Bow6yduis+p12fuvpvpnKCz8UjOgOQJhLZ4GQBMCgYBP6gpozVjxkm4ML2LO2IKt
+CXtbo/nnOysZ3BkEoQpH4pd5gFmTF3gUJAFnVPyPZBm2abZvejJ0jGKbLELVVAo
eQWZdssK2oIbSo9r2CAJmX3SSogWorvUafWdDoUZwlHfoylUfW+BhHgQYsyS3JRR
ZTwCveZwTPA0FgdeFE7niQKBgQCHaD8+ZFhbCejDqXb4MXdUJ3rY5Lqwsq491YwF
huKPn32iNNQnJcqCxclv3iln1Cr6oLx34Fig1KSyLv/IS32OcuY635Y6UPznumxe
u+aJIjADIILXNOwdAplZy6s4oWkRFaSx1rmbCa3tew2zImTv1eJxR76MpOGmupt3
uiQw3wKBgFjBT/aVKdBeHeP1rIHHldQV5QQxZNkc6D3qn/oAFcwpj9vcGfRjQWjO
ARzXM2vUWEet4OVn3DXyOdaWFR1ppehz7rAWBiPgsMg4fjAusYb9Mft1GMxMzuwT
Oyqsp6pzAWFrCD3JAoTLxClV+j5m+SXZ/ItD6ziGpl/h7DyayrFZ
-----END RSA PRIVATE KEY-----`

describe('QuotesModel', () => {
  let mockData
  let mockTransaction
  let mockChildSpan
  let mockSpan
  let quotesModel

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
        },
        geoCode: {
          latitude: '43.69751',
          longitude: '24.32415'
        },
        extensionList: {
          extension: [{
            key: 'key1',
            value: 'value1'
          }]
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
      quoteResponse: {
        quoteId: 'test123'
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
                    path: '$.payee.accounts[?(@.ledgerAccountType == "POSITION" && @.isActive == 1)].currency'
                  }
                }
              }
            ]
          },
          event: {
            type: 'INTERCEPT_QUOTE',
            params: {
              rerouteToFsp: 'DFSPEUR',
              sourceCurrency: 'EUR',
              rerouteToFspCurrency: 'XOF'
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
                    path: '$.payee.accounts[?(@.ledgerAccountType == "POSITION" && @.isActive == 1)].currency'
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
    quotesModel.db.createQuoteError.mockImplementation(() => mockData.quoteRequest.quoteId)
    quotesModel.db.createPayerQuoteParty.mockImplementation(() => mockData.quoteRequest.payer.partyIdInfo.fspId)
    quotesModel.db.createPayeeQuoteParty.mockImplementation(() => mockData.quoteRequest.payee.partyIdInfo.fspId)
    quotesModel.db.createGeoCode.mockImplementation(() => mockData.geoCode)
    quotesModel.db.createQuoteExtensions.mockImplementation(() => mockData.quoteRequest.extensionList.extension)

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

    // reset the configuration values to their initials
    mockConfig = new Config()

    // reset the rules values to their initials, but without changing the object's reference
    // as we use the same object between the current unit tests file and the code's implementation
    Object.keys(mockData.rules).forEach(key => {
      rules[key] = mockData.rules[key]
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
          axios.request
            .mockImplementationOnce(() => { return { data: { accounts: [{ accountId: 1, ledgerAccountType: 'POSITION', isActive: 1 }] } } })
            .mockImplementationOnce(() => { return { data: { accounts: [{ accountId: 2, ledgerAccountType: 'POSITION', isActive: 1 }] } } })
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
          axios.request
            .mockImplementationOnce(() => { return { data: { accounts: [{ accountId: 1, ledgerAccountType: 'POSITION', isActive: 1 }] } } })
            .mockImplementationOnce(() => { return { data: { accounts: [{ accountId: 2, ledgerAccountType: 'POSITION', isActive: 1 }] } } })
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
                  'fspiop-destination': mockEvents[0].params.rerouteToFsp,
                  'fspiop-destinationcurrency': mockEvents[0].params.rerouteToFspCurrency,
                  'fspiop-sourcecurrency': mockEvents[0].params.sourceCurrency
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
            mockConfig.simpleRoutingMode = false
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
          describe('In case a `extensionList` exists in the incoming quote request:', () => {
            it('throws an exception if `db.createQuoteExtensions` fails', async () => {
              expect.assertions(1)

              const dbError = new Error('foo')
              const fspiopError = ErrorHandler.ReformatFSPIOPError(dbError)

              quotesModel.db.createQuoteExtensions = jest.fn(() => { throw dbError })

              mockData.quoteRequest.extensionList = {
                extension: [{
                  key: 'someKey',
                  value: 'someValue'
                }]
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
            mockConfig.simpleRoutingMode = true
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
            mockConfig.simpleRoutingMode = false

            expectedResult = {
              amountTypeId: mockData.amountTypeId,
              quoteId: mockData.quoteRequest.quoteId,
              payerId: mockData.quoteRequest.payer.partyIdInfo.fspId,
              payeeId: mockData.quoteRequest.payee.partyIdInfo.fspId,
              transactionInitiatorTypeId: mockData.initiatorType,
              transactionInitiatorId: mockData.initiator,
              transactionReferenceId: mockData.transactionReference,
              transactionScenarioId: mockData.scenario,
              transactionSubScenarioId: mockData.quoteRequest.transactionType.subScenario,
              geoCodeId: mockData.geoCode,
              extensions: mockData.quoteRequest.extensionList.extension
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
            mockConfig.simpleRoutingMode = true
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
            mockConfig.simpleRoutingMode = false

            expectedResult = {
              amountTypeId: mockData.amountTypeId,
              quoteId: mockData.quoteRequest.quoteId,
              payerId: mockData.quoteRequest.payer.partyIdInfo.fspId,
              payeeId: mockData.quoteRequest.payee.partyIdInfo.fspId,
              transactionInitiatorTypeId: mockData.initiatorType,
              transactionInitiatorId: mockData.initiator,
              transactionReferenceId: mockData.transactionReference,
              transactionScenarioId: mockData.scenario,
              transactionSubScenarioId: mockData.quoteRequest.transactionType.subScenario,
              geoCodeId: mockData.geoCode,
              extensions: mockData.quoteRequest.extensionList.extension
            }
          })

          it('calls all database create entity methods with correct arguments', async () => {
            expect.assertions(8)

            const expectedHash = quotesModel.calculateRequestHash(mockData.quoteRequest)
            const mockCreateQuoteDuplicateCheckArgs = [mockTransaction, mockData.quoteRequest.quoteId,
              expectedHash]
            const mockCreateTransactionReferenceArgs = [mockTransaction, mockData.quoteRequest.quoteId,
              mockData.quoteRequest.transactionId]
            const mockCreateQuoteArgs = [mockTransaction, {
              amount: '100.0000',
              amountTypeId: 'fakeAmountTypeId',
              balanceOfPaymentsId: null,
              currencyId: 'USD',
              expirationDate: null,
              note: undefined,
              quoteId: 'test123',
              transactionInitiatorId: 'fakeInitiator',
              transactionInitiatorTypeId: 'fakeInitiatorType',
              transactionReferenceId: 'fakeTxRef',
              transactionRequestId: null,
              transactionScenarioId: 'fakeScenario',
              transactionSubScenarioId: undefined
            }]
            const mockCreatePayerQuotePartyArgs = [mockTransaction, mockData.quoteRequest.quoteId,
              mockData.quoteRequest.payer, mockData.quoteRequest.amount.amount,
              mockData.quoteRequest.amount.currency]
            const mockCreatePayeeQuotePartyArgs = [mockTransaction, mockData.quoteRequest.quoteId,
              mockData.quoteRequest.payee, mockData.quoteRequest.amount.amount,
              mockData.quoteRequest.amount.currency]
            const mockCreateQuoteExtensionsArgs = [mockTransaction,
              mockData.quoteRequest.extensionList.extension,
              mockData.quoteRequest.quoteId
            ]
            const mockCreateGeoCodeArgs = [mockTransaction, {
              quotePartyId: mockData.quoteRequest.payer.partyIdInfo.fspId,
              latitude: mockData.quoteRequest.geoCode.latitude,
              longitude: mockData.quoteRequest.geoCode.longitude
            }]

            const result = await quotesModel.handleQuoteRequest(mockData.headers, mockData.quoteRequest, mockSpan)

            expect(quotesModel.db.createQuoteDuplicateCheck).toBeCalledWith(...mockCreateQuoteDuplicateCheckArgs)
            expect(quotesModel.db.createTransactionReference).toBeCalledWith(...mockCreateTransactionReferenceArgs)
            expect(quotesModel.db.createQuote).toBeCalledWith(...mockCreateQuoteArgs)
            expect(quotesModel.db.createPayerQuoteParty).toBeCalledWith(...mockCreatePayerQuotePartyArgs)
            expect(quotesModel.db.createPayeeQuoteParty).toBeCalledWith(...mockCreatePayeeQuotePartyArgs)
            expect(quotesModel.db.createQuoteExtensions).toBeCalledWith(...mockCreateQuoteExtensionsArgs)
            expect(quotesModel.db.createGeoCode).toBeCalledWith(...mockCreateGeoCodeArgs)

            expect(result).toEqual(expectedResult)
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
      expect.assertions(1)
      mockConfig.simpleRoutingMode = true
      quotesModel.db.getParticipantEndpoint.mockReturnValueOnce(mockData.endpoints.payeefsp)

      await quotesModel.forwardQuoteRequest(mockData.headers, mockData.quoteRequest.quoteId, mockData.quoteRequest, mockChildSpan)

      expect(quotesModel.db.getParticipantEndpoint).toBeCalled()
      // expect(quotesModel.db.getQuotePartyEndpoint).not.toBeCalled()
    })
    it('should get http status code 202 Accepted in switch mode', async () => {
      expect.assertions(1)

      mockConfig.simpleRoutingMode = false
      quotesModel.db.getParticipantEndpoint.mockReturnValueOnce(mockData.endpoints.payeefsp)

      await quotesModel.forwardQuoteRequest(mockData.headers, mockData.quoteRequest.quoteId, mockData.quoteRequest, mockChildSpan)

      expect(quotesModel.db.getParticipantEndpoint).toBeCalled()
      // expect(quotesModel.db.getQuotePartyEndpoint).toBeCalled()
    })
    it('should throw when quoteRequest is undefined', async () => {
      expect.assertions(1)

      await expect(quotesModel.forwardQuoteRequest(mockData.headers, mockData.quoteRequest.quoteId, undefined, mockChildSpan))
        .rejects
        .toHaveProperty('apiErrorCode.code', ErrorHandler.Enums.FSPIOPErrorCodes.INTERNAL_SERVER_ERROR.code)
    })
    it('should throw when participant endpoint is not found', async () => {
      expect.assertions(1)

      mockConfig.simpleRoutingMode = false

      quotesModel.db.getQuotePartyEndpoint.mockReturnValueOnce(undefined)

      await expect(quotesModel.forwardQuoteRequest(mockData.headers, mockData.quoteRequest.quoteId, mockData.quoteRequest))
        .rejects
        .toHaveProperty('apiErrorCode.code', ErrorHandler.Enums.FSPIOPErrorCodes.DESTINATION_FSP_ERROR.code)
    })
    it('should not use spans when undefined and should throw when participant endpoint is invalid', async () => {
      expect.assertions(3)
      mockConfig.simpleRoutingMode = false
      quotesModel.db.getParticipantEndpoint.mockReturnValueOnce(mockData.endpoints.invalid)
      Http.httpRequest.mockImplementationOnce(() => { throw ErrorHandler.CreateFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.DESTINATION_COMMUNICATION_ERROR) })

      await expect(quotesModel.forwardQuoteRequest(mockData.headers, mockData.quoteRequest.quoteId, mockData.quoteRequest))
        .rejects
        .toHaveProperty('apiErrorCode.code', ErrorHandler.Enums.FSPIOPErrorCodes.DESTINATION_COMMUNICATION_ERROR.code)

      expect(mockChildSpan.injectContextToHttpRequest).not.toHaveBeenCalled()
      expect(mockChildSpan.audit).not.toHaveBeenCalled()
    })
    it('should throw when participant endpoint returns invalid response', async () => {
      expect.assertions(3)
      mockConfig.simpleRoutingMode = false
      quotesModel.db.getParticipantEndpoint.mockReturnValueOnce(mockData.endpoints.invalidResponse)
      Http.httpRequest.mockImplementationOnce(() => { throw ErrorHandler.CreateFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.DESTINATION_COMMUNICATION_ERROR) })

      await expect(quotesModel.forwardQuoteRequest(mockData.headers, mockData.quoteRequest.quoteId, mockData.quoteRequest))
        .rejects
        .toHaveProperty('apiErrorCode.code', ErrorHandler.Enums.FSPIOPErrorCodes.DESTINATION_COMMUNICATION_ERROR.code)

      expect(mockChildSpan.injectContextToHttpRequest).not.toHaveBeenCalled()
      expect(mockChildSpan.audit).not.toHaveBeenCalled()
    })
    it('should inspect and throw custom error as FSPIOPerror', async () => {
      expect.assertions(3)

      mockConfig.simpleRoutingMode = false
      const customErrorNoStack = new Error('Custom error')
      delete customErrorNoStack.stack
      quotesModel.db.getParticipantEndpoint.mockRejectedValueOnce(customErrorNoStack)

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

      mockConfig.simpleRoutingMode = true
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

      mockConfig.simpleRoutingMode = true
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

      mockConfig.simpleRoutingMode = false
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

      mockConfig.simpleRoutingMode = false
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
      expect.assertions(10)

      mockConfig.simpleRoutingMode = false
      quotesModel.checkDuplicateQuoteResponse = jest.fn(() => { return { isDuplicateId: false, isResend: false } })
      quotesModel.calculateRequestHash = jest.fn(() => 'hash')

      const mockQuoteResponseId = 'resp123'

      const expected = {
        quoteResponseId: mockQuoteResponseId,
        extensions: mockData.quoteUpdate.extensionList.extension
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

      expect(quotesModel.db.createQuoteExtensions).toBeCalledWith(
        mockTransaction,
        mockData.quoteUpdate.extensionList.extension,
        mockData.quoteId,
        mockQuoteResponseId
      )

      let args = [{ headers: mockData.headers, params: { quoteId: mockData.quoteRequest.quoteId }, payload: localQuoteUpdate }, EventSdk.AuditEventAction.start]
      expect(mockChildSpan.audit).toBeCalledWith(...args)

      args = [mockData.headers, mockData.quoteId, localQuoteUpdate, mockChildSpan]
      expect(quotesModel.forwardQuoteUpdate).toBeCalledWith(...args)
      expect(mockChildSpan.finish).not.toBeCalled()
      expect(refs).toMatchObject(expected)
    })
    it('should store to db and forward quote update with geoCode in switch mode', async () => {
      expect.assertions(9)

      mockConfig.simpleRoutingMode = false
      quotesModel.checkDuplicateQuoteResponse = jest.fn(() => { return { isDuplicateId: false, isResend: false } })
      quotesModel.calculateRequestHash = jest.fn(() => 'hash')
      const expected = {
        quoteResponseId: 'resp123',
        geoCodeId: 'geoCodeId',
        extensions: mockData.quoteUpdate.extensionList.extension
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

      mockConfig.simpleRoutingMode = false
      quotesModel.checkDuplicateQuoteResponse = jest.fn(() => { return { isDuplicateId: false, isResend: false } })
      quotesModel.calculateRequestHash = jest.fn(() => 'hash')
      const expected = {
        quoteResponseId: 'resp123',
        geoCodeId: 'geoCodeId',
        extensions: mockData.quoteUpdate.extensionList.extension
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

      mockConfig.simpleRoutingMode = false
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

      mockConfig.simpleRoutingMode = false
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
      mockConfig.simpleRoutingMode = true
      quotesModel.db.getParticipantEndpoint.mockReturnValueOnce(mockData.endpoints.payeefsp)

      await expect(quotesModel.forwardQuoteUpdate(mockData.headers, mockData.quoteId, mockData.quoteUpdate, mockChildSpan))
        .resolves
        .toBe(undefined)

      expect(quotesModel.db.getParticipantEndpoint).toBeCalled()
      expect(quotesModel.db.getQuotePartyEndpoint).not.toBeCalled()
    })
    it('should get http status code 200 OK in switch mode', async () => {
      expect.assertions(3)

      mockConfig.simpleRoutingMode = false
      quotesModel.db.getParticipantEndpoint.mockReturnValueOnce(mockData.endpoints.payeefsp)

      await expect(quotesModel.forwardQuoteUpdate(mockData.headers, mockData.quoteId, mockData.quoteUpdate, mockChildSpan))
        .resolves
        .toBe(undefined)

      expect(quotesModel.db.getParticipantEndpoint).toBeCalled()
      expect(quotesModel.db.getQuotePartyEndpoint).not.toBeCalled()
    })
    it('should throw when quoteUpdate is undefined', async () => {
      expect.assertions(1)

      await expect(quotesModel.forwardQuoteUpdate(mockData.headers, mockData.quoteId, undefined, mockChildSpan))
        .rejects
        .toHaveProperty('apiErrorCode.code', ErrorHandler.Enums.FSPIOPErrorCodes.INTERNAL_SERVER_ERROR.code)
    })
    it('should throw when participant endpoint is not found', async () => {
      expect.assertions(1)

      mockConfig.simpleRoutingMode = false
      const endpoint = undefined
      quotesModel.db.getQuotePartyEndpoint.mockReturnValueOnce(endpoint)
      quotesModel.sendErrorCallback = jest.fn((_, fspiopError) => { throw fspiopError })

      await expect(quotesModel.forwardQuoteUpdate(mockData.headers, mockData.quoteId, mockData.quoteUpdate, mockChildSpan))
        .rejects
        .toHaveProperty('apiErrorCode.code', ErrorHandler.Enums.FSPIOPErrorCodes.DESTINATION_FSP_ERROR.code)
    })
    it('should not use spans when undefined and should throw when participant endpoint is invalid', async () => {
      expect.assertions(3)

      mockConfig.simpleRoutingMode = false
      quotesModel.db.getParticipantEndpoint.mockReturnValueOnce(mockData.endpoints.invalid)
      Http.httpRequest.mockImplementationOnce(() => { throw ErrorHandler.CreateFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.DESTINATION_COMMUNICATION_ERROR) })

      await expect(quotesModel.forwardQuoteUpdate(mockData.headers, mockData.quoteId, mockData.quoteUpdate))
        .rejects
        .toHaveProperty('apiErrorCode.code', ErrorHandler.Enums.FSPIOPErrorCodes.DESTINATION_COMMUNICATION_ERROR.code)

      expect(mockChildSpan.injectContextToHttpRequest).not.toHaveBeenCalled()
      expect(mockChildSpan.audit).not.toHaveBeenCalled()
    })
    it('should throw when participant endpoint returns invalid response', async () => {
      expect.assertions(3)

      mockConfig.simpleRoutingMode = false
      quotesModel.db.getParticipantEndpoint.mockReturnValueOnce(mockData.endpoints.invalidResponse)
      Http.httpRequest.mockImplementationOnce(() => { throw ErrorHandler.CreateFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.DESTINATION_COMMUNICATION_ERROR) })

      await expect(quotesModel.forwardQuoteUpdate(mockData.headers, mockData.quoteId, mockData.quoteUpdate))
        .rejects
        .toHaveProperty('apiErrorCode.code', ErrorHandler.Enums.FSPIOPErrorCodes.DESTINATION_COMMUNICATION_ERROR.code)

      expect(mockChildSpan.injectContextToHttpRequest).not.toHaveBeenCalled()
      expect(mockChildSpan.audit).not.toHaveBeenCalled()
    })
    it('should inspect and throw custom error as FSPIOPerror', async () => {
      expect.assertions(3)

      mockConfig.simpleRoutingMode = false
      const customErrorNoStack = new Error('Custom error')
      delete customErrorNoStack.stack
      quotesModel.db.getParticipantEndpoint.mockRejectedValueOnce(customErrorNoStack)

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

  describe('handleQuoteError', () => {
    beforeEach(() => {
      // restore the current method in test to its original implementation
      quotesModel.handleQuoteError.mockRestore()
    })

    it('handles the quote error', async () => {
      // Arrange
      expect.assertions(2)
      mockConfig.simpleRoutingMode = true
      const error = {
        errorCode: 2001,
        errorDescription: 'Test Error'
      }

      // Act
      const result = await quotesModel.handleQuoteError(mockData.headers, mockData.quoteId, error, mockSpan)

      // Assert
      // For `handleQuoteError` response is undefined
      expect(result).toBe(undefined)
      expect(quotesModel.sendErrorCallback).toHaveBeenCalledTimes(1)
    })

    it('sends the error callback to the correct destination', async () => {
      // Arrange
      expect.assertions(3)
      mockConfig.simpleRoutingMode = true
      const error = {
        errorCode: 2001,
        errorDescription: 'Test Error'
      }
      quotesModel.sendErrorCallback = jest.fn()

      // Act
      const result = await quotesModel.handleQuoteError(mockData.headers, mockData.quoteId, error, mockSpan)

      // Assert
      // For `handleQuoteError` response is undefined
      expect(result).toBe(undefined)
      expect(quotesModel.sendErrorCallback).toHaveBeenCalledTimes(1)
      expect(quotesModel.sendErrorCallback.mock.calls[0][0])
        .toEqual(mockData.headers[Enum.Http.Headers.FSPIOP.DESTINATION])
    })

    it('handles the quote error with simpleRoutingMode: false', async () => {
      // Arrange
      expect.assertions(4)
      mockConfig.simpleRoutingMode = false
      const error = {
        errorCode: 2001,
        errorDescription: 'Test Error'
      }

      // Act
      const result = await quotesModel.handleQuoteError(mockData.headers, mockData.quoteId, error, mockSpan)

      // Assert
      expect(result).toBe(mockData.quoteId)
      expect(quotesModel.sendErrorCallback).toHaveBeenCalledTimes(1)
      expect(quotesModel.db.newTransaction.mock.calls.length).toBe(1)
      expect(quotesModel.db.createQuoteError.mock.calls.length).toBe(1)
    })

    it('handles bad error input', async () => {
      // Arrange
      expect.assertions(1)
      mockConfig.simpleRoutingMode = false
      const error = {
        errorDescription: 'Test Error'
      }

      const errorMessage = {
        message: 'Test Error'
      }

      // Act
      const action = async () => quotesModel.handleQuoteError(mockData.headers, mockData.quoteId, error, mockSpan)

      // const es = 'Factory function createFSPIOPError failed due to apiErrorCode being invalid'
      // Assert
      await expect(action()).rejects.toThrowError(`Factory function createFSPIOPError failed due to apiErrorCode being invalid - ${JSON.stringify(errorMessage)}.`)
    })
  })

  describe('handleQuoteGet', () => {
    beforeEach(() => {
      // restore the current method in test to its original implementation
      quotesModel.handleQuoteGet.mockRestore()
    })

    it('handles the quote get with a child span', async () => {
      // Arrange
      expect.assertions(3)

      // Act
      await quotesModel.handleQuoteGet(mockData.headers, mockData.quoteId, mockSpan)

      // Assert
      expect(mockChildSpan.audit.mock.calls.length).toBe(1)
      expect(mockChildSpan.finish.mock.calls.length).toBe(1)
      expect(quotesModel.forwardQuoteGet.mock.calls.length).toBe(1)
    })

    it('handles an exception on `span.getChild`', async () => {
      // Arrange
      expect.assertions(1)
      mockSpan.getChild = jest.fn(() => { throw new Error('Test Error') })

      // Act
      const action = async () => quotesModel.handleQuoteGet(mockData.headers, mockData.quoteId, mockSpan)

      // Assert
      await expect(action()).rejects.toThrowError('Test Error')
    })

    it('handles an exception on `childSpan.audit`', async () => {
      // Arrange
      expect.assertions(2)
      mockChildSpan.audit = jest.fn(() => { throw new Error('Test Error') })

      // Act
      await quotesModel.handleQuoteGet(mockData.headers, mockData.quoteId, mockSpan)

      // Assert
      expect(mockChildSpan.finish.mock.calls.length).toBe(1)
      expect(quotesModel.handleException.mock.calls.length).toBe(1)
    })
  })

  describe('forwardQuoteGet', () => {
    beforeEach(() => {
      // restore the current method in test to its original implementation
      quotesModel.forwardQuoteGet.mockRestore()
    })

    it('fails to forward if the database has no endpoint for the dfsp', async () => {
      // Arrange
      expect.assertions(1)
      quotesModel.db.getParticipantEndpoint.mockImplementation(() => null)

      // Act
      const action = async () => quotesModel.forwardQuoteGet(mockData.headers, mockData.quoteId, mockSpan)

      // Assert
      await expect(action()).rejects.toThrowError('No FSPIOP_CALLBACK_URL_QUOTES found for quote GET test123')
    })

    it('forwards the request to the payee dfsp without a span', async () => {
      // Arrange
      // expect.assertions(2)
      quotesModel.db.getParticipantEndpoint.mockImplementation(() => 'http://localhost:3333')
      const expectedOptions = {
        headers: {},
        method: 'GET',
        url: 'http://localhost:3333/quotes/test123'
      }

      // Act
      await quotesModel.forwardQuoteGet(mockData.headers, mockData.quoteId)

      // Assert
      expect(Http.httpRequest).toBeCalledTimes(1)
      expect(Http.httpRequest).toBeCalledWith(expectedOptions, mockData.headers[Enum.Http.Headers.FSPIOP.SOURCE])
    })

    it('forwards the request to the payee dfsp', async () => {
      // Arrange
      expect.assertions(4)
      quotesModel.db.getParticipantEndpoint.mockImplementation(() => 'http://localhost:3333')
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
      await quotesModel.forwardQuoteGet(mockData.headers, mockData.quoteId, mockSpan)

      // Assert
      expect(mockSpan.injectContextToHttpRequest).toBeCalledTimes(1)
      expect(mockSpan.audit).toBeCalledTimes(1)
      expect(Http.httpRequest).toBeCalledTimes(1)
      expect(Http.httpRequest).toBeCalledWith(expectedOptions, mockData.headers[Enum.Http.Headers.FSPIOP.SOURCE])
    })

    it('handles a http error', async () => {
      // Arrange
      expect.assertions(1)
      quotesModel.db.getParticipantEndpoint.mockImplementation(() => 'http://localhost:3333')
      Http.httpRequest.mockImplementationOnce(() => { throw new Error('Test HTTP Error') })

      // Act
      const action = async () => quotesModel.forwardQuoteGet(mockData.headers, mockData.quoteId)

      // Assert
      await expect(action()).rejects.toThrowError('Test HTTP Error')
    })
  })

  describe('handleException', () => {
    beforeEach(() => {
      // restore the current method in test to its original implementation
      quotesModel.handleException.mockRestore()
    })

    it('handles the error and finishes the child span', async () => {
      // Arrange
      expect.assertions(3)
      const error = new Error('Test Error')
      const expectedError = ErrorHandler.ReformatFSPIOPError(error)
      quotesModel.sendErrorCallback.mockImplementationOnce(() => true)

      // Act
      const result = await quotesModel.handleException('payeefsp', mockData.quoteId, error, mockData.headers, mockSpan)

      // Assert
      expect(quotesModel.sendErrorCallback).toHaveBeenCalledWith('payeefsp', expectedError, mockData.quoteId, mockData.headers, mockChildSpan, true)
      expect(result).toStrictEqual({ code: 202 })
      expect(mockChildSpan.finish).toHaveBeenCalledTimes(1)
    })

    it('handles an error in sendErrorCallback', async () => {
      // Arrange
      expect.assertions(3)
      const error = new Error('Test Error')
      const expectedError = ErrorHandler.ReformatFSPIOPError(error)
      quotesModel.sendErrorCallback.mockImplementationOnce(() => { throw new Error('Error sending callback.') })

      // Act
      await quotesModel.handleException('payeefsp', mockData.quoteId, error, mockData.headers, mockSpan)

      // Assert
      expect(quotesModel.sendErrorCallback).toHaveBeenCalledWith('payeefsp', expectedError, mockData.quoteId, mockData.headers, mockChildSpan, true)
      expect(quotesModel.writeLog).toHaveBeenCalledTimes(1)
      expect(mockChildSpan.finish).toHaveBeenCalledTimes(1)
    })
  })

  describe('sendErrorCallback', () => {
    beforeEach(() => {
      // restore the current method in test to its original implementation
      quotesModel.sendErrorCallback.mockRestore()
    })

    it('sends the error callback without a span', async () => {
      // Arrange
      expect.assertions(1)
      quotesModel.db.getParticipantEndpoint.mockReturnValueOnce(mockData.endpoints.payeefsp)
      quotesModel.generateRequestHeaders.mockReturnValueOnce({})
      const error = new Error('Test Error')
      const fspiopError = ErrorHandler.ReformatFSPIOPError(error)
      const expectedOptions = {
        method: Enum.Http.RestMethods.PUT,
        url: 'http://localhost:8444/payeefsp/quotes/test123/error',
        data: JSON.stringify(fspiopError.toApiErrorObject(mockConfig.errorHandling), LibUtil.getCircularReplacer()),
        headers: {}
      }

      // Act
      await quotesModel.sendErrorCallback('payeefsp', fspiopError, mockData.quoteId, mockData.headers)

      // Assert
      expect(axios.request).toBeCalledWith(expectedOptions)
    })

    it('sends the error callback and handles the span', async () => {
      // Arrange
      expect.assertions(3)
      quotesModel.db.getParticipantEndpoint.mockReturnValueOnce(mockData.endpoints.payeefsp)
      quotesModel.generateRequestHeaders.mockReturnValueOnce({})
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
      await quotesModel.sendErrorCallback('payeefsp', fspiopError, mockData.quoteId, mockData.headers, mockSpan)

      // Assert
      expect(mockSpan.injectContextToHttpRequest).toBeCalledTimes(1)
      expect(mockSpan.audit).toBeCalledTimes(1)
      expect(axios.request).toBeCalledWith(expectedOptions)
    })

    it('sends the error callback JWS signed', async () => {
      // Arrange
      const jwsSignSpy = jest.spyOn(JwsSigner.prototype, 'getSignature')
      // expect.assertions(6)
      quotesModel.db.getParticipantEndpoint.mockReturnValueOnce(mockData.endpoints.payeefsp)
      quotesModel.generateRequestHeaders.mockReturnValueOnce({})
      const error = new Error('Test Error')
      const fspiopError = ErrorHandler.ReformatFSPIOPError(error)
      mockSpan.injectContextToHttpRequest = jest.fn().mockImplementation(() => ({
        headers: {
          spanHeaders: '12345',
          'fspiop-source': 'switch',
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
      await quotesModel.sendErrorCallback('payeefsp', fspiopError, mockData.quoteId, mockData.headers, mockSpan, true)
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
      quotesModel.db.getParticipantEndpoint.mockReturnValueOnce(mockData.endpoints.payeefsp)
      quotesModel.generateRequestHeaders.mockReturnValueOnce({})
      const error = new Error('Test Error')
      const fspiopError = ErrorHandler.ReformatFSPIOPError(error)
      mockSpan.injectContextToHttpRequest = jest.fn().mockImplementation(() => ({
        headers: {
          spanHeaders: '12345',
          'fspiop-source': 'switch',
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
          'fspiop-source': 'switch',
          'fspiop-destination': 'dfsp2'
        }
      }
      mockConfig.jws.jwsSign = false
      // Act
      await quotesModel.sendErrorCallback('payeefsp', fspiopError, mockData.quoteId, mockData.headers, mockSpan, true)
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
      quotesModel.db.getParticipantEndpoint.mockReturnValueOnce(mockData.endpoints.payeefsp)
      quotesModel.generateRequestHeaders.mockReturnValueOnce({})
      const error = new Error('Test Error')
      const fspiopError = ErrorHandler.ReformatFSPIOPError(error)
      mockSpan.injectContextToHttpRequest = jest.fn().mockImplementation(() => ({
        headers: {
          spanHeaders: '12345',
          'fspiop-source': 'switch',
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
          'fspiop-source': 'switch',
          'fspiop-destination': 'dfsp2'
        }
      }
      mockConfig.jws.jwsSign = false
      // Act
      await quotesModel.sendErrorCallback('payeefsp', fspiopError, mockData.quoteId, mockData.headers, mockSpan, false)
      // Assert
      expect(mockSpan.injectContextToHttpRequest).toBeCalledTimes(1)
      expect(mockSpan.audit).toBeCalledTimes(1)
      expect(jwsSignSpy).not.toHaveBeenCalled()
      expect(axios.request.mock.calls[0][0].headers).not.toHaveProperty('fspiop-signature')
      expect(axios.request).toBeCalledWith(expectedOptions)
      jwsSignSpy.mockRestore()
    })

    it('handles when the endpoint could not be found', async () => {
      // Arrange
      expect.assertions(2)
      quotesModel.db.getParticipantEndpoint.mockReturnValueOnce(undefined)
      quotesModel.generateRequestHeaders.mockReturnValueOnce({})
      const error = new Error('Test Error')
      const fspiopError = ErrorHandler.ReformatFSPIOPError(error)

      // Act
      const action = async () => quotesModel.sendErrorCallback('payeefsp', fspiopError, mockData.quoteId, mockData.headers, mockSpan)

      // Assert
      await expect(action()).rejects.toThrow('No FSPIOP_CALLBACK_URL_QUOTES found for payeefsp unable to make error callback')
      expect(axios.request).not.toHaveBeenCalled()
    })

    it('handles a http exception', async () => {
      // Arrange
      expect.assertions(2)
      quotesModel.db.getParticipantEndpoint.mockReturnValueOnce(mockData.endpoints.payeefsp)
      quotesModel.generateRequestHeaders.mockReturnValueOnce({})
      const error = new Error('Test Error')
      const fspiopError = ErrorHandler.ReformatFSPIOPError(error)
      axios.request.mockImplementationOnce(() => { throw new Error('HTTP test error') })

      // Act
      const action = async () => quotesModel.sendErrorCallback('payeefsp', fspiopError, mockData.quoteId, mockData.headers)

      // Assert
      await expect(action()).rejects.toThrow('network error in sendErrorCallback: HTTP test error')
      expect(axios.request).toHaveBeenCalledTimes(1)
    })

    it('handles a http bad status code', async () => {
      // Arrange
      expect.assertions(2)
      quotesModel.db.getParticipantEndpoint.mockReturnValueOnce(mockData.endpoints.payeefsp)
      quotesModel.generateRequestHeaders.mockReturnValueOnce({})
      const error = new Error('Test Error')
      const fspiopError = ErrorHandler.ReformatFSPIOPError(error)
      axios.request.mockReturnValueOnce({
        status: Enum.Http.ReturnCodes.BADREQUEST.CODE
      })

      // Act
      const action = async () => quotesModel.sendErrorCallback('payeefsp', fspiopError, mockData.quoteId, mockData.headers)

      // Assert
      await expect(action()).rejects.toThrow('Got non-success response sending error callback')
      expect(axios.request).toHaveBeenCalledTimes(1)
    })
  })

  describe('checkDuplicateQuoteRequest', () => {
    beforeEach(() => {
      // restore the current method in test to its original implementation
      quotesModel.checkDuplicateQuoteRequest.mockRestore()
      quotesModel.calculateRequestHash.mockRestore()
    })

    it('handles a non-duplicate request', async () => {
      // Arrange
      expect.assertions(2)
      quotesModel.db.getQuoteDuplicateCheck.mockReturnValueOnce(undefined)
      const expected = {
        isResend: false,
        isDuplicateId: false
      }

      // Act
      const result = await quotesModel.checkDuplicateQuoteRequest(mockData.quoteRequest)

      // Assert
      expect(result).toEqual(expected)
      expect(quotesModel.db.getQuoteDuplicateCheck).toHaveBeenCalledTimes(1)
    })

    it('handles a duplicate id', async () => {
      // Arrange
      expect.assertions(2)
      quotesModel.db.getQuoteDuplicateCheck.mockReturnValueOnce({
        hash: 'this_hash_will_not_match'
      })
      const expected = {
        isResend: false,
        isDuplicateId: true
      }

      // Act
      const result = await quotesModel.checkDuplicateQuoteRequest(mockData.quoteRequest)

      // Assert
      expect(result).toEqual(expected)
      expect(quotesModel.db.getQuoteDuplicateCheck).toHaveBeenCalledTimes(1)
    })

    it('handles a matching hash', async () => {
      // Arrange
      expect.assertions(2)
      quotesModel.db.getQuoteDuplicateCheck.mockReturnValueOnce({
        hash: quotesModel.calculateRequestHash(mockData.quoteRequest)
      })
      const expected = {
        isResend: true,
        isDuplicateId: true
      }

      // Act
      const result = await quotesModel.checkDuplicateQuoteRequest(mockData.quoteRequest)

      // Assert
      expect(result).toEqual(expected)
      expect(quotesModel.db.getQuoteDuplicateCheck).toHaveBeenCalledTimes(1)
    })

    it('handles an exception when checking the duplicate', async () => {
      // Arrange
      expect.assertions(2)
      quotesModel.db.getQuoteDuplicateCheck.mockImplementationOnce(() => { throw new Error('Duplicate check error') })

      // Act
      const action = async () => quotesModel.checkDuplicateQuoteRequest(mockData.quoteRequest)

      // Assert
      await expect(action()).rejects.toThrow('Duplicate check error')
      expect(quotesModel.db.getQuoteDuplicateCheck).toHaveBeenCalledTimes(1)
    })
  })

  describe('checkDuplicateQuoteResponse', () => {
    beforeEach(() => {
      // restore the current method in test to its original implementation
      quotesModel.checkDuplicateQuoteResponse.mockRestore()
      quotesModel.calculateRequestHash.mockRestore()
    })

    it('handles a non-duplicate request', async () => {
      // Arrange
      // expect.assertions(2)
      quotesModel.db.getQuoteResponseDuplicateCheck.mockReturnValueOnce(undefined)
      const expected = {
        isResend: false,
        isDuplicateId: false
      }

      // Act
      const result = await quotesModel.checkDuplicateQuoteResponse(mockData.quoteId, mockData.quoteResponse)

      // Assert
      expect(result).toEqual(expected)
      expect(quotesModel.db.getQuoteResponseDuplicateCheck).toHaveBeenCalledTimes(1)
    })

    it('handles a duplicate id', async () => {
      // Arrange
      expect.assertions(2)
      quotesModel.db.getQuoteResponseDuplicateCheck.mockReturnValueOnce({
        hash: 'this_hash_will_not_match'
      })
      const expected = {
        isResend: false,
        isDuplicateId: true
      }

      // Act
      const result = await quotesModel.checkDuplicateQuoteResponse(mockData.quoteId, mockData.quoteResponse)

      // Assert
      expect(result).toEqual(expected)
      expect(quotesModel.db.getQuoteResponseDuplicateCheck).toHaveBeenCalledTimes(1)
    })

    it('handles a matching hash', async () => {
      // Arrange
      expect.assertions(2)
      quotesModel.db.getQuoteResponseDuplicateCheck.mockReturnValueOnce({
        hash: quotesModel.calculateRequestHash(mockData.quoteResponse)
      })
      const expected = {
        isResend: true,
        isDuplicateId: true
      }

      // Act
      const result = await quotesModel.checkDuplicateQuoteResponse(mockData.quoteId, mockData.quoteResponse)

      // Assert
      expect(result).toEqual(expected)
      expect(quotesModel.db.getQuoteResponseDuplicateCheck).toHaveBeenCalledTimes(1)
    })

    it('handles an exception when checking the duplicate', async () => {
      // Arrange
      // expect.assertions(2)
      quotesModel.db.getQuoteResponseDuplicateCheck.mockImplementationOnce(() => { throw new Error('Duplicate check error') })

      // Act
      const action = async () => quotesModel.checkDuplicateQuoteResponse(mockData.quoteId, mockData.quoteResponse)

      // Assert
      await expect(action()).rejects.toThrow('Duplicate check error')
      expect(quotesModel.db.getQuoteResponseDuplicateCheck).toHaveBeenCalledTimes(1)
    })
  })

  describe('removeEmptyKeys', () => {
    beforeEach(() => {
      // restore the current method in test to its original implementation
      quotesModel.removeEmptyKeys.mockRestore()
    })

    it('removes nothing if there are no empty keys', () => {
      // Arrange
      const input = {
        a: 1,
        b: 2,
        c: 3
      }
      const expected = {
        a: 1,
        b: 2,
        c: 3
      }

      // Act
      const result = quotesModel.removeEmptyKeys(input)

      // Assert
      expect(result).toStrictEqual(expected)
    })

    it('removes a key and if it is undefined', () => {
      // Arrange
      const input = {
        a: 1,
        b: 2,
        c: undefined
      }
      const expected = {
        a: 1,
        b: 2
      }

      // Act
      const result = quotesModel.removeEmptyKeys(input)

      // Assert
      expect(result).toStrictEqual(expected)
    })

    it('removes an empty key', () => {
      // Arrange
      const input = {
        a: 1,
        b: 2,
        c: {

        }
      }
      const expected = {
        a: 1,
        b: 2
      }

      // Act
      const result = quotesModel.removeEmptyKeys(input)

      // Assert
      expect(result).toStrictEqual(expected)
    })

    it('removes a nested empty key', () => {
      // Arrange
      const input = {
        a: 1,
        b: 2,
        c: {
          d: {

          }
        }
      }
      const expected = {
        a: 1,
        b: 2,
        c: {}
      }

      // Act
      const result = quotesModel.removeEmptyKeys(input)

      // Assert
      expect(result).toStrictEqual(expected)
    })
  })

  describe('generateRequestHeaders', () => {
    beforeEach(() => {
      // restore the current method in test to its original implementation
      quotesModel.generateRequestHeaders.mockRestore()
      quotesModel.removeEmptyKeys.mockRestore()
    })

    it('generates the default request headers', () => {
      // Arrange
      const expected = {
        'Content-Type': 'application/vnd.interoperability.quotes+json;version=1.0',
        'FSPIOP-Destination': 'dfsp2',
        'FSPIOP-Source': 'dfsp1'
      }

      // Act
      const result = quotesModel.generateRequestHeaders(mockData.headers, true)

      // Assert
      expect(result).toStrictEqual(expected)
    })

    it('generates default request headers, including the Accept', () => {
      // Arrange
      const expected = {
        Accept: 'application/vnd.interoperability.quotes+json;version=1',
        'Content-Type': 'application/vnd.interoperability.quotes+json;version=1.0',
        'FSPIOP-Destination': 'dfsp2',
        'FSPIOP-Source': 'dfsp1'
      }

      // Act
      const result = quotesModel.generateRequestHeaders(mockData.headers, false)

      // Assert
      expect(result).toStrictEqual(expected)
    })
  })

  describe('generateRequestHeadersForJWS', () => {
    beforeEach(() => {
      // restore the current method in test to its original implementation
      quotesModel.generateRequestHeadersForJWS.mockRestore()
      quotesModel.removeEmptyKeys.mockRestore()
    })

    it('generates the default request headers', () => {
      // Arrange
      const expected = {
        'Content-Type': 'application/vnd.interoperability.quotes+json;version=1.0',
        'fspiop-destination': 'dfsp2',
        'fspiop-source': 'dfsp1'
      }

      // Act
      const result = quotesModel.generateRequestHeadersForJWS(mockData.headers, true)

      // Assert
      expect(result).toStrictEqual(expected)
    })

    it('generates default request headers, including the Accept', () => {
      // Arrange
      const expected = {
        Accept: 'application/vnd.interoperability.quotes+json;version=1',
        'Content-Type': 'application/vnd.interoperability.quotes+json;version=1.0',
        'fspiop-destination': 'dfsp2',
        'fspiop-source': 'dfsp1'
      }

      // Act
      const result = quotesModel.generateRequestHeadersForJWS(mockData.headers, false)

      // Assert
      expect(result).toStrictEqual(expected)
    })
  })

  describe('writeLog', () => {
    beforeEach(() => {
      // restore the current method in test to its original implementation
      quotesModel.writeLog.mockRestore()
    })

    it('writes to the log', () => {
      // Arrange
      // Act
      quotesModel.writeLog('test message')

      // Assert
      expect(Logger.info).toBeCalledTimes(1)
    })
  })
})
