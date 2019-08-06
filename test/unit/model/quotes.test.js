const FSPIOPError = require('@mojaloop/central-services-error-handling').Factory.FSPIOPError
const Test = require('tapes')(require('tape'))
const proxyquire = require('proxyquire')
const Sinon = require('sinon')
const conf = require('../../../config/default')
const Db = require('../../../src/data/database')

Test('QuotesModel should', quotesTest => {
  let quotesModel
  let db

  const QuotesModel = proxyquire('../../../src/model/quotes', {
    'node-fetch': function (url) {
      if (url === 'http://invalid.com/dfsp2/quotes') {
        return Promise.reject(new Error('Unable to reach host'))
      } else if (url === 'http://invalidresponse.com/dfsp2/quotes') {
        return Promise.resolve({ ok: false })
      }
      return Promise.resolve({ ok: true })
    }
  })

  quotesTest.beforeEach(t => {
    db = new Db()
    quotesModel = new QuotesModel({
      db: db,
      requestId: 'test123'
    })

    t.end()
  })

  quotesTest.afterEach(t => {
    t.end()
  })

  quotesTest.test('validate a valid quote request', async test => {
    try {
      await quotesModel.validateQuoteRequest('dfsp1', {
        transactionType: {
          initiator: 'PAYER'
        }
      })
      test.ok(quotesModel)
      test.end()
    } catch (err) {
      test.fail('Error should not be thrown')
      test.end()
    }
  })

  quotesTest.test('throw an FSPIOP error on an invalid request', async test => {
    try {
      await quotesModel.validateQuoteRequest('dfsp1', {
        transactionType: {
          initiator: 'PAYEE'
        }
      })
      test.fail('Expected an error to be thrown')
      test.end()
    } catch (err) {
      test.ok(err instanceof FSPIOPError)
      test.equal(err.apiErrorCode.code, '2000')
      test.equal(err.message, 'Only PAYER initiated transactions are supported')
      test.end()
    }
  })

  quotesTest.test('validate quote update', async test => {
    try {
      await quotesModel.validateQuoteUpdate()
      test.ok(quotesModel)
      test.end()
    } catch (err) {
      test.fail('Error should not be thrown')
      test.end()
    }
  })

  quotesTest.test('handle a quote request', async test => {
    try {
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
      let transaction = { commit: () => { }}
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

      const refs = await quotesModel.handleQuoteRequest(headers, quoteRequest)
      test.ok(refs)
      test.deepEquals(refs, {
        transactionReferenceId: 'abc123',
        transactionInitiatorTypeId: 1,
        transactionInitiatorId: 2,
        transactionScenarioId: 3,
        amountTypeId: 4,
        quoteId: 'test123',
        payerId: 5,
        payeeId: 6
      })
      test.end()
    } catch (err) {
      test.fail('Error should not be thrown')
      test.end()
    }
  })

  quotesTest.test('throw an error on duplicate quote with a different body', async test => {
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

      let transaction = {
        rollback: () => { }
      }
      Sinon.stub(db, 'newTransaction').returns(transaction)
      Sinon.stub(db, 'getQuoteDuplicateCheck').returns({ hash: '85b6067dc6e271c53e2bbc2218e94187022677e80267f95ca28c80707b3009bc' })

      await quotesModel.handleQuoteRequest(headers, quoteRequest)
      test.fail('An error should be thrown')
      test.end()
    } catch (err) {
      test.ok(err instanceof FSPIOPError)
      test.equal(err.apiErrorCode.code, '3106')
      test.equal(err.message, 'Quote test123 is a duplicate but hashes dont match')
      test.end()
    }
  })

  quotesTest.test('handle a quote resend', async test => {
    try {
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

      let transaction = {
        rollback: () => { }
      }
      Sinon.stub(db, 'newTransaction').returns(transaction)
      Sinon.stub(db, 'getQuoteDuplicateCheck').returns({ hash: 'e31fed1d22e622737fea8f40f60359b374b51ff543d840934b7ee5b5ead22edd' })
      Sinon.stub(db, 'getQuotePartyEndpoint').returns('http://test.com/dfsp2')

      await quotesModel.handleQuoteRequest(headers, quoteRequest)
      test.end()
    } catch (err) {
      test.fail('Error should not be thrown')
      test.end()
    }
  })

  quotesTest.test('throw an error if the destination endpoint is not found', async test => {
    try {
      const headers = {
        'fspiop-source': 'dfsp1',
        'fspiop-destination': 'dfsp2'
      }

      const quoteRequest = { }

      Sinon.stub(db, 'getQuotePartyEndpoint').returns(null)

      await quotesModel.forwardQuoteRequest(headers, 'test123', quoteRequest)
      test.fail('Expected an error to be thrown')
      test.end()
    } catch (err) {
      test.ok(err instanceof FSPIOPError)
      test.equal(err.apiErrorCode.code, '3201')
      test.equal(err.message, 'No FSPIOP_CALLBACK_URL_QUOTES found for quote test123 PAYEE party')
      test.end()
    }
  })

  quotesTest.test('handle a network communication error forwarding a request', async test => {
    try {
      const headers = {
        'fspiop-source': 'dfsp1',
        'fspiop-destination': 'dfsp2'
      }

      const quoteRequest = { }

      Sinon.stub(db, 'getQuotePartyEndpoint').returns('http://invalid.com/dfsp2')

      await quotesModel.forwardQuoteRequest(headers, 'test123', quoteRequest)
      test.fail('Expected an error to be thrown')
      test.end()
    } catch (err) {
      test.ok(err instanceof FSPIOPError)
      test.equal(err.apiErrorCode.code, '1001')
      test.equal(err.message, 'Network error forwarding quote request to dfsp2')
      test.end()
    }
  })

  quotesTest.test('handle a network communication error forwarding a request', async test => {
    try {
      const headers = {
        'fspiop-source': 'dfsp1',
        'fspiop-destination': 'dfsp2'
      }

      const quoteRequest = { }

      Sinon.stub(db, 'getQuotePartyEndpoint').returns('http://invalidresponse.com/dfsp2')

      await quotesModel.forwardQuoteRequest(headers, 'test123', quoteRequest)
      test.fail('Expected an error to be thrown')
      test.end()
    } catch (err) {
      test.ok(err instanceof FSPIOPError)
      test.equal(err.apiErrorCode.code, '1001')
      test.equal(err.message, 'Got non-success response forwarding quote request')
      test.end()
    }
  })
  quotesTest.end()
})
