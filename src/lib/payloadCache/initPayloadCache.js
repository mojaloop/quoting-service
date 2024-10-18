const { PAYLOAD_STORAGES } = require('../../constants')
const { logger } = require('../logger')
const createPayloadCache = require('./createPayloadCache')

const initPayloadCache = async (config) => {
  /* istanbul ignore next */
  if (config.originalPayloadStorage === PAYLOAD_STORAGES.redis && config.payloadCache.enabled) {
    const { type, connectionConfig } = config.payloadCache
    const payloadCache = createPayloadCache(type, connectionConfig)
    await payloadCache.connect()
    logger.info('payloadCache is connected')
    return payloadCache
  } else {
    logger.info('payloadCache is NOT configured')
    return null
  }
}

module.exports = initPayloadCache
