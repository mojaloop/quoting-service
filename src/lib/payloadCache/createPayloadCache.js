const { logger } = require('../../lib')
const PayloadCache = require('./PayloadCache')
const PayloadCacheError = require('./errors')
const { CACHE_TYPES } = require('./constants')

const createPayloadCache = (type, connectionConfig) => {
  switch (type) {
    case CACHE_TYPES.redis: {
      return new PayloadCache(connectionConfig)
    }
    case CACHE_TYPES.redisCluster: {
      return new PayloadCache(connectionConfig)
    }
    default: {
      const error = PayloadCacheError.unsupportedPayloadCacheType()
      logger.warn(error.message, connectionConfig)
      throw error
    }
  }
}

module.exports = createPayloadCache
