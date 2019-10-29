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

 * Georgi Georgiev <georgi.georgiev@modusbox.com>
 --------------
 ******/
'use strict'

const QuotesModel = require('../../../src/model/quotes')
const ErrorHandler = require('@mojaloop/central-services-error-handling')
const EventSdk = require('@mojaloop/event-sdk')
const Config = require('../../../config/default')
const QuoteRules = require('../../../src/model/rules')
const clone = require('@mojaloop/central-services-shared').Util.clone
const mockAxios = require('axios')

const Db = require('../../../src/data/database')
const mockTransaction = {
  commit: jest.fn(),
  rollback: jest.fn()
}
const mockDb = {
  getParticipant: jest.fn(),
  newTransaction: jest.fn(() => mockTransaction),
  getQuoteDuplicateCheck: jest.fn(),
  createQuoteDuplicateCheck: jest.fn(),
  createTransactionReference: jest.fn(),
  getInitiatorType: jest.fn(),
  getInitiator: jest.fn(),
  getScenario: jest.fn(),
  getAmountType: jest.fn(),
  createQuote: jest.fn(),
  createPayerQuoteParty: jest.fn(),
  createPayeeQuoteParty: jest.fn(),
  getSubScenario: jest.fn(),
  createGeoCode: jest.fn(),
  getParticipantEndpoint: jest.fn(),
  getQuotePartyEndpoint: jest.fn()
}
jest.mock('../../../src/data/database', () => {
  return jest.fn().mockImplementation(() => {
    return {
      getParticipant: mockDb.getParticipant,
      newTransaction: mockDb.newTransaction,
      getQuoteDuplicateCheck: mockDb.getQuoteDuplicateCheck,
      createQuoteDuplicateCheck: mockDb.createQuoteDuplicateCheck,
      createTransactionReference: mockDb.createTransactionReference,
      getInitiatorType: mockDb.getInitiatorType,
      getInitiator: mockDb.getInitiator,
      getScenario: mockDb.getScenario,
      getAmountType: mockDb.getAmountType,
      createQuote: mockDb.createQuote,
      createPayerQuoteParty: mockDb.createPayerQuoteParty,
      createPayeeQuoteParty: mockDb.createPayeeQuoteParty,
      getSubScenario: mockDb.getSubScenario,
      createGeoCode: mockDb.createGeoCode,
      getParticipantEndpoint: mockDb.getParticipantEndpoint,
      getQuotePartyEndpoint: mockDb.getQuotePartyEndpoint
    }
  })
})

const mockChildSpan = {
  injectContextToHttpRequest: jest.fn(opts => opts),
  audit: jest.fn(),
  isFinished: undefined,
  finish: jest.fn()
}
const mockSpan = {
  getChild: jest.fn(() => mockChildSpan),
  error: jest.fn(),
  finish: jest.fn()
}

jest.mock('../../../src/model/rules', () => {
  return {
    getFailures: jest.fn()
  }
})

jest.mock('@mojaloop/central-services-logger', () => {
  return {
    info: jest.fn() // suppress info output
  }
})

jest.mock('axios')
mockAxios.request = (opts) => {
  if (opts.url === 'http://invalid.com/payeefsp/quotes') {
    return Promise.reject(new Error('Unable to reach host'))
  } else if (opts.url === 'http://invalidresponse.com/payeefsp/quotes') {
    return Promise.resolve({ status: 200 })
  }
  return Promise.resolve({ status: 202 })
}

jest.useFakeTimers()
const flushPromises = () => new Promise(setImmediate)

