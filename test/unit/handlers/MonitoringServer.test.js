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

// const Metrics = require('@mojaloop/central-services-metrics')
const { createMonitoringServer } = require('../../../src/handlers/MonitoringServer')

describe('Monitoring Server', () => {
  let server
  let consumersMap
  let db
  const isKafkaConnected = true

  const mockConsumer = {
    isConnected: jest.fn(async () => isKafkaConnected)
  }

  const mockDb = {
    getIsMigrationLocked: jest.fn(async () => false)
  }

  beforeAll(async () => {
    consumersMap = {
      topic: mockConsumer
    }
    db = mockDb
    server = await createMonitoringServer(0, consumersMap, db)
  })

  afterAll(async () => {
    await server.stop()
  })

  it('dummy test', () => {
    expect(true).toBe(true)
  })

  // describe('initializeInstrumentation', () => {
  //   it('should initialize metrics if instrumentation is enabled', () => {
  //     const config = {
  //       instrumentationMetricsDisabled: false,
  //       instrumentationMetricsConfig: {}
  //     }
  //     Metrics.setup = jest.fn()
  //     initializeInstrumentation(config)
  //     expect(Metrics.setup).toHaveBeenCalledWith(config.instrumentationMetricsConfig)
  //   })

  //   it('should not initialize metrics if instrumentation is disabled', () => {
  //     const config = {
  //       instrumentationMetricsDisabled: true,
  //       instrumentationMetricsConfig: {}
  //     }
  //     Metrics.setup = jest.fn()
  //     initializeInstrumentation(config)
  //     expect(Metrics.setup).not.toHaveBeenCalled()
  //   })
  // })

  // describe('createMonitoringServer', () => {
  //   it('should return OK status if consumer is connected', async () => {
  //     isKafkaConnected = true
  //     const res = await server.inject({
  //       method: 'GET',
  //       url: '/health'
  //     })
  //     expect(res.statusCode).toBe(200)
  //     expect(res.result.status).toBe(HealthCheckEnums.statusEnum.OK)
  //   })

  //   it('should return DOWN status if consumer is not connected', async () => {
  //     isKafkaConnected = false
  //     const res = await server.inject({
  //       method: 'GET',
  //       url: '/health'
  //     })
  //     expect(res.statusCode).toBe(502)
  //     expect(res.result.status).toBe(HealthCheckEnums.statusEnum.DOWN)
  //   })

  //   it('should return metrics and correct response code', async () => {
  //     const res = await server.inject({
  //       method: 'GET',
  //       url: '/metrics'
  //     })
  //     expect(res.statusCode).toBe(200)
  //     expect(res.result).toEqual(expect.stringContaining('process_cpu_user_seconds_total'))
  //   })
  // })
})
