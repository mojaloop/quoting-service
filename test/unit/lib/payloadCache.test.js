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

 --------------
 ******/

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

  test('should handle error when connection config type is not supported', async () => {
    const type = 'unsupported'
    const randomConfig = { ...connectionConfig, cluster: [{ host: 'random_host', port: 1234 }] }
    expect(() => createPayloadCache(type, randomConfig)).toThrowError('ERROR_MESSAGES.unsupportedPayloadCacheType')
  })
})
