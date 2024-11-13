const MockIoRedis = require('../../MockIoRedis')
jest.mock('ioredis', () => MockIoRedis)

const { setTimeout: sleep } = require('node:timers/promises')
const { createPayloadCache, PayloadCache } = require('../../../src/lib/payloadCache')
const Config = require('../../../src/lib/config')

const config = new Config()
const { type, connectionConfig } = config.payloadCache

describe('Payload Cache Tests -->', () => {
  let cache
  const redisClient = new MockIoRedis.Cluster(connectionConfig.cluster)

  beforeEach(async () => {
    cache = createPayloadCache(type, connectionConfig)
    await Promise.all([
      cache.connect(),
      redisClient.connect()
    ])
    expect(cache.isConnected).toBe(true)
  })

  afterEach(async () => {
    await Promise.all([
      cache?.disconnect(),
      redisClient?.quit()
    ])
  })

  test('should should throw for invalid type', () => {
    expect(() => {
      createPayloadCache('invalid', connectionConfig)
    }).toThrow()
  })

  test('should create an instance of PayloadCache', () => {
    const payloadCache = createPayloadCache(type, connectionConfig)
    expect(payloadCache).toBeInstanceOf(PayloadCache)
  })

  test('should set and get sting value from the cache', async () => {
    const key = 'test_key'
    const value = JSON.stringify({ test: true })
    await cache.set(key, value)
    const cachedValue = await cache.get(key)
    expect(cachedValue).toEqual(value)
  })

  test('should set and get payload by requestId', async () => {
    const reqId = 'req_id:123'
    const payload = { test: true }
    const isSet = await cache.setPayload(reqId, payload)
    expect(isSet).toBe(true)
    const cachedValue = await cache.getPayload(reqId)
    expect(cachedValue).toBe(JSON.stringify(payload))
  })

  test('should expire cached payload after defined period', async () => {
    const ttlSec = 1
    const reqId = `req_id:${Date.now()}`
    const payload = { reqId }
    const isSet = await cache.setPayload(reqId, payload, ttlSec)
    expect(isSet).toBe(true)
    await sleep(ttlSec * 1000 * 2)

    const cached = await cache.getPayload(reqId)
    expect(cached).toBeNull()
  })
})
