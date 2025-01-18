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

 * Henk Kodde <henk.kodde@modusbox.com>
 * Georgi Georgiev <georgi.georgiev@modusbox.com>
 --------------
 ******/

const Database = require('./database.js')
const Cache = require('memory-cache').Cache
const Metrics = require('@mojaloop/central-services-metrics')

const util = require('../lib/util')
const { logger } = require('../lib/')

/**
 * An extension of the Database class that caches enum values in memory
 */
class CachedDatabase extends Database {
  constructor (config, log) {
    super(config)
    this.log = log || logger.child({
      context: this.constructor.name
    })
    this.cache = new Cache()
  }

  /*
    * The following enum lookup functions override those in the superclass with
    * versions that use an in-memory cache.
    */

  async getInitiatorType (initiatorType) {
    return this.getCacheValue('getInitiatorType', [initiatorType])
  }

  async getInitiator (initiator) {
    return this.getCacheValue('getInitiator', [initiator])
  }

  async getScenario (scenario) {
    return this.getCacheValue('getScenario', [scenario])
  }

  async getSubScenario (subScenario) {
    return this.getCacheValue('getSubScenario', [subScenario])
  }

  async getAmountType (amountType) {
    return this.getCacheValue('getAmountType', [amountType])
  }

  async getPartyType (partyType) {
    return this.getCacheValue('getPartyType', [partyType])
  }

  async getPartyIdentifierType (partyIdentifierType) {
    return this.getCacheValue('getPartyIdentifierType', [partyIdentifierType])
  }

  async getParticipant (participantName, participantType, currencyId, ledgerAccountTypeId) {
    return this.getCacheValue('getParticipant', [participantName, participantType, currencyId, ledgerAccountTypeId])
  }

  async getParticipantByName (participantName, participantType) {
    return this.getCacheValue('getParticipantByName', [participantName, participantType])
  }

  async getTransferParticipantRoleType (name) {
    return this.getCacheValue('getTransferParticipantRoleType', [name])
  }

  async getLedgerEntryType (name) {
    return this.getCacheValue('getLedgerEntryType', [name])
  }

  async getParticipantEndpoint (participantName, endpointType) {
    return this.getCacheValue('getParticipantEndpoint', [participantName, endpointType])
  }

  async getCacheValue (type, params) {
    const histTimer = Metrics.getHistogram(
      'database_get_cache_value',
      'database_getCacheValue - Metrics for database cache',
      ['success', 'queryName', 'hit']
    ).startTimer()
    try {
      let value = this.cacheGet(type, params)

      if (!value) {
        // we need to get the value from the db and cache it
        this.log.debug('Cache miss for: ', { type, params })
        value = await super[type].apply(this, params)
        // cache participant with a shorter TTL than enums (participant data is more likely to change)
        if (
          type === 'getParticipant' ||
          type === 'getParticipantByName' ||
          type === 'getParticipantEndpoint'
        ) {
          this.cachePut(type, params, value, this.config.participantDataCacheExpiresInMs)
        } else {
          this.cachePut(type, params, value, this.config.enumDataCacheExpiresInMs)
        }
        histTimer({ success: true, queryName: type, hit: false })
      } else {
        this.log.debug('Cache hit for : ', { type, params, value })
        histTimer({ success: true, queryName: type, hit: true })
      }

      return value
    } catch (err) {
      this.log.error('Error in getCacheValue: ', err)
      histTimer({ success: false, queryName: type, hit: false })
      util.rethrowCachedDatabaseError(err)
    }
  }

  /**
     * Adds or replaces a value in the cache.
     *
     * @returns {undefined}
     */
  cachePut (type, params, value, ttl) {
    const key = this.getCacheKey(type, params)
    this.cache.put(key, value, ttl)
  }

  /**
     * Gets a value from the cache, or null if it is not present
     *
     * @returns {undefined}
     */
  cacheGet (type, params) {
    const key = this.getCacheKey(type, params)
    return this.cache.get(key)
  }

  /**
     * Calculates a cache key for the given type and parameters
     *
     * @returns {undefined}
     */
  getCacheKey (type, params) {
    return `${type}_${params.join('__')}`
  }

  invalidateCache () {
    this.cache.clear()
  }
}

module.exports = CachedDatabase
