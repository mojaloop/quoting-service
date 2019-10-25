// (C)2018 ModusBox Inc.
/*****
 License
 --------------
 Copyright © 2017 Bill & Melinda Gates Foundation
 The Mojaloop files are made available by the Bill & Melinda Gates Foundation under the Apache License, Version 2.0 (the "License") and you may not use these files except in compliance with the License. You may obtain a copy of the License at
 http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, the Mojaloop files are distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.

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

 * Neal Donnan <neal.donnan@modusbox.com>
 --------------
 ******/

/* replace nested tests with `describe`
 * removed all test.end calls:
 *   %g/test.end/:norm dd
 * replaced all test.ok calls with expect.toBeTruthy:
 *   %s/test\.ok(\([^)]*\))/expect(\1).toBeTruthy/g
 * replaced all `test` test parameters with no parameters:
 *   %s/async test =>/async () =>/g
 * replaced all test.equal with expect.toBe
 *   %s/test.equal(\([^,]*\), \([^)]*\))/expect(\1).toBe(\2)
 * replaced all deepEqual calls manually
 * replace all toBeTruthy 'properties'
 *   %s/toBeTruthy$/toBeTruthy()
 */

const ErrorHandler = require('@mojaloop/central-services-error-handling')
const Sinon = require('sinon')
const conf = require('../../../config/default')
const Db = require('../../../src/data/database')
const AxiosMock = require('axios')

jest.mock('axios')

