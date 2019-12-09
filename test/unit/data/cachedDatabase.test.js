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

 * Crosslake
 - Lewis Daly <lewisd@crosslaketech.com>
 --------------
 ******/

const Config = require('../../../src/lib/config')
const CachedDatabase = require('../../../src/data/cachedDatabase')

describe('cachedDatabase', () => {
  describe('getCacheMethods', () => {
    let cachedDb

    beforeEach(() => {
      const config = new Config()
      cachedDb = new CachedDatabase(config)
    })

    it('getInitiatorType', async () => {
      // Arrange
      cachedDb.cachePut('getInitiatorType', ['paramA'], 'testInitiatorTypeValue')

      // Act
      const result = await cachedDb.getInitiatorType('paramA')
      
      // Assert
      expect(result).toBe('testInitiatorTypeValue')
    })

    it('getInitiator', async () => {
      // Arrange
      cachedDb.cachePut('getInitiator', ['paramA'], 'getInitiatorValue')

      // Act
      const result = await cachedDb.getInitiator('paramA')

      // Assert
      expect(result).toBe('getInitiatorValue')
    })

    it('getScenario', async () => {
      // Arrange
      cachedDb.cachePut('getScenario', ['paramA'], 'getScenarioValue')

      // Act
      const result = await cachedDb.getScenario('paramA')

      // Assert
      expect(result).toBe('getScenarioValue')
    })

    it('getSubScenario', async () => {
      // Arrange
      cachedDb.cachePut('getSubScenario', ['paramA'], 'getSubScenarioValue')

      // Act
      const result = await cachedDb.getSubScenario('paramA')

      // Assert
      expect(result).toBe('getSubScenarioValue')
    })

    it('getAmountType', async () => {
      // Arrange
      cachedDb.cachePut('getAmountType', ['paramA'], 'getAmountTypeValue')

      // Act
      const result = await cachedDb.getAmountType('paramA')

      // Assert
      expect(result).toBe('getAmountTypeValue')
    })

    it('getPartyType', async () => {
      // Arrange
      cachedDb.cachePut('getPartyType', ['paramA'], 'getPartyTypeValue')

      // Act
      const result = await cachedDb.getPartyType('paramA')

      // Assert
      expect(result).toBe('getPartyTypeValue')
    })

    it('getPartyIdentifierType', async () => {
      // Arrange
      cachedDb.cachePut('getPartyIdentifierType', ['paramA'], 'getPartyIdentifierTypeValue')

      // Act
      const result = await cachedDb.getPartyIdentifierType('paramA')

      // Assert
      expect(result).toBe('getPartyIdentifierTypeValue')
    })

    it('getTransferParticipantRoleType', async () => {
      // Arrange
      cachedDb.cachePut('getTransferParticipantRoleType', ['paramA'], 'getTransferParticipantRoleTypeValue')

      // Act
      const result = await cachedDb.getTransferParticipantRoleType('paramA')

      // Assert
      expect(result).toBe('getTransferParticipantRoleTypeValue')
    })

    it('getLedgerEntryType', async () => {
      // Arrange
      cachedDb.cachePut('getLedgerEntryType', ['paramA'], 'getLedgerEntryTypeValue')

      // Act
      const result = await cachedDb.getLedgerEntryType('paramA')

      // Assert
      expect(result).toBe('getLedgerEntryTypeValue')
    })
  })

  describe('Cache Handling', () => {
    let cachedDb
    let Database
    let MockCachedDatabase

    beforeEach(() => {
      jest.resetModules()

      const config = new Config()
      Database = require('../../../src/data/database')
      MockCachedDatabase = require('../../../src/data/cachedDatabase')
      
      cachedDb = new MockCachedDatabase(config)
      //Override the config since mocking out the superclass causes this to break
      cachedDb.config = config
    })

    it('tries to get a value where none is cached', async () => {
      // Arrange
      // Mocking superclasses is a little tricky -- so we directly override the prototype here
      Database.prototype.getLedgerEntryType = jest.fn().mockReturnValueOnce({ ledgerEntryType: true })
      const expected = { ledgerEntryType: true }
      
      // Act
      const result = await cachedDb.getCacheValue('getLedgerEntryType', ['paramA'])
      //Result should now be cached
      const result2 = await cachedDb.getCacheValue('getLedgerEntryType', ['paramA'])
      
      // Assert
      // Check that we only called the super method once, the 2nd time should be cached
      expect(Database.prototype.getLedgerEntryType).toBeCalledTimes(1)
      expect(result).toStrictEqual(expected)
      expect(result2).toStrictEqual(expected)
    })

    it('handles an exception', async () => {
      // Arrange
      // Mocking superclasses is a little tricky -- so we directly override the prototype here
      Database.prototype.getLedgerEntryType = jest.fn().mockImplementationOnce(() => { throw new Error('Test Error')})
      const expected = { ledgerEntryType: true }
      
      // Act
      const action = async () => await cachedDb.getCacheValue('getLedgerEntryType', ['paramA'])

      
      // Assert
      await expect(action()).rejects.toThrowError('Test Error')
    })
  })
})