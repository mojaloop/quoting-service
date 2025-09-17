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

// Mock RedisCache for testing - no need for actual IoRedis

class MockRedisCache {
  constructor (logger, connectionConfig) {
    // Ensure we have logger methods with jest.fn() for test compatibility
    this.log = logger || {
      debug: jest.fn ? jest.fn() : () => {},
      warn: jest.fn ? jest.fn() : () => {},
      error: jest.fn ? jest.fn() : () => {},
      info: jest.fn ? jest.fn() : () => {}
    }
    // If logger is passed but doesn't have all methods, add them
    if (this.log && typeof this.log === 'object') {
      this.log.debug = this.log.debug || (jest.fn ? jest.fn() : () => {})
      this.log.warn = this.log.warn || (jest.fn ? jest.fn() : () => {})
      this.log.error = this.log.error || (jest.fn ? jest.fn() : () => {})
      this.log.info = this.log.info || (jest.fn ? jest.fn() : () => {})
    }
    this.connectionConfig = connectionConfig
    this.isConnected = false
    this.client = null
    this.storage = new Map()
    this.timers = new Map()
  }

  async connect () {
    if (!this.isConnected) {
      // Just set connected to true - no actual Redis connection needed
      this.isConnected = true
    }
    return true
  }

  async disconnect () {
    this.isConnected = false
    this.storage.clear()
    // Clear any pending timers
    for (const timer of this.timers.values()) {
      clearTimeout(timer)
    }
    this.timers.clear()
    return true
  }

  async set (key, value, ttl) {
    // Clear existing timer if any
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key))
      this.timers.delete(key)
    }

    this.storage.set(key, value)
    if (ttl) {
      const timer = setTimeout(() => {
        this.storage.delete(key)
        this.timers.delete(key)
      }, ttl * 1000)
      this.timers.set(key, timer)
    }
    return 'OK'
  }

  async get (key) {
    return this.storage.get(key) || null
  }

  async del (key) {
    return this.storage.delete(key) ? 1 : 0
  }

  async exists (key) {
    return this.storage.has(key) ? 1 : 0
  }

  async expire (key, seconds) {
    if (this.storage.has(key)) {
      // Clear existing timer if any
      if (this.timers.has(key)) {
        clearTimeout(this.timers.get(key))
      }

      const timer = setTimeout(() => {
        this.storage.delete(key)
        this.timers.delete(key)
      }, seconds * 1000)
      this.timers.set(key, timer)
      return 1
    }
    return 0
  }

  async ttl (key) {
    return this.storage.has(key) ? -1 : -2
  }

  async ping () {
    return 'PONG'
  }
}

module.exports = MockRedisCache