AxiosMock.request = (opts1) => {
  if (opts1.url === 'http://invalid.com/dfsp2/quotes') {
    return Promise.reject(new Error('Unable to reach host'))
  } else if (opts1.url === 'http://invalidresponse.com/dfsp2/quotes') {
    return Promise.resolve({ status: 200 })
  } else if ((/\/participants\//).test(opts1.url)) {
    return Promise.resolve({
      ok: true,
      json: () => ({
        accounts: [{
          ledgerAccountType: 'SETTLEMENT',
          currency: 'ZAR'
        }]
      })
    })
  }
  return Promise.resolve({ status: 202 })
}

describe('quotesModel', () => {
  let sandbox
  let SpanStub
  let quotesModel
  let db

  const QuotesModel = require('../../../src/model/quotes')

  beforeEach(() => {
    db = new Db()
    quotesModel = new QuotesModel({
      db: db,
      requestId: 'test123'
    })
    sandbox = Sinon.createSandbox()
    SpanStub = {
      audit: sandbox.stub().callsFake(),
      error: sandbox.stub().callsFake(),
      finish: sandbox.stub().callsFake(),
      debug: sandbox.stub().callsFake(),
      info: sandbox.stub().callsFake(),
      getChild: sandbox.stub().returns(SpanStub),
      setTags: sandbox.stub().callsFake(),
      injectContextToHttpRequest: sandbox.stub().callsFake(o => o)
    }
  })

  afterEach(() => {})

  test('validate quote update', async () => {
    await quotesModel.validateQuoteUpdate()
    expect(quotesModel).toBeTruthy()
  })

  test('handle a quote request', async () => {
    const headers = {
      'fspiop-source': 'dfsp1',
      'fspiop-destination': 'dfsp2'
    }

    const quoteRequest = {
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
    }

    conf.SIMPLE_ROUTING_MODE = false
    const transaction = { commit: () => { }, rollback: () => { } } // mock rollback so we can better see the error causing test failures
    Sinon.stub(db, 'newTransaction').returns(transaction)
    Sinon.stub(db, 'getQuoteDuplicateCheck').returns(null)
    Sinon.stub(db, 'createQuoteDuplicateCheck').returns(quoteRequest.quoteId)
    Sinon.stub(db, 'createTransactionReference').returns(quoteRequest.transactionId)
    Sinon.stub(db, 'getInitiatorType').returns(1)
    Sinon.stub(db, 'getInitiator').returns(2)
    Sinon.stub(db, 'getScenario').returns(3)
    Sinon.stub(db, 'getAmountType').returns(4)
    Sinon.stub(db, 'createQuote').returns(quoteRequest.quoteId)
    Sinon.stub(db, 'createPayerQuoteParty').returns(5)
    Sinon.stub(db, 'createPayeeQuoteParty').returns(6)
    Sinon.stub(db, 'getQuotePartyEndpoint').returns('http://test.com/dfsp2')
    Sinon.stub(db, 'getParticipant').returns(5)
    Sinon.stub(quotesModel, 'executeRules').returns([])

    const refs = await quotesModel.handleQuoteRequest(headers, quoteRequest, SpanStub)
    expect(refs).toBeTruthy()
    expect(refs).toEqual({
      transactionReferenceId: 'abc123',
      transactionInitiatorTypeId: 1,
      transactionInitiatorId: 2,
      transactionScenarioId: 3,
      amountTypeId: 4,
      quoteId: 'test123',
      payerId: 5,
      payeeId: 6
    })
  })

  test('handle a quote request triggering an INVALID_QUOTE_REQUEST event from the rules engine', async () => {
    const headers = {
      'fspiop-source': 'dfsp1',
      'fspiop-destination': 'dfsp2'
    }

    const quoteRequest = {
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
    }

    conf.SIMPLE_ROUTING_MODE = false
    const transaction = { commit: () => { }, rollback: () => { } } // mock rollback so we can better see the error causing test failures
    Sinon.stub(db, 'newTransaction').returns(transaction)
    Sinon.stub(db, 'getQuoteDuplicateCheck').returns(null)
    Sinon.stub(db, 'createQuoteDuplicateCheck').returns(quoteRequest.quoteId)
    Sinon.stub(db, 'createTransactionReference').returns(quoteRequest.transactionId)
    Sinon.stub(db, 'getInitiatorType').returns(1)
    Sinon.stub(db, 'getInitiator').returns(2)
    Sinon.stub(db, 'getScenario').returns(3)
    Sinon.stub(db, 'getAmountType').returns(4)
    Sinon.stub(db, 'createQuote').returns(quoteRequest.quoteId)
    Sinon.stub(db, 'createPayerQuoteParty').returns(5)
    Sinon.stub(db, 'createPayeeQuoteParty').returns(6)
    Sinon.stub(db, 'getQuotePartyEndpoint').returns('http://test.com/dfsp2')
    Sinon.stub(db, 'getParticipant').returns(5)

    const refs = await quotesModel.handleQuoteRequest(headers, quoteRequest, SpanStub)
    expect(refs).toBeTruthy()
    expect(refs).toEqual({
      transactionReferenceId: 'abc123',
      transactionInitiatorTypeId: 1,
      transactionInitiatorId: 2,
      transactionScenarioId: 3,
      amountTypeId: 4,
      quoteId: 'test123',
      payerId: 5,
      payeeId: 6
    })
  })

  test('fail quote update since "accept" header is specified', async () => {
    const headers = {
      accept: '*.*'
    }

    // Idiomatic Jest- no `fail` function
    expect.assertions(2)
    try {
      await quotesModel.handleQuoteUpdate(headers)
    } catch (err) {
      expect(err instanceof ErrorHandler.Factory.FSPIOPError).toBeTruthy()
      expect(err.apiErrorCode.code).toBe(ErrorHandler.Enums.FSPIOPErrorCodes.VALIDATION_ERROR.code)
    }
  })

  test('update quote successfully', async () => {
    const headers = {
      'fspiop-source': 'dfsp1',
      'fspiop-destination': 'dfsp2'
    }

    const quoteRequest = {
      quoteId: 'test123',
      transactionId: 'abc123',
      amountType: 'SEND',
      transactionType: {
        scenario: 'TRANSFER',
        initiator: 'PAYER',
        initiatorType: 'CONSUMER'
      }
    }

    const transaction = {
      commit: () => {},
      rollback: () => { }
    }
    Sinon.stub(db, 'newTransaction').returns(transaction)
    Sinon.stub(db, 'createQuoteResponse').returns({ quoteResponseId: quoteRequest.transactionId })
    Sinon.stub(db, 'createQuoteUpdateDuplicateCheck').returns(null)
    Sinon.stub(db, 'createQuoteResponseIlpPacket').returns(null)
    Sinon.stub(db, 'createTransactionReference').returns(quoteRequest.transactionId)
    Sinon.stub(quotesModel, 'checkDuplicateQuoteResponse').returns({ isDuplicatedId: false, isResend: false })

    const refs = await quotesModel.handleQuoteUpdate(headers, quoteRequest.id, quoteRequest, SpanStub)
    expect(refs).toBeTruthy()
    expect(refs).toEqual({ quoteResponseId: quoteRequest.transactionId })
  })

  test('throw an error on duplicate quote with a different body', async () => {
    // Idiomatic Jest- no `fail` function
    expect.assertions(3)
    try {
      const headers = {
        'fspiop-source': 'dfsp1',
        'fspiop-destination': 'dfsp2'
      }

      const quoteRequest = {
        quoteId: 'test123',
        transactionId: 'abc123',
        amountType: 'SEND',
        transactionType: {
          scenario: 'TRANSFER',
          initiator: 'PAYER',
          initiatorType: 'CONSUMER'
        }
      }

      const transaction = {
        rollback: () => { }
      }
      Sinon.stub(db, 'newTransaction').returns(transaction)
      Sinon.stub(db, 'getParticipant').returns(3)
      Sinon.stub(db, 'getQuoteDuplicateCheck').returns({ hash: '85b6067dc6e271c53e2bbc2218e94187022677e80267f95ca28c80707b3009bc' })
      Sinon.stub(quotesModel, 'executeRules').returns([])

      await quotesModel.handleQuoteRequest(headers, quoteRequest, SpanStub)
    } catch (err) {
      expect(err instanceof ErrorHandler.Factory.FSPIOPError).toBeTruthy()
      expect(err.apiErrorCode.code).toBe(ErrorHandler.Enums.FSPIOPErrorCodes.MODIFIED_REQUEST.code)
      expect(err.message).toBe('Quote test123 is a duplicate but hashes dont match')
    }
  })

  test('handle a quote resend', async () => {
    const headers = {
      'fspiop-source': 'dfsp1',
      'fspiop-destination': 'dfsp2'
    }

    const quoteRequest = {
      quoteId: 'test123',
      transactionId: 'abc123',
      transactionType: {
        scenario: 'TRANSFER',
        initiator: 'PAYER',
        initiatorType: 'CONSUMER'
      }
    }

    const transaction = {
      rollback: () => { }
    }
    Sinon.stub(db, 'newTransaction').returns(transaction)
    Sinon.stub(db, 'getParticipant').returns(2)
    Sinon.stub(db, 'getQuoteDuplicateCheck').returns({ hash: 'e31fed1d22e622737fea8f40f60359b374b51ff543d840934b7ee5b5ead22edd' })
    Sinon.stub(db, 'getQuotePartyEndpoint').returns('http://test.com/dfsp2')
    Sinon.stub(quotesModel, 'executeRules').returns([])

    await quotesModel.handleQuoteRequest(headers, quoteRequest, SpanStub)
  })

  test('throw an error if the destination endpoint is not found', async () => {
    // Idiomatic Jest- no `fail` function
    expect.assertions(3)
    try {
      const headers = {
        'fspiop-source': 'dfsp1',
        'fspiop-destination': 'dfsp2'
      }

      const quoteRequest = { }

      Sinon.stub(db, 'getQuotePartyEndpoint').returns(null)

      await quotesModel.forwardQuoteRequest(headers, 'test123', quoteRequest, SpanStub)
    } catch (err) {
      expect(err instanceof ErrorHandler.Factory.FSPIOPError).toBeTruthy()
      expect(err.apiErrorCode.code).toBe(ErrorHandler.Enums.FSPIOPErrorCodes.DESTINATION_FSP_ERROR.code)
      expect(err.message).toBe('No FSPIOP_CALLBACK_URL_QUOTES found for quote test123 PAYEE party')
    }
  })

  test('handle a network communication error forwarding a request', async () => {
    // Idiomatic Jest- no `fail` function
    expect.assertions(3)
    try {
      const headers = {
        'fspiop-source': 'dfsp1',
        'fspiop-destination': 'dfsp2'
      }

      const quoteRequest = { }

      Sinon.stub(db, 'getQuotePartyEndpoint').returns('http://invalid.com/dfsp2')

      await quotesModel.forwardQuoteRequest(headers, 'test123', quoteRequest, SpanStub)
    } catch (err) {
      expect(err instanceof ErrorHandler.Factory.FSPIOPError).toBeTruthy()
      expect(err.apiErrorCode.code).toBe(ErrorHandler.Enums.FSPIOPErrorCodes.DESTINATION_COMMUNICATION_ERROR.code)
      expect(err.message).toBe('Network error forwarding quote request to dfsp2')
    }
  })

  test('handle a network communication error forwarding a request', async () => {
    // Idiomatic Jest- no `fail` function
    expect.assertions(3)
    try {
      const headers = {
        'fspiop-source': 'dfsp1',
        'fspiop-destination': 'dfsp2'
      }

      const quoteRequest = { }

      Sinon.stub(db, 'getQuotePartyEndpoint').returns('http://invalidresponse.com/dfsp2')

      await quotesModel.forwardQuoteRequest(headers, 'test123', quoteRequest, SpanStub)
    } catch (err) {
      expect(err instanceof ErrorHandler.Factory.FSPIOPError).toBeTruthy()
      expect(err.apiErrorCode.code).toBe(ErrorHandler.Enums.FSPIOPErrorCodes.DESTINATION_COMMUNICATION_ERROR.code)
      expect(err.message).toBe('Got non-success response forwarding quote request')
    }
  })
})
