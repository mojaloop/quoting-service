const { createMonitoringServer } = require('../../../src/handlers/monitoringServer')
const { HealthCheckEnums } = require('@mojaloop/central-services-shared').HealthCheck

describe('Monitoring Server', () => {
  let server
  let consumersMap
  let db
  let isKafkaConnected = true

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
    server = await createMonitoringServer(4000, consumersMap, db)
  })

  afterAll(async () => {
    await server.stop()
  })

  describe('createMonitoringServer', () => {
    it('should return OK status if consumer is connected', async () => {
      isKafkaConnected = true
      const res = await server.inject({
        method: 'GET',
        url: '/health'
      })
      expect(res.statusCode).toBe(200)
      expect(res.result.status).toBe(HealthCheckEnums.statusEnum.OK)
    })

    it('should return DOWN status if consumer is not connected', async () => {
      isKafkaConnected = false
      const res = await server.inject({
        method: 'GET',
        url: '/health'
      })
      expect(res.statusCode).toBe(502)
      expect(res.result.status).toBe(HealthCheckEnums.statusEnum.DOWN)
    })

    it('should return metrics and correct response code', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/metrics'
      })
      expect(res.statusCode).toBe(200)
      expect(res.result).toEqual(expect.stringContaining('process_cpu_user_seconds_total'))
    })
  })
})
