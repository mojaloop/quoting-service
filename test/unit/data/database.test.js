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

 * Crosslake
 - Lewis Daly <lewisd@crosslaketech.com>
 --------------
******/

jest.mock('knex')
jest.mock('@mojaloop/central-services-logger')

const Knex = require('knex')
const crypto = require('crypto')
const ENUM = require('@mojaloop/central-services-shared').Enum

const Database = require('../../../src/data/database')
const Config = require('../../../src/lib/config')
const LibEnum = require('../../../src/lib/enum')
const Logger = require('@mojaloop/central-services-logger')

Logger.isDebugEnabled = jest.fn(() => true)
Logger.isErrorEnabled = jest.fn(() => true)
Logger.isInfoEnabled = jest.fn(() => true)

/**
 * @function mockKnexBuilder
 * @description Stubs out a set of Knex calls in order
 * @param {Jest.Mock} rootMock - the root jest mock object to apply the mocks to
 * @param {*} returnValue - the final object to be returned
 * @param {*} methodList - the list of querybuilder methods that will be called
 */
const mockKnexBuilder = (rootMock, returnValue, methodList) => {
  const jestMocks = []

  const firstMock = methodList.reduceRight((acc, curr, idx) => {
    jestMocks.push(acc)
    const thisReturnValue = {}
    thisReturnValue[curr] = acc

    if (idx === 0) {
      return rootMock.mockReturnValueOnce(thisReturnValue)
    }
    return jest.fn().mockReturnValueOnce(thisReturnValue)
  }, jest.fn().mockReturnValueOnce(returnValue))

  // Make sure we catch the last one
  jestMocks.push(firstMock)

  // Ensure the mock order matches the called order
  return jestMocks.reverse()
}

