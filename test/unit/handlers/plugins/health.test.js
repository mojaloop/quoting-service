/*****
LICENSE

Copyright © 2020 Mojaloop Foundation

The Mojaloop files are made available by the Mojaloop Foundation under the Apache License, Version 2.0
(the "License") and you may not use these files except in compliance with the [License](http://www.apache.org/licenses/LICENSE-2.0).

You may obtain a copy of the License at [http://www.apache.org/licenses/LICENSE-2.0](http://www.apache.org/licenses/LICENSE-2.0)

Unless required by applicable law or agreed to in writing, the Mojaloop files are distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the [License](http://www.apache.org/licenses/LICENSE-2.0).

* Infitx
* Steven Oderayi <steven.oderayi@infitx.com>
--------------
******/

'use strict'

const { HealthCheck, HealthCheckEnums } = require('@mojaloop/central-services-shared').HealthCheck
const health = require('../../../../src/handlers/plugins/health')

describe('health Tests -->', () => {
  let isKafkaConnected = true
  const mockConsumer = {
    isConnected: jest.fn(async () => isKafkaConnected)
  }
  const mockDb = {
    getIsMigrationLocked: jest.fn(async () => false)
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('createHealthCheck', () => {
    it('should return HealthCheck instance', async () => {
      const checker = health.createHealthCheck({ topic: mockConsumer }, mockDb)
      expect(checker).toBeInstanceOf(HealthCheck)
      const result = await checker.getHealth()
      expect(result.status).toBe(HealthCheckEnums.statusEnum.OK)
    })
    it('should return DOWN status if consumer is not connected', async () => {
      isKafkaConnected = false
      const checker = health.createHealthCheck({ topic: mockConsumer }, mockDb)
      const result = await checker.getHealth()
      expect(result.status).toBe(HealthCheckEnums.statusEnum.DOWN)
    })
  })

  describe('plugin', () => {
    it('should return plugin name', () => {
      expect(health.plugin.name).toEqual('Health')
    })
    it('should return plugin register', () => {
      expect(health.plugin.register).toBeInstanceOf(Function)
    })
    it('should register routes', async () => {
      const server = {
        route: jest.fn()
      }
      await health.plugin.register(server)
      expect(server.route).toHaveBeenCalledTimes(1)
      expect(server.route).toHaveBeenCalledWith([
        {
          method: 'GET',
          path: '/health',
          handler: health.handler.get
        }
      ])
    })
  })

  describe('handler', () => {
    it('should return OK status if consumer is connected', async () => {
      isKafkaConnected = true
      const request = {
        server: {
          app: {
            consumersMap: { topic: mockConsumer },
            db: mockDb
          }
        }
      }
      const reply = {
        response: jest.fn(() => ({
          code: jest.fn()
        }))
      }
      await health.handler.get(request, reply)
      expect(reply.response).toHaveBeenCalledWith(expect.objectContaining({
        status: HealthCheckEnums.statusEnum.OK
      }))
    })
    it('should return DOWN status if consumer is not connected', async () => {
      isKafkaConnected = false
      const request = {
        server: {
          app: {
            consumersMap: { topic: mockConsumer },
            db: mockDb
          }
        }
      }
      const reply = {
        response: jest.fn(() => ({
          code: jest.fn()
        }))
      }
      await health.handler.get(request, reply)
      expect(reply.response).toHaveBeenCalledWith(expect.objectContaining({
        status: HealthCheckEnums.statusEnum.DOWN
      }))
    })
  })
})
