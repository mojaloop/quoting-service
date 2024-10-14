const RedisCache = require('@mojaloop/central-services-shared/src/util/redis/redisCache')
// todo: add to Utils export
const safeStringify = require('fast-safe-stringify')

const DEFAULT_TTL_SEC = 300 // pass through config
const KEY_PREFIX = 'iso_payload' //
// todo: think, if we nee to add resource part: 'iso_payload:quote:....'

class PayloadCache extends RedisCache {
  async getPayload (requestId, parseJson = true) {
    try {
      const key = PayloadCache.formatPayloadCacheKey(requestId)
      const rawValue = await super.get(key)

      const value = (rawValue && parseJson)
        ? JSON.parse(rawValue)
        : rawValue

      this.log.debug('getPayload is done:', { key, requestId, value })
      return value
    } catch (err) {
      this.log.warn('getPayload is failed with error', err)
      return null
    }
  }

  async setPayload (requestId, payload, ttl = DEFAULT_TTL_SEC) {
    try {
      const key = PayloadCache.formatPayloadCacheKey(requestId)
      const valueString = typeof payload === 'string'
        ? payload
        : safeStringify(payload)
      const setResult = await super.set(key, valueString, ttl)

      this.log.debug('setPayload is done:', { key, requestId, setResult })
      return true
    } catch (err) {
      this.log.warn('setPayload is failed with error:', err)
      return false
    }
  }
  // todo: think, if we need deletePayload method

  static formatPayloadCacheKey (requestId) {
    // const reqIdInBase64 = Buffer.from(requestId).toString('base64url')
    return `${KEY_PREFIX}:${requestId}`
  }
}

module.exports = PayloadCache