describe('quotesModel', () => {
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
  // TODO: enable for testing QuotesIDPutResponse
  // const quoteUpdate = {
  //   quoteId: 'test123',
  //   transferAmount: {
  //     amount: '100',
  //     currency: 'USD'
  //   },
  //   payeeReceiveAmount: {
  //     amount: '95',
  //     currency: 'USD'
  //   },
  //   payeeFspFee: {
  //     amount: '3',
  //     currency: 'USD'
  //   },
  //   payeeFspCommission: {
  //     amount: '2',
  //     currency: 'USD'
  //   },
  //   expiration: '2019-10-30T10:30:19.899Z',
  //   geoCode: {
  //     latitude: '42.69751',
  //     longitude: '23.32415'
  //   },
  //   ilpPacket: '<ilpPacket>',
  //   condition: 'HOr22-H3AfTDHrSkPjJtVPRdKouuMkDXTR4ejlQa8Ks',
  //   extensionList: {
  //     extension: [{
  //       key: 'key1',
  //       value: 'value1'
  //     }]
  //   }
  // }
  const endpoints = {
    payerfsp: 'http://localhost:8444/payerfsp',
    payeefsp: 'http://localhost:8444/payeefsp',
    invalid: 'http://invalid.com/payeefsp',
    invalidresponse: 'http://invalidresponse.com/payeefsp'
  }
  let quotesModel

  beforeAll(() => {})
  beforeEach(() => {
    quotesModel = new QuotesModel({
      db: new Db(),
      requestId: 'test1234'
    })
    Db.mockClear()
    mockTransaction.commit.mockClear()
    mockTransaction.rollback.mockClear()
    mockDb.getParticipant.mockClear()
    mockDb.newTransaction.mockClear()
    mockDb.getQuoteDuplicateCheck.mockClear()
    mockDb.createQuoteDuplicateCheck.mockClear()
    mockDb.createTransactionReference.mockClear()
    mockDb.getInitiatorType.mockClear()
    mockDb.getInitiator.mockClear()
    mockDb.getScenario.mockClear()
    mockDb.getAmountType.mockClear()
    mockDb.createQuote.mockClear()
    mockDb.createPayerQuoteParty.mockClear()
    mockDb.createPayeeQuoteParty.mockClear()
    mockDb.getSubScenario.mockClear()
    mockDb.createGeoCode.mockClear()
    mockDb.getParticipantEndpoint.mockClear()
    mockDb.getQuotePartyEndpoint.mockClear()
    mockChildSpan.injectContextToHttpRequest.mockClear()
    mockChildSpan.audit.mockClear()
    mockChildSpan.finish.mockClear()
    mockSpan.getChild.mockClear()
    mockSpan.error.mockClear()
    mockSpan.finish.mockClear()
    QuoteRules.getFailures.mockClear()
  })
  afterEach(() => {})
  afterAll(() => {})

  describe('validateQuoteRequest', () => {
    it('should validate fspiopSource and fspiopDestination', async () => {
      expect.assertions(5)
      const fspiopSource = 'dfsp1'
      const fspiopDestination = 'dfsp2'
      const quoteRequest = { quoteId: 'uuid4' }

      expect(quotesModel.db.getParticipant).not.toHaveBeenCalled() // Validates mockClear()

      await quotesModel.validateQuoteRequest(fspiopSource, fspiopDestination, quoteRequest)

      expect(quotesModel.db).toBeTruthy() // Constructor should have been called
      expect(quotesModel.db.getParticipant).toHaveBeenCalledTimes(2)
      expect(quotesModel.db.getParticipant.mock.calls[0][0]).toBe(fspiopSource)
      expect(quotesModel.db.getParticipant.mock.calls[1][0]).toBe(fspiopDestination)
    })
    it('should throw internal error if no quoteRequest was supplied', async () => {
      expect.assertions(5)
      const fspiopSource = 'dfsp1'
      const fspiopDestination = 'dfsp2'
      const quoteRequest = undefined

      expect(quotesModel.db.getParticipant).not.toHaveBeenCalled() // Validates mockClear()

      try {
        await quotesModel.validateQuoteRequest(fspiopSource, fspiopDestination, quoteRequest)
      } catch (err) {
        expect(quotesModel.db).toBeTruthy() // Constructor should have been called
        expect(quotesModel.db.getParticipant).not.toHaveBeenCalled()
        expect(err instanceof ErrorHandler.Factory.FSPIOPError).toBeTruthy()
        expect(err.apiErrorCode.code).toBe(ErrorHandler.Enums.FSPIOPErrorCodes.INTERNAL_SERVER_ERROR.code)
      }
    })
  })

  describe('validateQuoteUpdate', () => {
    it('should validate quote update', async () => {
      const result = await quotesModel.validateQuoteUpdate()
      expect(result).toBeNull()
    })
  })

  describe('handleQuoteRequest', () => {
    it('should forward quote request in simple routing mode', async () => {
      expect.assertions(5)
      Config.SIMPLE_ROUTING_MODE = true
      quotesModel.validateQuoteRequest = jest.fn()
      quotesModel.forwardQuoteRequest = jest.fn()
      mockChildSpan.isFinished = false

      const refs = await quotesModel.handleQuoteRequest(headers, quoteRequest, mockSpan)
      await jest.runAllImmediates()

      let args = [headers['fspiop-source'], headers['fspiop-destination'], quoteRequest]
      expect(quotesModel.validateQuoteRequest).toBeCalledWith(...args)
      expect(mockSpan.getChild.mock.calls.length).toBe(1)
      args = [{ headers, payload: quoteRequest }, EventSdk.AuditEventAction.start]
      expect(mockChildSpan.audit).toBeCalledWith(...args)
      args = [headers, quoteRequest.quoteId, quoteRequest, mockChildSpan]
      expect(quotesModel.forwardQuoteRequest).toBeCalledWith(...args)
      expect(refs).toEqual({})
    })
    it('should handle exception in simple routing mode', async () => {
      expect.assertions(7)
      Config.SIMPLE_ROUTING_MODE = true
      quotesModel.validateQuoteRequest = jest.fn()
      const fspiopError = ErrorHandler.CreateFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.DESTINATION_FSP_ERROR)
      quotesModel.forwardQuoteRequest = jest.fn(() => { throw fspiopError })
      quotesModel.handleException = jest.fn()
      mockChildSpan.isFinished = false

      const refs = await quotesModel.handleQuoteRequest(headers, quoteRequest, mockSpan)
      await jest.runAllImmediates()

      let args = [headers['fspiop-source'], headers['fspiop-destination'], quoteRequest]
      expect(quotesModel.validateQuoteRequest).toBeCalledWith(...args)
      expect(mockSpan.getChild.mock.calls.length).toBe(1)
      args = [{ headers, payload: quoteRequest }, EventSdk.AuditEventAction.start]
      expect(mockChildSpan.audit).toBeCalledWith(...args)
      args = [headers, quoteRequest.quoteId, quoteRequest, mockChildSpan]
      expect(quotesModel.forwardQuoteRequest).toBeCalledWith(...args)
      args = [headers['fspiop-source'], quoteRequest.quoteId, fspiopError, headers, mockChildSpan]
      expect(quotesModel.handleException).toBeCalledWith(...args)
      expect(quotesModel.handleException.mock.calls.length).toBe(1)

      expect(refs).toEqual({})
    })
    it('should throw modified request error when duplicate request is not a resend', async () => {
      expect.assertions(8)
      Config.SIMPLE_ROUTING_MODE = false
      quotesModel.validateQuoteRequest = jest.fn()
      quotesModel.checkDuplicateQuoteRequest = jest.fn(() => { return { isDuplicateId: true, isResend: false } })

      try {
        await quotesModel.handleQuoteRequest(headers, quoteRequest, mockSpan)
      } catch (err) {
        const args = [headers['fspiop-source'], headers['fspiop-destination'], quoteRequest]
        expect(quotesModel.validateQuoteRequest).toBeCalledWith(...args)
        expect(mockDb.newTransaction.mock.calls.length).toBe(1)
        expect(quotesModel.checkDuplicateQuoteRequest).toBeCalledWith(quoteRequest)
        expect(mockTransaction.rollback.mock.calls.length).toBe(1)
        expect(mockSpan.error.mock.calls[0][0]).toEqual(err)
        expect(mockSpan.finish.mock.calls[0][0]).toEqual(err.message)
        expect(err instanceof ErrorHandler.Factory.FSPIOPError).toBeTruthy()
        expect(err.apiErrorCode.code).toBe(ErrorHandler.Enums.FSPIOPErrorCodes.MODIFIED_REQUEST.code)
      }
    })
    it('should handle quote request resend when duplicate request matches original', async () => {
      expect.assertions(5)
      Config.SIMPLE_ROUTING_MODE = false
      quotesModel.validateQuoteRequest = jest.fn()
      quotesModel.checkDuplicateQuoteRequest = jest.fn(() => { return { isDuplicateId: true, isResend: true } })
      quotesModel.handleQuoteRequestResend = jest.fn(() => 'handleQuoteRequestResendResult')

      const refs = await quotesModel.handleQuoteRequest(headers, quoteRequest, mockSpan)

      let args = [headers['fspiop-source'], headers['fspiop-destination'], quoteRequest]
      expect(quotesModel.validateQuoteRequest).toBeCalledWith(...args)
      expect(mockDb.newTransaction.mock.calls.length).toBe(1)
      expect(quotesModel.checkDuplicateQuoteRequest).toBeCalledWith(quoteRequest)
      args = [headers, quoteRequest, mockSpan]
      expect(quotesModel.handleQuoteRequestResend).toBeCalledWith(...args)
      expect(refs).toBe('handleQuoteRequestResendResult')
    })
    it('should store to db and forward quote request when switch mode', async () => {
      expect.assertions(12)
      Config.SIMPLE_ROUTING_MODE = false
      quotesModel.validateQuoteRequest = jest.fn()
      quotesModel.checkDuplicateQuoteRequest = jest.fn(() => { return { isDuplicateId: false, isResend: false } })
      quotesModel.calculateRequestHash = jest.fn(() => 'hash')
      const expected = {
        transactionReferenceId: 'txRef',
        transactionInitiatorTypeId: 'initiatorType',
        transactionInitiatorId: 'initiator',
        transactionScenarioId: 'scenario',
        amountTypeId: 'amountTypeId',
        quoteId: quoteRequest.quoteId,
        payerId: quoteRequest.payer.partyIdInfo.fspId,
        payeeId: quoteRequest.payee.partyIdInfo.fspId
      }
      mockDb.createTransactionReference.mockReturnValueOnce(expected.transactionReferenceId)
      mockDb.getInitiatorType.mockReturnValueOnce(expected.transactionInitiatorTypeId)
      mockDb.getInitiator.mockReturnValueOnce(expected.transactionInitiatorId)
      mockDb.getScenario.mockReturnValueOnce(expected.transactionScenarioId)
      mockDb.getAmountType.mockReturnValueOnce(expected.amountTypeId)
      mockDb.createQuote.mockReturnValueOnce(expected.quoteId)
      mockDb.createPayerQuoteParty.mockReturnValueOnce(expected.payerId)
      mockDb.createPayeeQuoteParty.mockReturnValueOnce(expected.payeeId)

      QuoteRules.getFailures = jest.fn(() => [1, 2, 3])
      quotesModel.forwardQuoteRequest = jest.fn()
      mockChildSpan.isFinished = true

      const refs = await quotesModel.handleQuoteRequest(headers, quoteRequest, mockSpan)
      await jest.runAllImmediates()

      let args = [headers['fspiop-source'], headers['fspiop-destination'], quoteRequest]
      expect(quotesModel.validateQuoteRequest).toBeCalledWith(...args)
      expect(mockDb.newTransaction.mock.calls.length).toBe(1)
      expect(quotesModel.checkDuplicateQuoteRequest).toBeCalledWith(quoteRequest)
      expect(mockTransaction.rollback.mock.calls.length).toBe(0)
      expect(mockTransaction.commit.mock.calls.length).toBe(1)
      expect(QuoteRules.getFailures.mock.calls.length).toBe(1)
      expect(QuoteRules.getFailures.mock.results[0].value.length).toBeGreaterThan(0)
      expect(mockSpan.getChild.mock.calls.length).toBe(1)
      args = [{ headers, payload: refs }, EventSdk.AuditEventAction.start]
      expect(mockChildSpan.audit).toBeCalledWith(...args)
      args = [headers, refs.quoteId, quoteRequest, mockChildSpan]
      expect(quotesModel.forwardQuoteRequest).toBeCalledWith(...args)
      expect(mockChildSpan.finish).not.toBeCalled()
      expect(refs).toMatchObject(expected)
    })
    it('should store to db and forward quote request when switch mode and PAYEE is initiator', async () => {
      expect.assertions(11)
      Config.SIMPLE_ROUTING_MODE = false

      const localQuoteRequest = clone(quoteRequest)
      localQuoteRequest.transactionType.initiator = 'PAYEE'
      localQuoteRequest.geoCode = 'geoCodeId'
      quotesModel.validateQuoteRequest = jest.fn()
      quotesModel.checkDuplicateQuoteRequest = jest.fn(() => { return { isDuplicateId: false, isResend: false } })
      quotesModel.calculateRequestHash = jest.fn(() => 'hash')

      quotesModel.forwardQuoteRequest = jest.fn()
      mockChildSpan.isFinished = true

      const refs = await quotesModel.handleQuoteRequest(headers, localQuoteRequest, mockSpan)
      await jest.runAllImmediates()

      let args = [headers['fspiop-source'], headers['fspiop-destination'], localQuoteRequest]
      expect(quotesModel.validateQuoteRequest).toBeCalledWith(...args)
      expect(mockDb.newTransaction.mock.calls.length).toBe(1)
      expect(quotesModel.checkDuplicateQuoteRequest).toBeCalledWith(localQuoteRequest)
      expect(mockTransaction.rollback.mock.calls.length).toBe(0)
      expect(mockTransaction.commit.mock.calls.length).toBe(1)
      expect(QuoteRules.getFailures.mock.calls.length).toBe(1)
      expect(mockSpan.getChild.mock.calls.length).toBe(1)
      args = [{ headers, payload: refs }, EventSdk.AuditEventAction.start]
      expect(mockChildSpan.audit).toBeCalledWith(...args)
      args = [headers, refs.quoteId, localQuoteRequest, mockChildSpan]
      expect(quotesModel.forwardQuoteRequest).toBeCalledWith(...args)
      expect(mockChildSpan.finish).not.toBeCalled()
      expect(refs).toEqual({})
    })
    it('should store to db and handle exception when forward quote request fails in switch mode', async () => {
      expect.assertions(12)
      Config.SIMPLE_ROUTING_MODE = false

      const localQuoteRequest = clone(quoteRequest)
      localQuoteRequest.transactionType.subScenario = 'subScenario'
      localQuoteRequest.expiration = new Date()
      localQuoteRequest.transactionType.balanceOfPayments = 'balanceOfPayments'
      localQuoteRequest.geoCode = 'geoCodeId'
      quotesModel.validateQuoteRequest = jest.fn()
      quotesModel.checkDuplicateQuoteRequest = jest.fn(() => { return { isDuplicateId: false, isResend: false } })
      quotesModel.calculateRequestHash = jest.fn(() => 'hash')
      const expected = {
        transactionReferenceId: 'txRef',
        transactionInitiatorTypeId: 'initiatorType',
        transactionInitiatorId: 'initiator',
        transactionScenarioId: 'scenario',
        amountTypeId: 'amountTypeId',
        quoteId: localQuoteRequest.quoteId,
        payerId: localQuoteRequest.payer.partyIdInfo.fspId,
        payeeId: localQuoteRequest.payee.partyIdInfo.fspId,
        transactionSubScenarioId: localQuoteRequest.transactionType.subScenario,
        geoCodeId: localQuoteRequest.geoCode
      }
      mockDb.createTransactionReference.mockReturnValueOnce(expected.transactionReferenceId)
      mockDb.getInitiatorType.mockReturnValueOnce(expected.transactionInitiatorTypeId)
      mockDb.getInitiator.mockReturnValueOnce(expected.transactionInitiatorId)
      mockDb.getScenario.mockReturnValueOnce(expected.transactionScenarioId)
      mockDb.getAmountType.mockReturnValueOnce(expected.amountTypeId)
      mockDb.createQuote.mockReturnValueOnce(expected.quoteId)
      mockDb.createPayerQuoteParty.mockReturnValueOnce(expected.payerId)
      mockDb.createPayeeQuoteParty.mockReturnValueOnce(expected.payeeId)
      mockDb.createPayeeQuoteParty.mockReturnValueOnce(expected.payeeId)
      mockDb.getSubScenario.mockReturnValueOnce(expected.transactionSubScenarioId)
      mockDb.createGeoCode.mockReturnValueOnce(expected.geoCodeId)

      QuoteRules.getFailures = jest.fn()
      const customError = new Error('Custom error')
      delete customError.stack
      quotesModel.forwardQuoteRequest = jest.fn(() => { throw customError })
      quotesModel.handleException = jest.fn()
      mockChildSpan.isFinished = false

      const refs = await quotesModel.handleQuoteRequest(headers, localQuoteRequest, mockSpan)
      await jest.runAllImmediates()

      let args = [headers['fspiop-source'], headers['fspiop-destination'], localQuoteRequest]
      expect(quotesModel.validateQuoteRequest).toBeCalledWith(...args)
      expect(mockDb.newTransaction.mock.calls.length).toBe(1)
      expect(quotesModel.checkDuplicateQuoteRequest).toBeCalledWith(localQuoteRequest)
      expect(mockTransaction.rollback.mock.calls.length).toBe(0)
      expect(mockTransaction.commit.mock.calls.length).toBe(1)
      expect(QuoteRules.getFailures.mock.results[0].value).toBe(undefined)
      expect(mockSpan.getChild.mock.calls.length).toBe(1)
      args = [{ headers, payload: refs }, EventSdk.AuditEventAction.start]
      expect(mockChildSpan.audit).toBeCalledWith(...args)
      args = [headers, refs.quoteId, localQuoteRequest, mockChildSpan]
      expect(quotesModel.forwardQuoteRequest).toBeCalledWith(...args)
      args = [headers['fspiop-source'], refs.quoteId, customError, headers, mockChildSpan]
      expect(quotesModel.handleException).toBeCalledWith(...args)

      await jest.runAllImmediates()
      expect(mockChildSpan.finish).toBeCalled()
      expect(refs).toMatchObject(expected)
    })
    it('should throw internal error when validation fails', async () => {
      expect.assertions(4)
      const customErrorNoStack = new Error('Custom error')
      delete customErrorNoStack.stack
      quotesModel.validateQuoteRequest = jest.fn(() => { throw customErrorNoStack })

      try {
        await quotesModel.handleQuoteRequest(headers, quoteRequest)
      } catch (err) {
        const args = [headers['fspiop-source'], headers['fspiop-destination'], quoteRequest]
        expect(quotesModel.validateQuoteRequest).toBeCalledWith(...args)
        expect(mockTransaction.rollback.mock.calls.length).toBe(0)
        expect(err instanceof ErrorHandler.Factory.FSPIOPError).toBeTruthy()
        expect(err.apiErrorCode.code).toBe(ErrorHandler.Enums.FSPIOPErrorCodes.INTERNAL_SERVER_ERROR.code)
      }
    })
  })

  describe('forwardQuoteRequest', () => {
    it('should get http status code 202 Accepted in simple routing mode', async () => {
      expect.assertions(3)
      Config.SIMPLE_ROUTING_MODE = true
      mockDb.getParticipantEndpoint.mockReturnValueOnce(endpoints.payeefsp)

      let err
      try {
        await quotesModel.forwardQuoteRequest(headers, quoteRequest.quoteId, quoteRequest, mockChildSpan)
      } catch (e) {
        err = e
      }
      expect(err).toBe(undefined)
      expect(mockDb.getParticipantEndpoint).toBeCalled()
      expect(mockDb.getQuotePartyEndpoint).not.toBeCalled()
    })
    it('should get http status code 202 Accepted in switch mode', async () => {
      expect.assertions(3)
      Config.SIMPLE_ROUTING_MODE = false
      mockDb.getQuotePartyEndpoint.mockReturnValueOnce(endpoints.payeefsp)

      let err
      try {
        await quotesModel.forwardQuoteRequest(headers, quoteRequest.quoteId, quoteRequest, mockChildSpan)
      } catch (e) {
        err = e
      }
      expect(err).toBe(undefined)
      expect(mockDb.getParticipantEndpoint).not.toBeCalled()
      expect(mockDb.getQuotePartyEndpoint).toBeCalled()
    })
    it('should throw when quoteRequest is undefined', async () => {
      expect.assertions(2)
      try {
        const originalQuoteRequest = undefined
        await quotesModel.forwardQuoteRequest(headers, quoteRequest.quoteId, originalQuoteRequest, mockChildSpan)
      } catch (err) {
        expect(err instanceof ErrorHandler.Factory.FSPIOPError).toBeTruthy()
        expect(err.apiErrorCode.code).toBe(ErrorHandler.Enums.FSPIOPErrorCodes.INTERNAL_SERVER_ERROR.code)
      }
    })
    it('should throw when participant endpoint is not found', async () => {
      expect.assertions(2)
      Config.SIMPLE_ROUTING_MODE = false
      const endpoint = undefined
      mockDb.getQuotePartyEndpoint.mockReturnValueOnce(endpoint)
      try {
        await quotesModel.forwardQuoteRequest(headers, quoteRequest.quoteId, quoteRequest, mockChildSpan)
      } catch (err) {
        expect(err instanceof ErrorHandler.Factory.FSPIOPError).toBeTruthy()
        expect(err.apiErrorCode.code).toBe(ErrorHandler.Enums.FSPIOPErrorCodes.DESTINATION_FSP_ERROR.code)
      }
    })
    it('should not use spans when undefined and should throw when participant endpoint is invalid', async () => {
      expect.assertions(4)
      Config.SIMPLE_ROUTING_MODE = false
      mockDb.getQuotePartyEndpoint.mockReturnValueOnce(endpoints.invalid)
      try {
        await quotesModel.forwardQuoteRequest(headers, quoteRequest.quoteId, quoteRequest)
      } catch (err) {
        expect(mockChildSpan.injectContextToHttpRequest).not.toHaveBeenCalled()
        expect(mockChildSpan.audit).not.toHaveBeenCalled()
        expect(err instanceof ErrorHandler.Factory.FSPIOPError).toBeTruthy()
        expect(err.apiErrorCode.code).toBe(ErrorHandler.Enums.FSPIOPErrorCodes.DESTINATION_COMMUNICATION_ERROR.code)
      }
    })
    it('should throw when participant endpoint returns invalid response', async () => {
      expect.assertions(4)
      Config.SIMPLE_ROUTING_MODE = false
      mockDb.getQuotePartyEndpoint.mockReturnValueOnce(endpoints.invalidresponse)
      try {
        await quotesModel.forwardQuoteRequest(headers, quoteRequest.quoteId, quoteRequest)
      } catch (err) {
        expect(mockChildSpan.injectContextToHttpRequest).not.toHaveBeenCalled()
        expect(mockChildSpan.audit).not.toHaveBeenCalled()
        expect(err instanceof ErrorHandler.Factory.FSPIOPError).toBeTruthy()
        expect(err.apiErrorCode.code).toBe(ErrorHandler.Enums.FSPIOPErrorCodes.DESTINATION_COMMUNICATION_ERROR.code)
      }
    })
    it('should inspect and throw custom error as FSPIOPerror', async () => {
      expect.assertions(4)
      Config.SIMPLE_ROUTING_MODE = false
      const customErrorNoStack = new Error('Custom error')
      delete customErrorNoStack.stack
      mockDb.getQuotePartyEndpoint.mockRejectedValueOnce(customErrorNoStack)
      try {
        await quotesModel.forwardQuoteRequest(headers, quoteRequest.quoteId, quoteRequest)
      } catch (err) {
        expect(mockChildSpan.injectContextToHttpRequest).not.toHaveBeenCalled()
        expect(mockChildSpan.audit).not.toHaveBeenCalled()
        expect(err instanceof ErrorHandler.Factory.FSPIOPError).toBeTruthy()
        expect(err.apiErrorCode.code).toBe(ErrorHandler.Enums.FSPIOPErrorCodes.INTERNAL_SERVER_ERROR.code)
      }
    })
  })

  describe('handleQuoteRequestResend', () => {
    it('forward quote request', async () => {
      expect.assertions(5)
      mockChildSpan.isFinished = false
      quotesModel.forwardQuoteRequest = jest.fn()

      let err
      try {
        await quotesModel.handleQuoteRequestResend(headers, quoteRequest, mockSpan)
        await jest.runAllImmediates()
        await flushPromises()
      } catch (e) {
        err = e
      }
      expect(err).toBe(undefined)
      expect(mockSpan.getChild).toBeCalled()
      expect(mockChildSpan.audit).toBeCalled()
      const args = [headers, quoteRequest.quoteId, quoteRequest, mockChildSpan]
      expect(quotesModel.forwardQuoteRequest).toBeCalledWith(...args)
      expect(mockChildSpan.finish).toBeCalled()
    })
    it('handle fspiopError when forward quote fails', async () => {
      expect.assertions(4)
      mockChildSpan.isFinished = true
      const fspiopError = ErrorHandler.CreateFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.DESTINATION_FSP_ERROR)
      quotesModel.forwardQuoteRequest = jest.fn(() => { throw fspiopError })
      quotesModel.handleException = jest.fn()

      let err
      try {
        await quotesModel.handleQuoteRequestResend(headers, quoteRequest, mockSpan)
        await jest.runAllImmediates()
      } catch (e) {
        err = e
      }
      expect(err).toBe(undefined)
      expect(mockChildSpan.audit).toBeCalled()
      const args = [headers['fspiop-source'], quoteRequest.quoteId, fspiopError, headers, mockChildSpan]
      expect(quotesModel.handleException).toBeCalledWith(...args)
      expect(mockChildSpan.finish).not.toBeCalled()
    })
    it('handle custom error without stack when forward quote fails', async () => {
      expect.assertions(4)
      const customErrorNoStack = new Error('Custom error')
      delete customErrorNoStack.stack
      quotesModel.forwardQuoteRequest = jest.fn(() => { throw customErrorNoStack })
      quotesModel.handleException = jest.fn()

      let err
      try {
        await quotesModel.handleQuoteRequestResend(headers, quoteRequest, mockSpan)
        await jest.runAllImmediates()
      } catch (e) {
        err = e
      }
      expect(err).toBe(undefined)
      expect(mockChildSpan.audit).toBeCalled()
      const args = [headers['fspiop-source'], quoteRequest.quoteId, customErrorNoStack, headers, mockChildSpan]
      expect(quotesModel.handleException).toBeCalledWith(...args)
      expect(mockChildSpan.finish).not.toBeCalled()
    })
    it('handle custom error without stack when writeLog fails', async () => {
      expect.assertions(1)
      const errorMessage = 'Custom error'
      const customErrorNoStack = new Error(errorMessage)
      delete customErrorNoStack.stack
      quotesModel.writeLog = jest.fn(() => { throw customErrorNoStack })

      try {
        await quotesModel.handleQuoteRequestResend(headers, quoteRequest, mockSpan)
      } catch (err) {
        expect(err.message).toBe(errorMessage)
      }
    })
    it('handle custom error without stack when writeLog fails', async () => {
      expect.assertions(2)
      const fspiopError = ErrorHandler.CreateFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.INTERNAL_SERVER_ERROR)
      quotesModel.writeLog = jest.fn().mockImplementationOnce(cb => cb(fspiopError))

      try {
        await quotesModel.handleQuoteRequestResend(headers, quoteRequest, mockSpan)
      } catch (err) {
        expect(err instanceof ErrorHandler.Factory.FSPIOPError).toBeTruthy()
        expect(err.apiErrorCode.code).toBe(ErrorHandler.Enums.FSPIOPErrorCodes.INTERNAL_SERVER_ERROR.code)
      }
    })
  })
})
