
const util = require('util');
const Database = require('./database.js');
const Cache = require('memory-cache').Cache;


const DEFAULT_TTL_SECONDS = 60;

/**
 * An extension of the Database class that caches enum values in memory
 */
class CachedDatabase extends Database {
    constructor(config) {
        super(config);
    
        this.cache = new Cache();
    }


    /*
    * The following enum lookup functions override those in the superclass with
    * versions that use an in-memory cache.
    */

    async getInitiatorType(initiatorType) {
        return this.getCacheValue('getInitiatorType', [initiatorType]);
    }

    async getInitiator(initiator) {
        return this.getCacheValue('getInitiator', [initiator]);
    }

    async getScenario(scenario) {
        return this.getCacheValue('getScenario', [scenario]);
    }

    async getSubScenario(subScenario) {
        return this.getCacheValue('getSubScenario', [subScenario]);
    }

    async getAmountType(amountType) {
        return this.getCacheValue('getAmountType', [amountType]);
    }

    async getPartyType(partyType) {
        return this.getCacheValue('getPartyType', [partyType]);
    }

    async getPartyIdentifierType(partyIdentifierType) {
        return this.getCacheValue('getPartyIdentifierType', [partyIdentifierType]);
    }

    async getParticipant(participantName) {
        return this.getCacheValue('getParticipant', [participantName]);
    }

    async getTransferParticipantRoleType(name) {
        return this.getCacheValue('getTransferParticipantRoleType', [name]);
    }

    async getLedgerEntryType(name) {
        return this.getCacheValue('getLedgerEntryType', [name]);
    }

    async getParticipantEndpoint(participantName, endpointType) {
        return this.getCacheValue('getParticipantEndpoint', [participantName, endpointType]);
    }


    async getCacheValue(type, params) {
        try {
            let value = this.cacheGet(type, params);

            if(!value) {
                //we need to get the value from the db and cache it
                this.writeLog(`Cache miss for ${type}: ${util.inspect(params)}`);
                value = await super[type].apply(this, params);
                this.cachePut(type, params, value);
            }
            else {
                this.writeLog(`Cache hit for ${type} ${util.inspect(params)}: ${value}`);
            }

            return value;
        }
        catch(err) {
            this.writeLog(`Error in getCacheValue: ${err.stack || util.inspect(err)}`);
            throw err;
        }
    }


    /**
     * Adds or replaces a value in the cache.
     *
     * @returns {undefined}
     */
    cachePut(type, params, value) {
        const key = this.getCacheKey(type, params);
        this.cache.put(key, value, (this.config.cacheTtlSeconds || DEFAULT_TTL_SECONDS) * 1000);
    }


    /**
     * Gets a value from the cache, or null if it is not present
     *
     * @returns {undefined}
     */
    cacheGet(type, params) {
        const key = this.getCacheKey(type, params);
        return this.cache.get(key);
    }


    /**
     * Calculates a cache key for the given type and parameters
     *
     * @returns {undefined}
     */
    getCacheKey(type, params) {
        return `${type}_${params.join('__')}`;
    }
}


module.exports = CachedDatabase;
