jest.mock('../../../src/lib/config')

const { responseCode } = require('@mojaloop/central-services-shared').HealthCheck.HealthCheckEnums
const { baseMockRequest } = require('../../util/helper')
const mockContext = jest.fn()

describe('/metrics', () => {
  describe('GET success', () => {
    let code
    let handler

    beforeEach(() => {
      jest.mock('@mojaloop/central-services-metrics', () => ({
        getMetricsForPrometheus: () => ({})
      }))

      handler = {
        response: jest.fn(() => ({
          code
        }))
      }
    })

    afterEach(() => {
      jest.clearAllMocks()
    })

    it('returns a 200 response code', async () => {
      // Arrange
      code = jest.fn()
      const MetricsHandlerProxy = require('../../../src/handlers/metrics')

      // Act
      await MetricsHandlerProxy.get(mockContext, { ...baseMockRequest }, handler)

      // Assert
      expect(code).toHaveBeenCalledWith(responseCode.success)
    })
  })
})