describe('/database', () => {
  // Mock knex object for raw queries
  const mockKnex = {
    transaction: jest.fn(),
    raw: jest.fn()
  }

  let database

  describe('raw queries', () => {
    const config = {}

    beforeEach(async () => {
      jest.clearAllMocks()

      // Return the mockKnex we defined above.
      // For individual tests, simply call mockKnex.<method>.mockImplementation
      Knex.mockImplementation(() => mockKnex)
      database = new Database(config)
      await database.connect()
    })

    it('connects to knex', async () => {
      expect(database.config).toStrictEqual(config)
      expect(database.queryBuilder).not.toBeUndefined()
    })

    describe('transaction', () => {
      it('should resolve with a transaction', async () => {
        const mockTransaction = {}
        const queryBuilder = { transaction: jest.fn() }
        queryBuilder.transaction.mockImplementation((callback) => {
          callback(mockTransaction)
        })
        const database = new Database(config, Logger, queryBuilder)

        const result = await database.newTransaction()

        expect(result).toBe(mockTransaction)
        expect(queryBuilder.transaction).toHaveBeenCalled()
      })

      it('should reject with an error', async () => {
        const mockError = new Error('Transaction error')
        const queryBuilder = { transaction: jest.fn() }
        const mockTransaction = {}
        queryBuilder.transaction.mockImplementation((callback) => {
          callback(mockTransaction)
        })
        const database = new Database(config, Logger, queryBuilder)

        queryBuilder.transaction.mockImplementation(() => {
          throw mockError
        })

        await expect(database.newTransaction()).rejects.toThrow('Transaction error')
        expect(queryBuilder.transaction).toHaveBeenCalled()
      })
    })

    describe('isConnected', () => {
      it('returns true when connected', async () => {
        // Arrange
        mockKnex.raw.mockReturnValueOnce(true)

        // Act
        const result = await database.isConnected()

        // Assert
        expect(result).toBe(true)
        expect(mockKnex.raw).toHaveBeenCalledWith('SELECT 1 + 1 AS result')
      })

      it('returns false on invalid or missing result', async () => {
        // Arrange
        mockKnex.raw.mockReturnValueOnce(undefined)

        // Act
        const result = await database.isConnected()

        // Assert
        expect(result).toBe(false)
      })

      it('returns false when queryBuilder throws an error', async () => {
        // Arrange
        mockKnex.raw.mockImplementationOnce(() => { throw new Error('Test Error') })

        // Act
        const result = await database.isConnected()

        // Assert
        expect(result).toBe(false)
      })
    })
  })

  describe('queryBuilder queries', () => {
    // Mock knex object for queryBuilder queries
    const mockKnex = jest.fn()

    beforeEach(async () => {
      jest.clearAllMocks()
      const defaultConfig = new Config()

      // Return the mockKnex we defined above.
      // For individual tests, simply call mockKnex.<methodName>.mockImplementation
      Knex.mockImplementation(() => mockKnex)

      database = new Database(defaultConfig)
      await database.connect()
    })

    describe('getInitiatorType', () => {
      it('gets the initiator', async () => {
        // Arrange
        const initiatorType = 'testInitiatorType'
        const mockList = mockKnexBuilder(
          mockKnex,
          [{ transactionInitiatorTypeId: 123 }],
          ['where', 'select']
        )

        // Act
        const result = await database.getInitiatorType(initiatorType)

        // Assert
        expect(result).toStrictEqual(123)
        expect(mockList[0]).toHaveBeenCalledWith('transactionInitiatorType')
        expect(mockList[1]).toHaveBeenCalledWith('name', initiatorType)
        expect(mockList[2]).toHaveBeenCalledTimes(1)
      })

      it('handles the case where rows is undefined', async () => {
        // Arrange
        const initiatorType = 'testInitiatorType'
        mockKnexBuilder(
          mockKnex,
          undefined,
          ['where', 'select']
        )

        // Act
        const action = async () => database.getInitiatorType(initiatorType)

        // Assert
        await expect(action()).rejects.toThrowError('Unsupported initiatorType \'testInitiatorType\'')
      })

      it('handles the case where rows is empty', async () => {
        // Arrange
        const initiatorType = 'testInitiatorType'
        mockKnexBuilder(
          mockKnex,
          [],
          ['where', 'select']
        )

        // Act
        const action = async () => database.getInitiatorType(initiatorType)

        // Assert
        await expect(action()).rejects.toThrowError('Unsupported initiatorType \'testInitiatorType\'')
      })

      it('handles an exception', async () => {
        // Arrange
        const initiatorType = 'testInitiatorType'
        mockKnex.mockImplementationOnce(() => { throw new Error('Test Error') })

        // Act
        const action = async () => database.getInitiatorType(initiatorType)

        // Assert
        await expect(action()).rejects.toThrowError('Test Error')
      })
    })

    describe('getInitiator', () => {
      it('gets the initiator', async () => {
        // Arrange
        const initiator = 'testInitiator'
        const mockList = mockKnexBuilder(
          mockKnex,
          [{ transactionInitiatorId: 123 }],
          ['where', 'select']
        )

        // Act
        const result = await database.getInitiator(initiator)

        // Assert
        expect(result).toStrictEqual(123)
        expect(mockList[0]).toHaveBeenCalledWith('transactionInitiator')
        expect(mockList[1]).toHaveBeenCalledWith('name', initiator)
        expect(mockList[2]).toHaveBeenCalledTimes(1)
      })

      it('handles the case where rows is undefined', async () => {
        // Arrange
        const initiator = 'testInitiator'
        mockKnexBuilder(
          mockKnex,
          undefined,
          ['where', 'select']
        )

        // Act
        const action = async () => database.getInitiator(initiator)

        // Assert
        await expect(action()).rejects.toThrowError('Unsupported initiator \'testInitiator\'')
      })

      it('handles the case where rows is empty', async () => {
        // Arrange
        const initiator = 'testInitiator'
        mockKnexBuilder(
          mockKnex,
          [],
          ['where', 'select']
        )

        // Act
        const action = async () => database.getInitiator(initiator)

        // Assert
        await expect(action()).rejects.toThrowError('Unsupported initiator \'testInitiator\'')
      })

      it('handles an exception', async () => {
        // Arrange
        const initiator = 'testInitiator'
        mockKnex.mockImplementationOnce(() => { throw new Error('Test Error') })

        // Act
        const action = async () => database.getInitiator(initiator)

        // Assert
        await expect(action()).rejects.toThrowError('Test Error')
      })
    })

    describe('getScenario', () => {
      it('gets the scenario', async () => {
        // Arrange
        const scenario = 'testScenario'
        const mockList = mockKnexBuilder(
          mockKnex,
          [{ transactionScenarioId: 123 }],
          ['where', 'select']
        )

        // Act
        const result = await database.getScenario(scenario)

        // Assert
        expect(result).toStrictEqual(123)
        expect(mockList[0]).toHaveBeenCalledWith('transactionScenario')
        expect(mockList[1]).toHaveBeenCalledWith('name', scenario)
        expect(mockList[2]).toHaveBeenCalledTimes(1)
      })

      it('handles the case where rows is undefined', async () => {
        // Arrange
        const scenario = 'testScenario'
        mockKnexBuilder(
          mockKnex,
          undefined,
          ['where', 'select']
        )

        // Act
        const action = async () => database.getScenario(scenario)

        // Assert
        await expect(action()).rejects.toThrowError('Unsupported transaction scenario \'testScenario\'')
      })

      it('handles the case where rows is empty', async () => {
        // Arrange
        const scenario = 'testScenario'
        mockKnexBuilder(
          mockKnex,
          [],
          ['where', 'select']
        )

        // Act
        const action = async () => database.getScenario(scenario)

        // Assert
        await expect(action()).rejects.toThrowError('Unsupported transaction scenario \'testScenario\'')
      })

      it('handles an exception', async () => {
        // Arrange
        const scenario = 'testScenario'
        mockKnex.mockImplementationOnce(() => { throw new Error('Test Error') })

        // Act
        const action = async () => database.getScenario(scenario)

        // Assert
        await expect(action()).rejects.toThrowError('Test Error')
      })
    })

    describe('getSubScenario', () => {
      it('gets the subScenario', async () => {
        // Arrange
        const subScenario = 'testSubScenario'
        const mockList = mockKnexBuilder(
          mockKnex,
          [{ transactionSubScenarioId: 123 }],
          ['where', 'select']
        )

        // Act
        const result = await database.getSubScenario(subScenario)

        // Assert
        expect(result).toStrictEqual(123)
        expect(mockList[0]).toHaveBeenCalledWith('transactionSubScenario')
        expect(mockList[1]).toHaveBeenCalledWith('name', subScenario)
        expect(mockList[2]).toHaveBeenCalledTimes(1)
      })

      it('handles the case where rows is undefined', async () => {
        // Arrange
        const subScenario = 'testSubScenario'
        mockKnexBuilder(
          mockKnex,
          undefined,
          ['where', 'select']
        )

        // Act
        const action = async () => database.getSubScenario(subScenario)

        // Assert
        await expect(action()).rejects.toThrowError('Unsupported transaction sub-scenario \'testSubScenario\'')
      })

      it('handles the case where rows is empty', async () => {
        // Arrange
        const subScenario = 'testSubScenario'
        mockKnexBuilder(
          mockKnex,
          [],
          ['where', 'select']
        )

        // Act
        const action = async () => database.getSubScenario(subScenario)

        // Assert
        await expect(action()).rejects.toThrowError('Unsupported transaction sub-scenario \'testSubScenario\'')
      })

      it('handles an exception', async () => {
        // Arrange
        const subScenario = 'testSubScenario'
        mockKnex.mockImplementationOnce(() => { throw new Error('Test Error') })

        // Act
        const action = async () => database.getSubScenario(subScenario)

        // Assert
        await expect(action()).rejects.toThrowError('Test Error')
      })
    })

    describe('getAmountType', () => {
      it('gets the amountType', async () => {
        // Arrange
        const amountType = 'testAmountType'
        const mockList = mockKnexBuilder(
          mockKnex,
          [{ amountTypeId: 123 }],
          ['where', 'select']
        )

        // Act
        const result = await database.getAmountType(amountType)

        // Assert
        expect(result).toStrictEqual(123)
        expect(mockList[0]).toHaveBeenCalledWith('amountType')
        expect(mockList[1]).toHaveBeenCalledWith('name', amountType)
        expect(mockList[2]).toHaveBeenCalledTimes(1)
      })

      it('handles the case where rows is undefined', async () => {
        // Arrange
        const amountType = 'testAmountType'
        mockKnexBuilder(
          mockKnex,
          undefined,
          ['where', 'select']
        )

        // Act
        const action = async () => database.getAmountType(amountType)

        // Assert
        await expect(action()).rejects.toThrowError('Unsupported amount type \'testAmountType\'')
      })

      it('handles the case where rows is empty', async () => {
        // Arrange
        const amountType = 'testAmountType'
        mockKnexBuilder(
          mockKnex,
          [],
          ['where', 'select']
        )

        // Act
        const action = async () => database.getAmountType(amountType)

        // Assert
        await expect(action()).rejects.toThrowError('Unsupported amount type \'testAmountType\'')
      })

      it('handles an exception', async () => {
        // Arrange
        const amountType = 'testAmountType'
        mockKnex.mockImplementationOnce(() => { throw new Error('Test Error') })

        // Act
        const action = async () => database.getAmountType(amountType)

        // Assert
        await expect(action()).rejects.toThrowError('Test Error')
      })
    })

    describe('createTransactionReference', () => {
      it('creates a transactionReference', async () => {
        // Arrange
        const txn = jest.fn()
        const quoteId = 'ddaa67b3-5bf8-45c1-bfcf-1e8781177c37'
        const transactionReferenceId = '12345'
        const mockList = mockKnexBuilder(
          mockKnex,
          null,
          ['transacting', 'insert']
        )

        // Act
        const result = await database.createTransactionReference(txn, quoteId, transactionReferenceId)

        // Assert
        expect(result).toBe(transactionReferenceId)
        expect(mockList[0]).toHaveBeenCalledWith('transactionReference')
        expect(mockList[1]).toHaveBeenCalledWith(txn)
        expect(mockList[2]).toHaveBeenCalledWith({
          quoteId,
          transactionReferenceId
        })
      })

      it('handles an exception', async () => {
        // Arrange
        const txn = jest.fn()
        const quoteId = 'ddaa67b3-5bf8-45c1-bfcf-1e8781177c37'
        const transactionReferenceId = '12345'
        mockKnex.mockImplementationOnce(() => { throw new Error('Test Error') })

        // Act
        const action = async () => database.createTransactionReference(txn, quoteId, transactionReferenceId)

        // Assert
        await expect(action()).rejects.toThrowError('Test Error')
      })
    })

    describe('createQuoteDuplicateCheck', () => {
      it('creates a quoteDuplicateCheck', async () => {
        // Arrange
        const txn = jest.fn()
        const quoteId = 'ddaa67b3-5bf8-45c1-bfcf-1e8781177c37'
        const hash = crypto.createHash('sha256').update(quoteId).digest('hex')
        const mockList = mockKnexBuilder(
          mockKnex,
          null,
          ['transacting', 'insert']
        )

        // Act
        const result = await database.createQuoteDuplicateCheck(txn, quoteId, hash)

        // Assert
        expect(result).toBe(quoteId)
        expect(mockList[0]).toHaveBeenCalledWith('quoteDuplicateCheck')
        expect(mockList[1]).toHaveBeenCalledWith(txn)
        expect(mockList[2]).toHaveBeenCalledWith({
          quoteId,
          hash
        })
      })

      it('handles an exception', async () => {
        // Arrange
        const txn = jest.fn()
        const quoteId = 'ddaa67b3-5bf8-45c1-bfcf-1e8781177c37'
        const hash = crypto.createHash('sha256').update(quoteId).digest('hex')
        mockKnex.mockImplementationOnce(() => { throw new Error('Test Error') })

        // Act
        const action = async () => database.createQuoteDuplicateCheck(txn, quoteId, hash)

        // Assert
        await expect(action()).rejects.toThrowError('Test Error')
      })
    })

    describe('createQuoteUpdateDuplicateCheck', () => {
      it('creates a quoteUpdateDuplicateCheck', async () => {
        // Arrange
        const txn = jest.fn()
        const quoteId = 'ddaa67b3-5bf8-45c1-bfcf-1e8781177c37'
        const quoteResponseId = '12345'
        const hash = crypto.createHash('sha256').update(quoteId).digest('hex')
        const mockList = mockKnexBuilder(
          mockKnex,
          null,
          ['transacting', 'insert']
        )

        // Act
        const result = await database.createQuoteUpdateDuplicateCheck(txn, quoteId, quoteResponseId, hash)

        // Assert
        expect(result).toBe(quoteId)
        expect(mockList[0]).toHaveBeenCalledWith('quoteResponseDuplicateCheck')
        expect(mockList[1]).toHaveBeenCalledWith(txn)
        expect(mockList[2]).toHaveBeenCalledWith({
          quoteId,
          quoteResponseId,
          hash
        })
      })

      it('handles an exception', async () => {
        // Arrange
        const txn = jest.fn()
        const quoteId = 'ddaa67b3-5bf8-45c1-bfcf-1e8781177c37'
        const quoteResponseId = '12345'
        const hash = crypto.createHash('sha256').update(quoteId).digest('hex')
        mockKnex.mockImplementationOnce(() => { throw new Error('Test Error') })

        // Act
        const action = async () => database.createQuoteUpdateDuplicateCheck(txn, quoteId, quoteResponseId, hash)

        // Assert
        await expect(action()).rejects.toThrowError('Test Error')
      })
    })

    describe('getPartyType', () => {
      it('gets the partyType', async () => {
        // Arrange
        const partyType = 'testPartyType'
        const mockList = mockKnexBuilder(
          mockKnex,
          [{ partyTypeId: 123 }],
          ['where', 'select']
        )

        // Act
        const result = await database.getPartyType(partyType)

        // Assert
        expect(result).toStrictEqual(123)
        expect(mockList[0]).toHaveBeenCalledWith('partyType')
        expect(mockList[1]).toHaveBeenCalledWith('name', partyType)
        expect(mockList[2]).toHaveBeenCalledTimes(1)
      })

      it('handles the case where rows is undefined', async () => {
        // Arrange
        const partyType = 'testPartyType'
        mockKnexBuilder(
          mockKnex,
          undefined,
          ['where', 'select']
        )

        // Act
        const action = async () => database.getPartyType(partyType)

        // Assert
        await expect(action()).rejects.toThrowError('Unsupported party type \'testPartyType\'')
      })

      it('handles the case where rows is empty', async () => {
        // Arrange
        const partyType = 'testPartyType'
        mockKnexBuilder(
          mockKnex,
          [],
          ['where', 'select']
        )

        // Act
        const action = async () => database.getPartyType(partyType)

        // Assert
        await expect(action()).rejects.toThrowError('Unsupported party type \'testPartyType\'')
      })

      it('handles an exception', async () => {
        // Arrange
        const partyType = 'testPartyType'
        mockKnex.mockImplementationOnce(() => { throw new Error('Test Error') })

        // Act
        const action = async () => database.getPartyType(partyType)

        // Assert
        await expect(action()).rejects.toThrowError('Test Error')
      })
    })

    describe('getPartyIdentifierType', () => {
      it('gets the partyIdentifierType', async () => {
        // Arrange
        const partyIdentifierType = 'testPartyIdentifierType'
        const mockList = mockKnexBuilder(
          mockKnex,
          [{ partyIdentifierTypeId: 123 }],
          ['where', 'select']
        )

        // Act
        const result = await database.getPartyIdentifierType(partyIdentifierType)

        // Assert
        expect(result).toStrictEqual(123)
        expect(mockList[0]).toHaveBeenCalledWith('partyIdentifierType')
        expect(mockList[1]).toHaveBeenCalledWith('name', partyIdentifierType)
        expect(mockList[2]).toHaveBeenCalledTimes(1)
      })

      it('handles the case where rows is undefined', async () => {
        // Arrange
        const partyIdentifierType = 'testPartyIdentifierType'
        mockKnexBuilder(
          mockKnex,
          undefined,
          ['where', 'select']
        )

        // Act
        const action = async () => database.getPartyIdentifierType(partyIdentifierType)

        // Assert
        await expect(action()).rejects.toThrowError('Unsupported party identifier type \'testPartyIdentifierType\'')
      })

      it('handles the case where rows is empty', async () => {
        // Arrange
        const partyIdentifierType = 'testPartyIdentifierType'
        mockKnexBuilder(
          mockKnex,
          [],
          ['where', 'select']
        )

        // Act
        const action = async () => database.getPartyIdentifierType(partyIdentifierType)

        // Assert
        await expect(action()).rejects.toThrowError('Unsupported party identifier type \'testPartyIdentifierType\'')
      })

      it('handles an exception', async () => {
        // Arrange
        const partyIdentifierType = 'testPartyIdentifierType'
        mockKnex.mockImplementationOnce(() => { throw new Error('Test Error') })

        // Act
        const action = async () => database.getPartyIdentifierType(partyIdentifierType)

        // Assert
        await expect(action()).rejects.toThrowError('Test Error')
      })
    })

    describe('getParticipant', () => {
      it('gets the participant for PAYEE_DFSP', async () => {
        // Arrange
        const participantName = 'dfsp1'
        const participantType = LibEnum.PAYEE_DFSP
        const currency = 'USD'
        const ledgerAccountType = ENUM.Accounts.LedgerAccountType.POSITION
        const mockList = mockKnexBuilder(
          mockKnex,
          [{ participantId: 123 }],
          ['innerJoin', 'where', 'andWhere', 'andWhere', 'andWhere', 'andWhere', 'select']
        )

        // Act
        const result = await database.getParticipant(participantName, participantType, currency, ledgerAccountType)

        // Assert
        expect(result).toBe(123)
        expect(mockList[0]).toHaveBeenCalledWith('participant')
        expect(mockList[1]).toHaveBeenCalledWith('participantCurrency', 'participantCurrency.participantId', 'participant.participantId')
        expect(mockList[2]).toHaveBeenCalledTimes(1)
      })

      it('handles an undefined response with a participantType of PAYEE_DFSP', async () => {
        // Arrange
        const participantName = 'dfsp1'
        const participantType = LibEnum.PAYEE_DFSP
        const currency = 'USD'
        const ledgerAccountType = ENUM.Accounts.LedgerAccountType.POSITION
        mockKnexBuilder(
          mockKnex,
          undefined,
          ['innerJoin', 'where', 'andWhere', 'andWhere', 'andWhere', 'andWhere', 'select']
        )

        // Act
        const action = async () => database.getParticipant(participantName, participantType, currency, ledgerAccountType)

        // Assert
        await expect(action()).rejects.toThrowError('Unsupported participant')
      })

      it('handles an undefined response with a participantType of PAYER_DFSP', async () => {
        // Arrange
        const participantName = 'dfsp1'
        const participantType = LibEnum.PAYER_DFSP
        const currency = 'USD'
        const ledgerAccountType = ENUM.Accounts.LedgerAccountType.POSITION
        mockKnexBuilder(
          mockKnex,
          undefined,
          ['innerJoin', 'where', 'andWhere', 'andWhere', 'andWhere', 'andWhere', 'select']
        )

        // Act
        const action = async () => database.getParticipant(participantName, participantType, currency, ledgerAccountType)

        // Assert
        await expect(action()).rejects.toThrowError('Unsupported participant')
      })

      it('handles an empty response with no participantType', async () => {
        // Arrange
        const participantName = 'dfsp1'
        const currency = 'USD'
        const ledgerAccountType = ENUM.Accounts.LedgerAccountType.POSITION
        mockKnexBuilder(
          mockKnex,
          [],
          ['innerJoin', 'where', 'andWhere', 'andWhere', 'andWhere', 'andWhere', 'select']
        )

        // Act
        const action = async () => database.getParticipant(participantName, undefined, currency, ledgerAccountType)

        // Assert
        await expect(action()).rejects.toThrowError('Unsupported participant')
      })
    })

    describe('getParticipantByName', () => {
      it('gets the participant for PAYEE_DFSP', async () => {
        // Arrange
        const participantName = 'dfsp1'
        const participantType = LibEnum.PAYEE_DFSP

        const mockList = mockKnexBuilder(
          mockKnex,
          [{ participantId: 123 }],
          ['where', 'select']
        )

        // Act
        const result = await database.getParticipantByName(participantName, participantType)

        // Assert
        expect(result).toBe(123)
        expect(mockList[0]).toHaveBeenCalledWith('participant')
        // expect(mockList[1]).toHaveBeenCalledWith('participantCurrency', 'participantCurrency.participantId', 'participant.participantId')
        expect(mockList[1]).toHaveBeenCalledTimes(1)
      })

      it('handles an undefined response with a participantType of PAYEE_DFSP', async () => {
        // Arrange
        const participantName = 'dfsp1'
        const participantType = LibEnum.PAYEE_DFSP
        mockKnexBuilder(
          mockKnex,
          undefined,
          ['where', 'select']
        )

        // Act
        const action = async () => database.getParticipantByName(participantName, participantType)

        // Assert
        await expect(action()).rejects.toThrowError('Unsupported participant')
      })

      it('handles an undefined response with a participantType of PAYER_DFSP', async () => {
        // Arrange
        const participantName = 'dfsp1'
        const participantType = LibEnum.PAYER_DFSP
        mockKnexBuilder(
          mockKnex,
          undefined,
          ['where', 'select']
        )

        // Act
        const action = async () => database.getParticipantByName(participantName, participantType)

        // Assert
        await expect(action()).rejects.toThrowError('Unsupported participant')
      })

      it('handles an empty response with no participantType', async () => {
        // Arrange
        const participantName = 'dfsp1'
        mockKnexBuilder(
          mockKnex,
          [],
          ['where', 'select']
        )

        // Act
        const action = async () => database.getParticipantByName(participantName)

        // Assert
        await expect(action()).rejects.toThrowError('Unsupported participant')
      })
    })

    describe('getTransferParticipantRoleType', () => {
      it('gets the transferParticipantRoleType', async () => {
        // Arrange
        const name = 'testName'
        const mockList = mockKnexBuilder(
          mockKnex,
          [{ transferParticipantRoleTypeId: 123 }],
          ['where', 'select']
        )

        // Act
        const result = await database.getTransferParticipantRoleType(name)

        // Assert
        expect(result).toStrictEqual(123)
        expect(mockList[0]).toHaveBeenCalledWith('transferParticipantRoleType')
        expect(mockList[1]).toHaveBeenCalledWith({ name, isActive: 1 })
        expect(mockList[2]).toHaveBeenCalledTimes(1)
      })

      it('handles the case where rows is undefined', async () => {
        // Arrange
        const name = 'testName'
        mockKnexBuilder(
          mockKnex,
          undefined,
          ['where', 'select']
        )

        // Act
        const action = async () => database.getTransferParticipantRoleType(name)

        // Assert
        await expect(action()).rejects.toThrowError('Unsupported transfer participant role type \'testName\'')
      })

      it('handles the case where rows is empty', async () => {
        // Arrange
        const name = 'testName'
        mockKnexBuilder(
          mockKnex,
          [],
          ['where', 'select']
        )

        // Act
        const action = async () => database.getTransferParticipantRoleType(name)

        // Assert
        await expect(action()).rejects.toThrowError('Unsupported transfer participant role type \'testName\'')
      })

      it('handles an exception', async () => {
        // Arrange
        const name = 'name'
        mockKnex.mockImplementationOnce(() => { throw new Error('Test Error') })

        // Act
        const action = async () => database.getTransferParticipantRoleType(name)

        // Assert
        await expect(action()).rejects.toThrowError('Test Error')
      })
    })

    describe('getLedgerEntryType', () => {
      it('gets the ledgerEntityType', async () => {
        // Arrange
        const name = 'ledgerName'
        const mockList = mockKnexBuilder(
          mockKnex,
          [{ ledgerEntryTypeId: 123 }],
          ['where', 'select']
        )

        // Act
        const result = await database.getLedgerEntryType(name)

        // Assert
        expect(result).toStrictEqual(123)
        expect(mockList[0]).toHaveBeenCalledWith('ledgerEntryType')
        expect(mockList[1]).toHaveBeenCalledWith({ name, isActive: 1 })
        expect(mockList[2]).toHaveBeenCalledTimes(1)
      })

      it('handles the case where rows is undefined', async () => {
        // Arrange
        const name = 'ledgerName'
        mockKnexBuilder(
          mockKnex,
          undefined,
          ['where', 'select']
        )

        // Act
        const action = async () => database.getLedgerEntryType(name)

        // Assert
        await expect(action()).rejects.toThrowError('Unsupported ledger entry type \'ledgerName\'')
      })

      it('handles the case where rows is empty', async () => {
        // Arrange
        const name = 'ledgerName'
        mockKnexBuilder(
          mockKnex,
          [],
          ['where', 'select']
        )

        // Act
        const action = async () => database.getLedgerEntryType(name)

        // Assert
        await expect(action()).rejects.toThrowError('Unsupported ledger entry type \'ledgerName\'')
      })

      it('handles an exception', async () => {
        // Arrange
        const name = 'ledgerName'
        mockKnex.mockImplementationOnce(() => { throw new Error('Test Error') })

        // Act
        const action = async () => database.getLedgerEntryType(name)

        // Assert
        await expect(action()).rejects.toThrowError('Test Error')
      })
    })

    describe('createPayerQuoteParty', () => {
      it('creates a payer quote for a party', () => {
        // Arrange
        const txn = jest.fn()
        const quoteId = 'ddaa67b3-5bf8-45c1-bfcf-1e8781177c37'
        const party = {}
        const amount = 100
        const currency = 'AUD'
        const enumVals = [
          'testPartyTypeId',
          'testPartyIdentifierTypeId',
          'testParticipantId',
          'testTransferParticipantRoleTypeId',
          'testLedgerEntryTypeId'
        ]
        database.createQuoteParty = jest.fn()

        // Act
        database.createPayerQuoteParty(txn, quoteId, party, amount, currency, enumVals)

        // Assert
        expect(database.createQuoteParty).toHaveBeenCalledWith(
          txn,
          quoteId,
          LibEnum.PAYER,
          party,
          100,
          'AUD',
          enumVals
        )
      })
    })

    describe('createPayeeQuoteParty', () => {
      it('creates a payee quote for a party', () => {
        // Arrange
        const txn = jest.fn()
        const quoteId = 'ddaa67b3-5bf8-45c1-bfcf-1e8781177c37'
        const party = {}
        const amount = 100
        const currency = 'AUD'
        const enumVals = [
          'testPartyTypeId',
          'testPartyIdentifierTypeId',
          'testParticipantId',
          'testTransferParticipantRoleTypeId',
          'testLedgerEntryTypeId'
        ]
        database.createQuoteParty = jest.fn()

        // Act
        database.createPayeeQuoteParty(txn, quoteId, party, amount, currency, enumVals)

        // Assert
        expect(database.createQuoteParty).toHaveBeenCalledWith(
          txn,
          quoteId,
          LibEnum.PAYEE,
          party,
          -100,
          'AUD',
          enumVals
        )
      })
    })

    describe('createQuoteParty', () => {
      const quoteId = 'ddaa67b3-5bf8-45c1-bfcf-1e8781177c37'
      const partyType = LibEnum.PAYEE
      const amount = 100
      const currency = 'AUD'
      const quoteParty = {
        quotePartyId: 'ddaa67b3-5bf8-45c1-bfcf-1e8781177c37'
      }
      const enumVals = [
        'testPartyTypeId',
        'testPartyIdentifierTypeId',
        'testParticipantId',
        'testTransferParticipantRoleTypeId',
        'testLedgerEntryTypeId'
      ]
      beforeEach(() => {
        database.getPartyType = jest.fn().mockResolvedValueOnce('testPartyTypeId')
        database.getPartyIdentifierType = jest.fn().mockResolvedValueOnce('testPartyIdentifierTypeId')
        database.getParticipant = jest.fn().mockResolvedValueOnce('testParticipantId')
        database.getParticipantByName = jest.fn().mockResolvedValueOnce('testParticipantId')
        database.getTransferParticipantRoleType = jest.fn().mockResolvedValueOnce('testTransferParticipantRoleTypeId')
        database.getLedgerEntryType = jest.fn().mockResolvedValueOnce('testLedgerEntryTypeId')
        database.getTxnQuoteParty = jest.fn().mockResolvedValueOnce(quoteParty)
        database.createQuotePartyIdInfoExtensions = jest.fn().mockResolvedValueOnce(true)
      })

      it('Creates a quote party', async () => {
        // Arrange
        const txn = jest.fn()
        const party = {
          partyName: 'testPartyName',
          partyIdInfo: {
            partyIdentifier: 'testPartyIdentifier',
            partyIdType: 'MSISDN',
            fspId: 'payeeFsp',
            extensionList: {
              extension: [
                {
                  key: 'Test',
                  value: 'Data'
                }
              ]
            }
          },
          merchantClassificationCode: '0'
        }
        const mockList = mockKnexBuilder(
          mockKnex,
          ['12345'],
          ['transacting', 'insert']
        )
        const expectedNewQuoteParty = {
          quoteId,
          partyTypeId: 'testPartyTypeId',
          partyIdentifierTypeId: 'testPartyIdentifierTypeId',
          partyIdentifierValue: 'testPartyIdentifier',
          partySubIdOrTypeId: undefined,
          fspId: 'payeeFsp',
          participantId: 'testParticipantId',
          merchantClassificationCode: '0',
          partyName: 'testPartyName',
          transferParticipantRoleTypeId: 'testTransferParticipantRoleTypeId',
          ledgerEntryTypeId: 'testLedgerEntryTypeId',
          amount: '100.0000',
          currencyId: 'AUD'
        }

        // Act
        const result = await database.createQuoteParty(txn, quoteId, partyType, party, amount, currency, enumVals)

        // Assert
        expect(result).toBe('12345')
        expect(mockList[0]).toHaveBeenCalledWith('quoteParty')
        expect(mockList[1]).toHaveBeenCalledWith(txn)
        expect(mockList[2]).toHaveBeenCalledWith(expectedNewQuoteParty)
      })

      it('handles the partySubIdOrType', async () => {
        // Arrange
        const txn = jest.fn()
        const party = {
          partyName: 'testPartyName',
          partyIdInfo: {
            partySubIdOrType: 'testSubId',
            partyIdentifier: 'testPartyIdentifier',
            partyIdType: 'MSISDN',
            fspId: 'payeeFsp'
          },
          merchantClassificationCode: '0'
        }
        database.getPartyIdentifierType = jest.fn()
          .mockResolvedValueOnce('testPartyIdentifierTypeId')
        const mockList = mockKnexBuilder(
          mockKnex,
          ['12345'],
          ['transacting', 'insert']
        )
        const expectedNewQuoteParty = {
          quoteId,
          partyTypeId: 'testPartyTypeId',
          partyIdentifierTypeId: 'testPartyIdentifierTypeId',
          partyIdentifierValue: 'testPartyIdentifier',
          partySubIdOrTypeId: 'testSubId',
          fspId: 'payeeFsp',
          participantId: 'testParticipantId',
          merchantClassificationCode: '0',
          partyName: 'testPartyName',
          transferParticipantRoleTypeId: 'testTransferParticipantRoleTypeId',
          ledgerEntryTypeId: 'testLedgerEntryTypeId',
          amount: '100.0000',
          currencyId: 'AUD'
        }

        // Act
        const result = await database.createQuoteParty(txn, quoteId, partyType, party, amount, currency, enumVals)

        // Assert
        expect(result).toBe('12345')
        expect(mockList[0]).toHaveBeenCalledWith('quoteParty')
        expect(mockList[1]).toHaveBeenCalledWith(txn)
        expect(mockList[2]).toHaveBeenCalledWith(expectedNewQuoteParty)
      })

      it('creates a new party if the party contains personal info', async () => {
        // Arrange
        const txn = jest.fn()
        const party = {
          partyName: 'testPartyName',
          partyIdInfo: {
            partyIdentifier: 'testPartyIdentifier',
            partyIdType: 'MSISDN',
            fspId: 'payeeFsp'
          },
          merchantClassificationCode: '0',
          personalInfo: {
            complexName: {
              firstName: 'Mats',
              middleName: 'Middle',
              lastName: 'Hagman'
            },
            dateOfBirth: '1983-10-25'
          }
        }
        const mockList = mockKnexBuilder(
          mockKnex,
          ['12345'],
          ['transacting', 'insert']
        )
        database.createParty = jest.fn()
        const expectedNewQuoteParty = {
          quoteId,
          partyTypeId: 'testPartyTypeId',
          partyIdentifierTypeId: 'testPartyIdentifierTypeId',
          partyIdentifierValue: 'testPartyIdentifier',
          partySubIdOrTypeId: undefined,
          fspId: 'payeeFsp',
          participantId: 'testParticipantId',
          merchantClassificationCode: '0',
          partyName: 'testPartyName',
          transferParticipantRoleTypeId: 'testTransferParticipantRoleTypeId',
          ledgerEntryTypeId: 'testLedgerEntryTypeId',
          amount: '100.0000',
          currencyId: 'AUD'
        }
        const expectedNewParty = {
          firstName: 'Mats',
          middleName: 'Middle',
          lastName: 'Hagman',
          dateOfBirth: '1983-10-25'
        }

        // Act
        const result = await database.createQuoteParty(txn, quoteId, partyType, party, amount, currency, enumVals)

        // Assert
        expect(result).toBe('12345')
        expect(mockList[0]).toHaveBeenCalledWith('quoteParty')
        expect(mockList[1]).toHaveBeenCalledWith(txn)
        expect(mockList[2]).toHaveBeenCalledWith(expectedNewQuoteParty)
        expect(database.createParty).toHaveBeenCalledWith(txn, '12345', expectedNewParty)
      })

      it('handles an exception when creating a quote', async () => {
        // Arrange
        const txn = jest.fn()
        const party = {
          partyName: 'testPartyName',
          partyIdInfo: {
            partyIdentifier: 'testPartyIdentifier',
            partyIdType: 'MSISDN',
            fspId: 'payeeFsp'
          },
          merchantClassificationCode: '0'
        }
        mockKnex.mockImplementationOnce(() => { throw new Error('Test Error') })

        // Act
        const action = async () => database.createQuoteParty(txn, quoteId, partyType, party, amount, currency, enumVals)

        // Assert
        await expect(action()).rejects.toThrowError('Test Error')
      })
    })

    describe('createParty', () => {
      const quotePartyId = '12345'
      const party = {
        firstName: 'Mats',
        middleName: 'Middle',
        lastName: 'Hagman',
        dateOfBirth: '1983-10-25'
      }

      it('creates a party', async () => {
        // Arrange
        const txn = jest.fn()
        const mockList = mockKnexBuilder(
          mockKnex,
          ['12345'],
          ['transacting', 'insert']
        )
        const expected = {
          partyId: '12345',
          ...party,
          quotePartyId
        }

        // Act
        const result = await database.createParty(txn, quotePartyId, party)

        // Assert
        expect(result).toStrictEqual(expected)
        expect(mockList[0]).toHaveBeenCalledWith('party')
        expect(mockList[1]).toHaveBeenCalledWith(txn)
        expect(mockList[2]).toHaveBeenCalledTimes(1)
      })

      it('handles an exception when creating a party', async () => {
        // Arrange
        const txn = jest.fn()
        mockKnex.mockImplementationOnce(() => { throw new Error('Test Error') })

        // Act
        const action = async () => database.createParty(txn, quotePartyId, party)

        // Assert
        await expect(action()).rejects.toThrowError('Test Error')
      })
    })

    describe('createQuote', () => {
      const mockQuote = {
        quoteId: 'ddaa67b3-5bf8-45c1-bfcf-1e8781177c37',
        transactionReferenceId: 'referenceId',
        transactionRequestId: 'abc123',
        note: 'test quote',
        expirationDate: '2019-10-30T10:30:19.899Z',
        transactionInitiatorId: 'CONSUMER',
        transactionInitiatorTypeId: 'payee',
        transactionScenarioId: 'TRANSFER',
        balanceOfPaymentsId: '1',
        transactionSubScenarioId: 'testSubScenario',
        amountTypeId: 'SEND',
        amount: 100,
        currencyId: 'USD'
      }

      it('creates a quote', async () => {
        // Arrange
        const txn = jest.fn()
        const mockList = mockKnexBuilder(
          mockKnex,
          null,
          ['transacting', 'insert']
        )
        const expectedInsert = {
          ...mockQuote,
          amount: '100.0000'
        }

        // Act
        const result = await database.createQuote(txn, mockQuote)

        // Assert
        expect(result).toEqual(mockQuote.quoteId)
        expect(mockList[0]).toHaveBeenCalledWith('quote')
        expect(mockList[1]).toHaveBeenCalledWith(txn)
        expect(mockList[2]).toHaveBeenCalledWith(expectedInsert)
      })

      it('handles an error creating the quote', async () => {
        // Arrange
        const txn = jest.fn()
        mockKnex.mockImplementationOnce(() => { throw new Error('Test Error') })

        // Act
        const action = async () => database.createQuote(txn, mockQuote)

        // Assert
        await expect(action()).rejects.toThrowError('Test Error')
      })
    })

    describe('createQuotePartyIdInfoExtensions', () => {
      const extensions = [
        {
          key: 'Test',
          value: 'data'
        },
        {
          key: 'Test1',
          value: 'data1'
        }
      ]
      const quoteParty = {
        quotePartyId: 'ddaa67b3-5bf8-45c1-bfcf-1e8781177c37'
      }

      it('creates a quote partyId info extension', async () => {
        // Arrange
        const txn = jest.fn()
        const mockList = mockKnexBuilder(
          mockKnex,
          null,
          ['transacting', 'insert']
        )
        const expectedInsert = [
          {
            quotePartyId: quoteParty.quotePartyId,
            key: 'Test',
            value: 'data'
          },
          {
            quotePartyId: quoteParty.quotePartyId,
            key: 'Test1',
            value: 'data1'
          }
        ]

        // Act
        const result = await database.createQuotePartyIdInfoExtensions(txn, extensions, quoteParty)

        // Assert
        expect(result).toEqual(true)
        expect(mockList[0]).toHaveBeenCalledWith('quotePartyIdInfoExtension')
        expect(mockList[1]).toHaveBeenCalledWith(txn)
        expect(mockList[2]).toHaveBeenCalledWith(expectedInsert)
      })

      it('handles an error creating the quote', async () => {
        // Arrange
        const txn = jest.fn()
        mockKnex.mockImplementationOnce(() => { throw new Error('Test Error') })

        // Act
        const action = async () => database.createQuotePartyIdInfoExtensions(txn, extensions, quoteParty)

        // Assert
        await expect(action()).rejects.toThrowError('Test Error')
      })
    })

    describe('getQuoteParty', () => {
      it('gets the quote party', async () => {
        // Arrange
        const quoteId = 'ddaa67b3-5bf8-45c1-bfcf-1e8781177c37'
        const partyType = 'PAYEE'
        const mockList = mockKnexBuilder(
          mockKnex,
          [{ value: 'mockQuoteParty' }],
          ['innerJoin', 'where', 'andWhere', 'select']
        )

        // Act
        const result = await database.getQuoteParty(quoteId, partyType)

        // Assert
        expect(result).toStrictEqual({ value: 'mockQuoteParty' })
        expect(mockList[0]).toHaveBeenCalledWith('quoteParty')
        expect(mockList[1]).toHaveBeenCalledWith('partyType', 'partyType.partyTypeId', 'quoteParty.partyTypeId')
        expect(mockList[2]).toHaveBeenCalledWith('quoteParty.quoteId', quoteId)
        expect(mockList[3]).toHaveBeenCalledWith('partyType.name', partyType)
        expect(mockList[4]).toHaveBeenCalledWith('quoteParty.*')
      })

      it('returns null when the query returns undefined', async () => {
        // Arrange
        const quoteId = 'ddaa67b3-5bf8-45c1-bfcf-1e8781177c37'
        const partyType = 'PAYEE'
        mockKnexBuilder(
          mockKnex,
          undefined,
          ['innerJoin', 'where', 'andWhere', 'select']
        )

        // Act
        const result = await database.getQuoteParty(quoteId, partyType)

        // Assert
        expect(result).toStrictEqual(null)
      })

      it('returns null when the query returns no rows', async () => {
        // Arrange
        const quoteId = 'ddaa67b3-5bf8-45c1-bfcf-1e8781177c37'
        const partyType = 'PAYEE'
        mockKnexBuilder(
          mockKnex,
          [],
          ['innerJoin', 'where', 'andWhere', 'select']
        )

        // Act
        const result = await database.getQuoteParty(quoteId, partyType)

        // Assert
        expect(result).toStrictEqual(null)
      })

      it('handles an exception', async () => {
        // Arrange
        const quoteId = 'ddaa67b3-5bf8-45c1-bfcf-1e8781177c37'
        const partyType = 'PAYEE'
        mockKnex.mockImplementationOnce(() => { throw new Error('Test Error') })

        // Act
        const action = async () => database.getQuoteParty(quoteId, partyType)

        // Assert
        await expect(action()).rejects.toThrowError('Test Error')
      })

      it('throws an exception when more than one quoteParty is found', async () => {
        // Arrange
        const quoteId = 'ddaa67b3-5bf8-45c1-bfcf-1e8781177c37'
        const partyType = 'PAYEE'
        mockKnexBuilder(
          mockKnex,
          [{ value: 'mockQuoteParty' }, { value: 'mockQuoteParty2' }],
          ['innerJoin', 'where', 'andWhere', 'select']
        )

        // Act
        const action = async () => database.getQuoteParty(quoteId, partyType)

        // Assert
        await expect(action()).rejects.toThrowError(/Expected 1 quoteParty .*/)
      })
    })

    describe('getTxnQuoteParty', () => {
      it('gets the txn quote party', async () => {
        // Arrange
        const txn = jest.fn()
        const quoteId = 'ddaa67b3-5bf8-45c1-bfcf-1e8781177c37'
        const partyType = 'PAYEE'
        const mockList = mockKnexBuilder(
          mockKnex,
          [{ value: 'mockQuoteParty' }],
          ['transacting', 'innerJoin', 'where', 'andWhere', 'select']
        )

        // Act
        const result = await database.getTxnQuoteParty(txn, quoteId, partyType)

        // Assert
        expect(result).toStrictEqual({ value: 'mockQuoteParty' })
        expect(mockList[0]).toHaveBeenCalledWith('quoteParty')
        expect(mockList[2]).toHaveBeenCalledWith('partyType', 'partyType.partyTypeId', 'quoteParty.partyTypeId')
        expect(mockList[3]).toHaveBeenCalledWith('quoteParty.quoteId', quoteId)
        expect(mockList[4]).toHaveBeenCalledWith('partyType.name', partyType)
        expect(mockList[5]).toHaveBeenCalledWith('quoteParty.*')
      })

      it('returns null when the query returns undefined', async () => {
        // Arrange
        const txn = jest.fn()
        const quoteId = 'ddaa67b3-5bf8-45c1-bfcf-1e8781177c37'
        const partyType = 'PAYEE'
        mockKnexBuilder(
          mockKnex,
          undefined,
          ['transacting', 'innerJoin', 'where', 'andWhere', 'select']
        )

        // Act
        const result = await database.getTxnQuoteParty(txn, quoteId, partyType)

        // Assert
        expect(result).toStrictEqual(null)
      })

      it('returns null when the query returns no rows', async () => {
        // Arrange
        const txn = jest.fn()
        const quoteId = 'ddaa67b3-5bf8-45c1-bfcf-1e8781177c37'
        const partyType = 'PAYEE'
        mockKnexBuilder(
          mockKnex,
          [],
          ['transacting', 'innerJoin', 'where', 'andWhere', 'select']
        )

        // Act
        const result = await database.getTxnQuoteParty(txn, quoteId, partyType)

        // Assert
        expect(result).toStrictEqual(null)
      })

      it('handles an exception', async () => {
        // Arrange
        const txn = jest.fn()
        const quoteId = 'ddaa67b3-5bf8-45c1-bfcf-1e8781177c37'
        const partyType = 'PAYEE'
        mockKnex.mockImplementationOnce(() => { throw new Error('Test Error') })

        // Act
        const action = async () => database.getTxnQuoteParty(txn, quoteId, partyType)

        // Assert
        await expect(action()).rejects.toThrowError('Test Error')
      })

      it('throws an exception when more than one quoteParty is found', async () => {
        // Arrange
        const txn = jest.fn()
        const quoteId = 'ddaa67b3-5bf8-45c1-bfcf-1e8781177c37'
        const partyType = 'PAYEE'
        mockKnexBuilder(
          mockKnex,
          [{ value: 'mockQuoteParty' }, { value: 'mockQuoteParty2' }],
          ['transacting', 'innerJoin', 'where', 'andWhere', 'select']
        )

        // Act
        const action = async () => database.getTxnQuoteParty(txn, quoteId, partyType)

        // Assert
        await expect(action()).rejects.toThrowError(/Expected 1 quoteParty .*/)
      })
    })

    describe('getParticipantEndpoint', () => {
      it('gets the participant endpoint', async () => {
        // Arrange
        const participantName = 'fsp1'
        const endpointType = 'FSPIOP_CALLBACK_URL_QUOTES'
        const mockList = mockKnexBuilder(
          mockKnex,
          [{ value: 'http://localhost:3000/testEndpoint' }],
          ['innerJoin', 'innerJoin', 'where', 'andWhere', 'andWhere', 'select']
        )

        // Act
        const result = await database.getParticipantEndpoint(participantName, endpointType)

        // Assert
        expect(result).toBe('http://localhost:3000/testEndpoint')
        expect(mockList[0]).toBeCalledWith('participantEndpoint')
        expect(mockList[1]).toBeCalledWith('participant', 'participant.participantId', 'participantEndpoint.participantId')
        expect(mockList[2]).toBeCalledWith('endpointType', 'endpointType.endpointTypeId', 'participantEndpoint.endpointTypeId')
        expect(mockList[3]).toBeCalledWith('participant.name', participantName)
        expect(mockList[4]).toBeCalledWith('endpointType.name', endpointType)
        expect(mockList[5]).toBeCalledWith('participantEndpoint.isActive', 1)
        expect(mockList[6]).toBeCalledWith('participantEndpoint.value')
      })

      it('returns null when the query returns undefined', async () => {
        // Arrange
        const participantName = 'fsp1'
        const endpointType = 'FSPIOP_CALLBACK_URL_QUOTES'
        mockKnexBuilder(
          mockKnex,
          undefined,
          ['innerJoin', 'innerJoin', 'where', 'andWhere', 'andWhere', 'select']
        )

        // Act
        const result = await database.getParticipantEndpoint(participantName, endpointType)

        // Assert
        expect(result).toBe(null)
      })

      it('returns null when there are no rows found', async () => {
        // Arrange
        const participantName = 'fsp1'
        const endpointType = 'FSPIOP_CALLBACK_URL_QUOTES'
        mockKnexBuilder(
          mockKnex,
          [],
          ['innerJoin', 'innerJoin', 'where', 'andWhere', 'andWhere', 'select']
        )

        // Act
        const result = await database.getParticipantEndpoint(participantName, endpointType)

        // Assert
        expect(result).toBe(null)
      })

      it('handles an exception', async () => {
        // Arrange
        const participantName = 'fsp1'
        const endpointType = 'FSPIOP_CALLBACK_URL_QUOTES'
        mockKnex.mockImplementationOnce(() => { throw new Error('Test Error') })

        // Act
        const action = async () => database.getParticipantEndpoint(participantName, endpointType)

        // Assert
        await expect(action()).rejects.toThrowError('Test Error')
      })
    })

    describe('getQuoteDuplicateCheck', () => {
      it('gets the getQuoteDuplicateCheck', async () => {
        // Arrange
        const quoteId = 'ddaa67b3-5bf8-45c1-bfcf-1e8781177c37'
        const mockList = mockKnexBuilder(mockKnex, ['1'], ['where', 'select'])

        // Act
        const result = await database.getQuoteDuplicateCheck(quoteId)

        // Assert
        expect(result).toBe('1')
        expect(mockList[0]).toHaveBeenCalledWith('quoteDuplicateCheck')
        expect(mockList[1]).toHaveBeenCalledWith({ quoteId })
        expect(mockList[2]).toHaveBeenCalledTimes(1)
      })

      it('returns null when the query returns undefined', async () => {
        // Arrange
        const quoteId = 'ddaa67b3-5bf8-45c1-bfcf-1e8781177c37'
        const mockList = mockKnexBuilder(mockKnex, null, ['where', 'select'])

        // Act
        const result = await database.getQuoteDuplicateCheck(quoteId)

        // Assert
        expect(result).toBe(null)
        expect(mockList[0]).toHaveBeenCalledWith('quoteDuplicateCheck')
        expect(mockList[1]).toHaveBeenCalledWith({ quoteId })
        expect(mockList[2]).toHaveBeenCalledTimes(1)
      })

      it('returns null when there are no rows found', async () => {
        // Arrange
        const quoteId = 'ddaa67b3-5bf8-45c1-bfcf-1e8781177c37'
        const mockList = mockKnexBuilder(mockKnex, [], ['where', 'select'])

        // Act
        const result = await database.getQuoteDuplicateCheck(quoteId)

        // Assert
        expect(result).toBe(null)
        expect(mockList[0]).toHaveBeenCalledWith('quoteDuplicateCheck')
        expect(mockList[1]).toHaveBeenCalledWith({ quoteId })
        expect(mockList[2]).toHaveBeenCalledTimes(1)
      })

      it('handles an exception', async () => {
        // Arrange
        const quoteId = 'ddaa67b3-5bf8-45c1-bfcf-1e8781177c37'
        mockKnex.mockImplementationOnce(() => { throw new Error('Test Error') })

        // Act
        const action = async () => database.getQuoteDuplicateCheck(quoteId)

        // Assert
        await expect(action()).rejects.toThrowError('Test Error')
      })
    })

    describe('getQuoteResponseDuplicateCheck', () => {
      it('gets the quoteResponseDuplicateCheck', async () => {
        // Arrange
        const quoteId = 'ddaa67b3-5bf8-45c1-bfcf-1e8781177c37'
        const mockList = mockKnexBuilder(mockKnex, ['1'], ['where', 'select'])

        // Act
        const result = await database.getQuoteResponseDuplicateCheck(quoteId)

        // Assert
        expect(result).toBe('1')
        expect(mockList[0]).toHaveBeenCalledWith('quoteResponseDuplicateCheck')
        expect(mockList[1]).toHaveBeenCalledWith({ quoteId })
        expect(mockList[2]).toHaveBeenCalledTimes(1)
      })

      it('returns null when the query returns undefined', async () => {
        // Arrange
        const quoteId = 'ddaa67b3-5bf8-45c1-bfcf-1e8781177c37'
        const mockList = mockKnexBuilder(mockKnex, undefined, ['where', 'select'])

        // Act
        const result = await database.getQuoteResponseDuplicateCheck(quoteId)

        // Assert
        expect(result).toBe(null)
        expect(mockList[0]).toHaveBeenCalledWith('quoteResponseDuplicateCheck')
        expect(mockList[1]).toHaveBeenCalledWith({ quoteId })
        expect(mockList[2]).toHaveBeenCalledTimes(1)
      })

      it('returns null when there are no rows found', async () => {
        // Arrange
        const quoteId = 'ddaa67b3-5bf8-45c1-bfcf-1e8781177c37'
        const mockList = mockKnexBuilder(mockKnex, [], ['where', 'select'])

        // Act
        const result = await database.getQuoteResponseDuplicateCheck(quoteId)

        // Assert
        expect(result).toBe(null)
        expect(mockList[0]).toHaveBeenCalledWith('quoteResponseDuplicateCheck')
        expect(mockList[1]).toHaveBeenCalledWith({ quoteId })
        expect(mockList[2]).toHaveBeenCalledTimes(1)
      })

      it('handles an exception', async () => {
        // Arrange
        const quoteId = 'ddaa67b3-5bf8-45c1-bfcf-1e8781177c37'
        mockKnex.mockImplementationOnce(() => { throw new Error('Test Error') })

        // Act
        const action = async () => database.getQuoteResponseDuplicateCheck(quoteId)

        // Assert
        await expect(action()).rejects.toThrowError('Test Error')
      })
    })

    describe('createQuoteResponse', () => {
      const completeQuoteResponse = {
        transferAmount: {
          amount: '100',
          currency: 'USD'
        },
        payeeReceiveAmount: {
          amount: '99',
          currency: 'USD'
        },
        payeeFspFee: {
          amount: '1',
          currency: 'USD'
        },
        payeeFspCommission: {
          amount: '1',
          currency: 'USD'
        },
        condition: 'HOr22-H3AfTDHrSkPjJtVPRdKouuMkDXTR4ejlQa8Ks',
        expiration: '2019-05-27T15:44:53.292Z',
        isValid: true
      }

      it('creates the quote response', async () => {
        // Arrange
        const txn = jest.fn()
        const quoteId = 'ddaa67b3-5bf8-45c1-bfcf-1e8781177c37'
        const mockList = mockKnexBuilder(mockKnex, ['1'], ['transacting', 'insert'])
        const expected = {
          quoteId,
          quoteResponseId: '1',
          ilpCondition: completeQuoteResponse.condition,
          isValid: completeQuoteResponse.isValid,
          payeeFspCommissionAmount: '1.0000',
          payeeFspCommissionCurrencyId: 'USD',
          payeeFspFeeAmount: '1.0000',
          payeeFspFeeCurrencyId: 'USD',
          payeeReceiveAmount: '99.0000',
          payeeReceiveAmountCurrencyId: 'USD',
          responseExpirationDate: '2019-05-27T15:44:53.292Z',
          transferAmount: '100.0000',
          transferAmountCurrencyId: 'USD'
        }

        // Act
        const result = await database.createQuoteResponse(txn, quoteId, completeQuoteResponse)

        // Assert
        expect(result).toStrictEqual(expected)
        expect(mockList[0]).toHaveBeenCalledWith('quoteResponse')
        expect(mockList[1]).toHaveBeenCalledWith(txn)
        expect(mockList[2]).toHaveBeenCalledTimes(1)
      })

      it('handles an exception in createQuoteResponse', async () => {
        // Arrange
        const txn = jest.fn()
        const quoteId = 'ddaa67b3-5bf8-45c1-bfcf-1e8781177c37'
        mockKnex.mockImplementationOnce(() => { throw new Error('Test Error') })

        // Act
        const action = async () => database.createQuoteResponse(txn, quoteId, completeQuoteResponse)

        // Assert
        await expect(action()).rejects.toThrowError('Test Error')
      })
    })

    describe('createQuoteResponseIlpPacket', () => {
      it('creates a new createQuoteResponseIlpPacket', async () => {
        // Arrange
        const txn = jest.fn()
        const quoteResponseId = '12345'
        const ilpPacket = 'mock_ilp_packet'
        const mockList = mockKnexBuilder(mockKnex, ['12345'], ['transacting', 'insert'])
        const expectedInsert = {
          quoteResponseId,
          value: ilpPacket
        }

        // Act
        const result = await database.createQuoteResponseIlpPacket(txn, quoteResponseId, ilpPacket)

        // Assert
        expect(result).toStrictEqual(['12345'])
        expect(mockList[0]).toHaveBeenCalledWith('quoteResponseIlpPacket')
        expect(mockList[1]).toHaveBeenCalledWith(txn)
        expect(mockList[2]).toHaveBeenCalledWith(expectedInsert)
      })

      it('handles an exception in creating the GeoCode', async () => {
        // Arrange
        const txn = jest.fn()
        const quoteResponseId = '12345'
        const ilpPacket = 'mock_ilp_packet'
        mockKnex.mockImplementationOnce(() => { throw new Error('Test Error') })

        // Act
        const action = async () => database.createQuoteResponseIlpPacket(txn, quoteResponseId, ilpPacket)

        // Assert
        await expect(action()).rejects.toThrowError('Test Error')
      })
    })

    describe('createGeoCode', () => {
      it('creates a new GeoCode', async () => {
        // Arrange
        const txn = jest.fn()
        const geoCode = {
          quotePartyId: '12345',
          latitude: '00.0000',
          longitude: '00.0000'
        }
        const mockList = mockKnexBuilder(mockKnex, ['12345'], ['transacting', 'insert'])

        // Act
        const result = await database.createGeoCode(txn, geoCode)

        // Assert
        expect(result).toStrictEqual(['12345'])
        expect(mockList[0]).toHaveBeenCalledWith('geoCode')
        expect(mockList[1]).toHaveBeenCalledWith(txn)
        expect(mockList[2]).toHaveBeenCalledTimes(1)
      })

      it('handles an exception in creating the GeoCode', async () => {
        // Arrange
        const txn = jest.fn()
        const geoCode = {
          quotePartyId: '12345',
          latitude: '00.0000',
          longitude: '00.0000'
        }
        mockKnex.mockImplementationOnce(() => { throw new Error('Test Error') })

        // Act
        const action = async () => database.createGeoCode(txn, geoCode)

        // Assert
        await expect(action()).rejects.toThrowError('Test Error')
      })
    })

    describe('createQuoteExtensions', () => {
      it('creates new quoteExtensions', async () => {
        // Arrange
        const txn = jest.fn()
        const extensions = [{
          key: 'key1',
          value: 'value1'
        }, {
          key: 'key2',
          value: 'value2'
        }]
        const quoteId = '123'
        const transactionId = '789'
        const quoteResponseId = 456

        const mockList = mockKnexBuilder(mockKnex, ['12345'], ['transacting', 'insert'])

        // Act
        const result = await database.createQuoteExtensions(txn, extensions, quoteId, transactionId, quoteResponseId)

        // Assert
        expect(result).toStrictEqual(['12345'])
        expect(mockList[0]).toHaveBeenCalledWith('quoteExtension')
        expect(mockList[1]).toHaveBeenCalledWith(txn)
        expect(mockList[2]).toHaveBeenCalledWith(extensions.map(({ key, value }) => ({
          key, value, quoteId, transactionId, quoteResponseId
        })))
        expect(mockList[2]).toHaveBeenCalledTimes(1)
      })

      it('handles an exception in creating the quoteExtensions', async () => {
        // Arrange
        const txn = jest.fn()
        const extensions = [{
          quoteId: '123',
          quoteResponseId: 456,
          key: 'key1',
          value: 'value1'
        }, {
          quoteId: '789',
          quoteResponseId: 101112,
          key: 'key2',
          value: 'value2'
        }]
        mockKnex.mockImplementationOnce(() => { throw new Error('Test Error') })

        // Act
        const action = async () => database.createQuoteExtensions(txn, extensions)

        // Assert
        await expect(action()).rejects.toThrowError('Test Error')
      })
    })

    describe('createQuoteError', () => {
      it('creates a default quote error', async () => {
        // Arrange
        const txn = jest.fn()
        const error = {
          quoteId: '12345',
          errorCode: '2201',
          errorDescription: 'Test Error'
        }
        const mockList = mockKnexBuilder(mockKnex, ['12345'], ['transacting', 'insert'])

        // Act
        const result = await database.createQuoteError(txn, error)

        // Assert
        expect(result).toStrictEqual(['12345'])
        expect(mockList[0]).toHaveBeenCalledWith('quoteError')
        expect(mockList[1]).toHaveBeenCalledWith(txn)
        expect(mockList[2]).toHaveBeenCalledTimes(1)
      })

      it('handles an exception in handling the quote error', async () => {
        // Arrange
        const txn = jest.fn()
        const error = {
          quoteId: '12345',
          errorCode: '2201',
          errorDescription: 'Test Error'
        }
        mockKnex.mockImplementationOnce(() => { throw new Error('Test Error') })

        // Act
        const action = async () => database.createQuoteError(txn, error)

        // Assert
        await expect(action()).rejects.toThrowError('Test Error')
      })
    })

    describe('getIsMigrationLocked', () => {
      it('gets the migration lock status when the database is locked', async () => {
        // Arrange
        const mockList = mockKnexBuilder(mockKnex, { isLocked: true }, ['orderBy', 'first', 'select'])

        // Act
        const result = await database.getIsMigrationLocked()

        // Assert
        expect(result).toBe(true)
        expect(mockList[0]).toHaveBeenCalledWith('migration_lock')
        expect(mockList[1]).toHaveBeenCalledWith('index', 'desc')
        expect(mockList[2]).toHaveBeenCalledTimes(1)
        expect(mockList[3]).toHaveBeenCalledWith('is_locked AS isLocked')
      })
    })

    describe('createFxQuote', () => {
      it('creates a new fxQuote', async () => {
        // Arrange
        const txn = jest.fn()
        const conversionRequestId = '12345'
        const mockList = mockKnexBuilder(mockKnex, ['1'], ['transacting', 'insert'])
        const expected = {
          conversionRequestId,
          fxQuoteId: '1'
        }

        // Act
        const result = await database.createFxQuote(txn, conversionRequestId)

        // Assert
        expect(result).toStrictEqual(expected)
        expect(mockList[0]).toHaveBeenCalledWith('fxQuote')
        expect(mockList[1]).toHaveBeenCalledWith(txn)
        expect(mockList[2]).toHaveBeenCalledTimes(1)
      })

      it('handles an exception in createFxQuote', async () => {
        // Arrange
        const txn = jest.fn()
        const conversionRequestId = '12345'
        mockKnex.mockImplementationOnce(() => { throw new Error('Test Error') })

        // Act
        const action = async () => database.createFxQuote(txn, conversionRequestId)

        // Assert
        await expect(action()).rejects.toThrowError('Test Error')
      })
    })

    describe('createFxQuoteResponse', () => {
      it('creates a new fxQuoteResponse', async () => {
        // Arrange
        const txn = jest.fn()
        const conversionRequestId = '12345'
        const fxQuoteResponse = {
          condition: 'HOr22-H3AfTDHrSkPjJtVPRdKouuMkDXTR4ejlQa8Ks'
        }
        const mockList = mockKnexBuilder(mockKnex, ['1'], ['transacting', 'insert'])
        const expected = {
          conversionRequestId,
          fxQuoteResponseId: '1',
          ilpCondition: fxQuoteResponse.condition
        }

        // Act
        const result = await database.createFxQuoteResponse(txn, conversionRequestId, fxQuoteResponse)

        // Assert
        expect(result).toStrictEqual(expected)
        expect(mockList[0]).toHaveBeenCalledWith('fxQuoteResponse')
        expect(mockList[1]).toHaveBeenCalledWith(txn)
        expect(mockList[2]).toHaveBeenCalledTimes(1)
      })

      it('handles an exception in createFxQuoteResponse', async () => {
        // Arrange
        const txn = jest.fn()
        const conversionRequestId = '12345'
        const fxQuoteResponse = {
          condition: 'HOr22-H3AfTDHrSkPjJtVPRdKouuMkDXTR4ejlQa8Ks'
        }
        mockKnex.mockImplementationOnce(() => { throw new Error('Test Error') })

        // Act
        const action = async () => database.createFxQuoteResponse(txn, conversionRequestId, fxQuoteResponse)

        // Assert
        await expect(action()).rejects.toThrowError('Test Error')
      })
    })

    describe('createFxQuoteError', () => {
      it('creates a new fxQuoteError', async () => {
        // Arrange
        const txn = jest.fn()
        const conversionRequestId = '12345'
        const error = {
          errorCode: '2201',
          errorDescription: 'Test Error'
        }
        const mockList = mockKnexBuilder(mockKnex, ['1'], ['transacting', 'insert'])
        const expected = {
          conversionRequestId,
          fxQuoteErrorId: '1',
          errorCode: error.errorCode,
          errorDescription: error.errorDescription
        }

        // Act
        const result = await database.createFxQuoteError(txn, conversionRequestId, error)

        // Assert
        expect(result).toStrictEqual(expected)
        expect(mockList[0]).toHaveBeenCalledWith('fxQuoteError')
        expect(mockList[1]).toHaveBeenCalledWith(txn)
        expect(mockList[2]).toHaveBeenCalledTimes(1)
      })

      it('handles an exception in createFxQuoteError', async () => {
        // Arrange
        const txn = jest.fn()
        const conversionRequestId = '12345'
        const error = {
          errorCode: '2201',
          errorDescription: 'Test Error'
        }
        mockKnex.mockImplementationOnce(() => { throw new Error('Test Error') })

        // Act
        const action = async () => database.createFxQuoteError(txn, conversionRequestId, error)

        // Assert
        await expect(action()).rejects.toThrowError('Test Error')
      })
    })

    describe('createFxQuoteDuplicateCheck', () => {
      it('creates a new fxQuoteDuplicateCheck', async () => {
        // Arrange
        const txn = jest.fn()
        const conversionRequestId = '12345'
        const hash = 'mock_hash'
        const mockList = mockKnexBuilder(mockKnex, ['1'], ['transacting', 'insert'])
        const expected = {
          conversionRequestId,
          fxQuoteDuplicateCheckId: '1',
          hash
        }

        // Act
        const result = await database.createFxQuoteDuplicateCheck(txn, conversionRequestId, hash)

        // Assert
        expect(result).toStrictEqual(expected)
        expect(mockList[0]).toHaveBeenCalledWith('fxQuoteDuplicateCheck')
        expect(mockList[1]).toHaveBeenCalledWith(txn)
        expect(mockList[2]).toHaveBeenCalledTimes(1)
      })

      it('handles an exception in createFxQuoteDuplicateCheck', async () => {
        // Arrange
        const txn = jest.fn()
        const conversionRequestId = '12345'
        const hash = 'mock_hash'
        mockKnex.mockImplementationOnce(() => { throw new Error('Test Error') })

        // Act
        const action = async () => database.createFxQuoteDuplicateCheck(txn, conversionRequestId, hash)

        // Assert
        await expect(action()).rejects.toThrowError('Test Error')
      })
    })

    describe('createFxQuoteResponseDuplicateCheck', () => {
      it('creates a new fxQuoteResponseDuplicateCheck', async () => {
        // Arrange
        const txn = jest.fn()
        const fxQuoteResponseId = '12345'
        const conversionRequestId = '67890'
        const hash = 'mock_hash'
        const mockList = mockKnexBuilder(mockKnex, ['1'], ['transacting', 'insert'])
        const expected = {
          fxQuoteResponseId,
          conversionRequestId,
          fxQuoteResponseDuplicateCheckId: '1',
          hash
        }

        // Act
        const result = await database.createFxQuoteResponseDuplicateCheck(txn, fxQuoteResponseId, conversionRequestId, hash)

        // Assert
        expect(result).toStrictEqual(expected)
        expect(mockList[0]).toHaveBeenCalledWith('fxQuoteResponseDuplicateCheck')
        expect(mockList[1]).toHaveBeenCalledWith(txn)
        expect(mockList[2]).toHaveBeenCalledTimes(1)
      })

      it('handles an exception in createFxQuoteResponseDuplicateCheck', async () => {
        // Arrange
        const txn = jest.fn()
        const fxQuoteResponseId = '12345'
        const conversionRequestId = '67890'
        const hash = 'mock_hash'
        mockKnex.mockImplementationOnce(() => { throw new Error('Test Error') })

        // Act
        const action = async () => database.createFxQuoteResponseDuplicateCheck(txn, fxQuoteResponseId, conversionRequestId, hash)

        // Assert
        await expect(action()).rejects.toThrowError('Test Error')
      })
    })

    describe('createFxQuoteConversionTerms', () => {
      beforeEach(() => {
        database.getAmountType = jest.fn().mockResolvedValueOnce('55')
      })

      it('creates a new fxQuoteConversionTerms', async () => {
        // Arrange
        const txn = jest.fn()
        const conversionRequestId = '12345'
        const conversionTerms = {
          conversionId: '67890',
          determiningTransferId: 'transferId',
          initiatingFsp: 'initiatingFsp',
          counterPartyFsp: 'counterPartyFsp',
          amountType: 'amountType',
          sourceAmount: {
            amount: '100',
            currency: 'USD'
          },
          targetAmount: {
            amount: '99',
            currency: 'USD'
          },
          expiration: '2019-05-27T15:44:53.292Z'
        }

        const mockList = mockKnexBuilder(mockKnex, ['1'], ['transacting', 'insert'])
        const expected = {
          conversionRequestId,
          conversionId: '1',
          determiningTransferId: conversionTerms.determiningTransferId,
          initiatingFsp: conversionTerms.initiatingFsp,
          counterPartyFsp: conversionTerms.counterPartyFsp,
          amountTypeId: '55',
          sourceAmount: conversionTerms.sourceAmount.amount,
          sourceCurrency: conversionTerms.sourceAmount.currency,
          targetAmount: conversionTerms.targetAmount.amount,
          targetCurrency: conversionTerms.targetAmount.currency,
          expirationDate: new Date(conversionTerms.expiration)
        }

        // Act
        const result = await database.createFxQuoteConversionTerms(txn, conversionRequestId, conversionTerms)

        // Assert
        expect(result).toStrictEqual(expected)
        expect(mockList[0]).toHaveBeenCalledWith('fxQuoteConversionTerms')
        expect(mockList[1]).toHaveBeenCalledWith(txn)
        expect(mockList[2]).toHaveBeenCalledTimes(1)
      })

      it('handles an exception in createFxQuoteConversionTerms', async () => {
        // Arrange
        const txn = jest.fn()
        const conversionRequestId = '12345'
        const conversionTerms = {
          conversionId: '67890',
          determiningTransferId: 'transferId',
          initiatingFsp: 'initiatingFsp',
          counterPartyFsp: 'counterPartyFsp',
          amountType: 'amountType',
          sourceAmount: {
            amount: '100',
            currency: 'USD'
          },
          targetAmount: {
            amount: '99',
            currency: 'USD'
          },
          expiration: '2019-05-27T15:44:53.292Z'
        }
        mockKnex.mockImplementationOnce(() => { throw new Error('Test Error') })

        // Act
        const action = async () => database.createFxQuoteConversionTerms(txn, conversionRequestId, conversionTerms)

        // Assert
        await expect(action()).rejects.toThrowError('Test Error')
      })
    })

    describe('createFxQuoteResponseFxCharge', () => {
      it('creates a new fxCharge', async () => {
        // Arrange
        const txn = jest.fn()
        const conversionId = '12345'
        const charges = [
          {
            chargeType: 'chargeType1',
            sourceAmount: {
              amount: '100',
              currency: 'USD'
            },
            targetAmount: {
              amount: '99',
              currency: 'USD'
            }
          },
          {
            chargeType: 'chargeType2',
            sourceAmount: {
              amount: '200',
              currency: 'USD'
            },
            targetAmount: {
              amount: '198',
              currency: 'USD'
            }
          }
        ]
        const mockList = mockKnexBuilder(mockKnex, ['1', '2'], ['transacting', 'insert'])
        const expected = ['1', '2']

        // Act
        const result = await database.createFxQuoteResponseFxCharge(txn, conversionId, charges)

        // Assert
        expect(result).toStrictEqual(expected)
        expect(mockList[0]).toHaveBeenCalledWith('fxCharge')
        expect(mockList[1]).toHaveBeenCalledWith(txn)
        expect(mockList[2]).toHaveBeenCalledTimes(1)
      })

      it('handles an exception in createFxQuoteResponseFxCharge', async () => {
        // Arrange
        const txn = jest.fn()
        const conversionId = '12345'
        const charges = [
          {
            chargeType: 'chargeType1',
            sourceAmount: {
              amount: '100',
              currency: 'USD'
            },
            targetAmount: {
              amount: '99',
              currency: 'USD'
            }
          },
          {
            chargeType: 'chargeType2',
            sourceAmount: {
              amount: '200',
              currency: 'USD'
            },
            targetAmount: {
              amount: '198',
              currency: 'USD'
            }
          }
        ]
        mockKnex.mockImplementationOnce(() => { throw new Error('Test Error') })

        // Act
        const action = async () => database.createFxQuoteResponseFxCharge(txn, conversionId, charges)

        // Assert
        await expect(action()).rejects.toThrowError('Test Error')
      })
    })

    describe('createFxQuoteConversionTermsExtension', () => {
      it('creates a new fxQuoteConversionTermsExtension', async () => {
        // Arrange
        const txn = jest.fn()
        const conversionId = '12345'
        const conversionTermsExtension = [
          {
            key: 'key1',
            value: 'value1'
          },
          {
            key: 'key2',
            value: 'value2'
          }
        ]
        const mockList = mockKnexBuilder(mockKnex, ['1', '2'], ['transacting', 'insert'])
        const expected = ['1', '2']

        // Act
        const result = await database.createFxQuoteConversionTermsExtension(txn, conversionId, conversionTermsExtension)

        // Assert
        expect(result).toStrictEqual(expected)
        expect(mockList[0]).toHaveBeenCalledWith('fxQuoteConversionTermsExtension')
        expect(mockList[1]).toHaveBeenCalledWith(txn)
        expect(mockList[2]).toHaveBeenCalledTimes(1)
      })

      it('handles an exception in createFxQuoteConversionTermsExtension', async () => {
        // Arrange
        const txn = jest.fn()
        const conversionId = '12345'
        const conversionTermsExtension = [
          {
            key: 'key1',
            value: 'value1'
          },
          {
            key: 'key2',
            value: 'value2'
          }
        ]
        mockKnex.mockImplementationOnce(() => { throw new Error('Test Error') })

        // Act
        const action = async () => database.createFxQuoteConversionTermsExtension(txn, conversionId, conversionTermsExtension)

        // Assert
        await expect(action()).rejects.toThrowError('Test Error')
      })
    })

    describe('createFxQuoteResponseConversionTerms', () => {
      beforeEach(() => {
        database.getAmountType = jest.fn().mockResolvedValueOnce('55')
      })

      it('creates a new fxQuoteResponseConversionTerms', async () => {
        // Arrange
        const txn = jest.fn()
        const conversionRequestId = '12345'
        const fxQuoteResponseId = '67890'
        const conversionTerms = {
          conversionId: '54321',
          determiningTransferId: 'transferId',
          initiatingFsp: 'initiatingFsp',
          counterPartyFsp: 'counterPartyFsp',
          amountType: 'amountType',
          sourceAmount: {
            amount: '100',
            currency: 'USD'
          },
          targetAmount: {
            amount: '99',
            currency: 'USD'
          },
          expiration: '2019-05-27T15:44:53.292Z'
        }
        const mockList = mockKnexBuilder(mockKnex, ['1'], ['transacting', 'insert'])
        const expected = {
          fxQuoteResponseConversionTermsId: '1',
          conversionRequestId,
          fxQuoteResponseId,
          conversionId: '54321',
          determiningTransferId: conversionTerms.determiningTransferId,
          initiatingFsp: conversionTerms.initiatingFsp,
          counterPartyFsp: conversionTerms.counterPartyFsp,
          amountTypeId: '55',
          sourceAmount: conversionTerms.sourceAmount.amount,
          sourceCurrency: conversionTerms.sourceAmount.currency,
          targetAmount: conversionTerms.targetAmount.amount,
          targetCurrency: conversionTerms.targetAmount.currency,
          expirationDate: new Date(conversionTerms.expiration)
        }

        // Act
        const result = await database.createFxQuoteResponseConversionTerms(txn, conversionRequestId, fxQuoteResponseId, conversionTerms)

        // Assert
        expect(result).toStrictEqual(expected)
        expect(mockList[0]).toHaveBeenCalledWith('fxQuoteResponseConversionTerms')
        expect(mockList[1]).toHaveBeenCalledWith(txn)
        expect(mockList[2]).toHaveBeenCalledTimes(1)
      })

      it('handles an exception in createFxQuoteResponseConversionTerms', async () => {
        // Arrange
        const txn = jest.fn()
        const conversionRequestId = '12345'
        const fxQuoteResponseId = '67890'
        const conversionTerms = {
          conversionId: '54321',
          determiningTransferId: 'transferId',
          initiatingFsp: 'initiatingFsp',
          counterPartyFsp: 'counterPartyFsp',
          amountType: 'amountType',
          sourceAmount: {
            amount: '100',
            currency: 'USD'
          },
          targetAmount: {
            amount: '99',
            currency: 'USD'
          },
          expiration: '2019-05-27T15:44:53.292Z'
        }
        mockKnex.mockImplementationOnce(() => { throw new Error('Test Error') })

        // Act
        const action = async () => database.createFxQuoteResponseConversionTerms(txn, conversionRequestId, fxQuoteResponseId, conversionTerms)

        // Assert
        await expect(action()).rejects.toThrowError('Test Error')
      })
    })

    describe('createFxQuoteResponseConversionTermsExtension', () => {
      it('creates a new fxQuoteResponseConversionTermsExtension', async () => {
        // Arrange
        const txn = jest.fn()
        const conversionId = '12345'
        const conversionTermsExtension = [
          {
            key: 'key1',
            value: 'value1'
          },
          {
            key: 'key2',
            value: 'value2'
          }
        ]
        const mockList = mockKnexBuilder(mockKnex, ['1', '2'], ['transacting', 'insert'])
        const expected = ['1', '2']

        // Act
        const result = await database.createFxQuoteResponseConversionTermsExtension(txn, conversionId, conversionTermsExtension)

        // Assert
        expect(result).toStrictEqual(expected)
        expect(mockList[0]).toHaveBeenCalledWith('fxQuoteResponseConversionTermsExtension')
        expect(mockList[1]).toHaveBeenCalledWith(txn)
        expect(mockList[2]).toHaveBeenCalledTimes(1)
      })

      it('handles an exception in createFxQuoteResponseConversionTermsExtension', async () => {
        // Arrange
        const txn = jest.fn()
        const conversionId = '12345'
        const conversionTermsExtension = [
          {
            key: 'key1',
            value: 'value1'
          },
          {
            key: 'key2',
            value: 'value2'
          }
        ]
        mockKnex.mockImplementationOnce(() => { throw new Error('Test Error') })

        // Act
        const action = async () => database.createFxQuoteResponseConversionTermsExtension(txn, conversionId, conversionTermsExtension)

        // Assert
        await expect(action()).rejects.toThrowError('Test Error')
      })
    })

    describe('getFxQuoteDuplicateCheck', () => {
      it('gets the fxQuote duplicate check', async () => {
        // Arrange
        const conversionRequestId = '12345'
        const expected = {
          conversionRequestId,
          fxQuoteDuplicateCheckId: '1',
          hash: 'mock_hash'
        }
        mockKnexBuilder(
          mockKnex,
          { ...expected },
          ['where', 'first']
        )

        // Act
        const result = await database.getFxQuoteDuplicateCheck(conversionRequestId)

        // Assert
        expect(result).toStrictEqual(expected)
      })

      it('returns null when fxQuote duplicate check is not found', async () => {
        // Arrange
        const conversionRequestId = '12345'
        mockKnexBuilder(
          mockKnex,
          null,
          ['where', 'first']
        )

        // Act
        const result = await database.getFxQuoteDuplicateCheck(conversionRequestId)

        // Assert
        expect(result).toBeNull()
      })

      it('handles an exception in getFxQuoteDuplicateCheck', async () => {
        // Arrange
        const conversionRequestId = '12345'
        mockKnex.mockImplementationOnce(() => { throw new Error('Test Error') })

        // Act
        const action = async () => database.getFxQuoteDuplicateCheck(conversionRequestId)

        // Assert
        await expect(action()).rejects.toThrowError('Test Error')
      })
    })

    describe('getFxQuoteResponseDuplicateCheck', () => {
      it('gets the fxQuoteResponse duplicate check', async () => {
        // Arrange
        const conversionRequestId = '12345'
        const expected = {
          conversionRequestId,
          fxQuoteResponseDuplicateCheckId: '1',
          hash: 'mock_hash'
        }
        mockKnexBuilder(
          mockKnex,
          { ...expected },
          ['where', 'first']
        )

        // Act
        const result = await database.getFxQuoteResponseDuplicateCheck(conversionRequestId)

        // Assert
        expect(result).toStrictEqual(expected)
      })

      it('returns null when fxQuoteResponse duplicate check is not found', async () => {
        // Arrange
        const conversionRequestId = '12345'
        mockKnexBuilder(
          mockKnex,
          null,
          ['where', 'first']
        )

        // Act
        const result = await database.getFxQuoteResponseDuplicateCheck(conversionRequestId)

        // Assert
        expect(result).toBeNull()
      })

      it('handles an exception in getFxQuoteResponseDuplicateCheck', async () => {
        // Arrange
        const conversionRequestId = '12345'
        mockKnex.mockImplementationOnce(() => { throw new Error('Test Error') })

        // Act
        const action = async () => database.getFxQuoteResponseDuplicateCheck(conversionRequestId)

        // Assert
        await expect(action()).rejects.toThrowError('Test Error')
      })
    })
  })
})
