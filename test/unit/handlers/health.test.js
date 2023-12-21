const { HealthCheck, HealthCheckEnums } = require('@mojaloop/central-services-shared').HealthCheck
const health = require('../../../src/handlers/health')

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
