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
*****/

'use strict'

const Database = require('./database')
const { logger } = require('../lib/')
const libUtil = require('../lib/util')

/**
 * Test-specific database operations extending the base Database class
 */
class TestDatabase extends Database {
  constructor (config, log, queryBuilder) {
    super(config, log || logger.child({ component: 'TestDatabase' }), queryBuilder)
  }

  /**
   * Gets the complete quote by quoteId
   *
   * @returns {promise} - quote object or null if not found
   */
  async getQuote (quoteId) {
    try {
      const rows = await this.queryBuilder('quote')
        .where('quoteId', quoteId)
        .select()

      if ((!rows) || rows.length < 1) {
        return null
      }

      return rows[0]
    } catch (err) {
      this.log.error('Error in getQuote:', err)
      libUtil.rethrowDatabaseError(err)
    }
  }

  /**
   * Gets the complete quote response by quoteId
   *
   * @returns {promise} - quote response object or null if not found
   */
  async getQuoteResponse (quoteId) {
    try {
      const rows = await this.queryBuilder('quoteResponse')
        .where('quoteId', quoteId)
        .select()

      if ((!rows) || rows.length < 1) {
        return null
      }

      return rows[0]
    } catch (err) {
      this.log.error('Error in getQuoteResponse:', err)
      libUtil.rethrowDatabaseError(err)
    }
  }

  /**
    * Gets all quote parties for a given quoteId
    *
    * @returns {promise} - array of quote party objects or empty array if none found
    */
  async getQuoteParties (quoteId) {
    try {
      const rows = await this.queryBuilder('quoteParty')
        .where('quoteId', quoteId)
        .select()

      return rows || []
    } catch (err) {
      this.log.error('Error in getQuoteParties:', err)
      libUtil.rethrowDatabaseError(err)
    }
  }

  /**
    * Gets party information by quotePartyId
    *
    * @returns {promise} - party object or null if not found
    */
  async getParty (quotePartyId) {
    try {
      const rows = await this.queryBuilder('party')
        .where('quotePartyId', quotePartyId)
        .select()

      if ((!rows) || rows.length < 1) {
        return null
      }

      return rows[0]
    } catch (err) {
      this.log.error('Error in getParty:', err)
      libUtil.rethrowDatabaseError(err)
    }
  }

  /**
    * Gets transaction reference by quoteId
    *
    * @returns {promise} - transaction reference object or null if not found
    */
  async getTransactionReference (quoteId) {
    try {
      const rows = await this.queryBuilder('transactionReference')
        .where('quoteId', quoteId)
        .select()

      if ((!rows) || rows.length < 1) {
        return null
      }

      return rows[0]
    } catch (err) {
      this.log.error('Error in getTransactionReference:', err)
      libUtil.rethrowDatabaseError(err)
    }
  }

  /**
   * Gets quote extensions by quoteId
   *
   * @returns {promise} - array of extension objects or empty array if none found
   */
  async getQuoteExtensions (quoteId) {
    try {
      const rows = await this.queryBuilder('quoteExtension')
        .where('quoteId', quoteId)
        .select()

      return rows || []
    } catch (err) {
      this.log.error('Error in getQuoteExtensions:', err)
      libUtil.rethrowDatabaseError(err)
    }
  }

  /**
   * Gets the ILP packet for a quote response
   *
   * @returns {promise} - ILP packet value or null if not found
   */
  async getQuoteResponseIlpPacket (quoteResponseId) {
    try {
      const rows = await this.queryBuilder('quoteResponseIlpPacket')
        .where('quoteResponseId', quoteResponseId)
        .select()

      if ((!rows) || rows.length < 1) {
        return null
      }

      return rows[0].value
    } catch (err) {
      this.log.error('Error in getQuoteResponseIlpPacket:', err)
      libUtil.rethrowDatabaseError(err)
    }
  }
}

module.exports = TestDatabase
