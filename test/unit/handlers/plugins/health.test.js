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
    test('should return HealthCheck instance', async () => {
      const checker = health.createHealthCheck({ topic: mockConsumer }, mockDb)
      expect(checker).toBeInstanceOf(HealthCheck)
      const result = await checker.getHealth()
      expect(result.status).toBe(HealthCheckEnums.statusEnum.OK)
    })
    test('should return DOWN status if consumer is not connected', async () => {
      isKafkaConnected = false
      const checker = health.createHealthCheck({ topic: mockConsumer }, mockDb)
      const result = await checker.getHealth()
      expect(result.status).toBe(HealthCheckEnums.statusEnum.DOWN)
    })
  })

  describe('plugin', () => {
    test('should return plugin name', () => {
      expect(health.plugin.name).toEqual('Health')
    })
    test('should return plugin register', () => {
      expect(health.plugin.register).toBeInstanceOf(Function)
    })
    test('should register routes', async () => {
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
    test('should return OK status if consumer is connected', async () => {
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
    test('should return DOWN status if consumer is not connected', async () => {
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
