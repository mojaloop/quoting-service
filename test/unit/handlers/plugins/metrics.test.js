const HTTPENUM = require('@mojaloop/central-services-shared').Enum.Http

jest.mock('@mojaloop/central-services-metrics')

const Metrics = require('@mojaloop/central-services-metrics')
const metrics = require('../../../../src/handlers/plugins/metrics')

describe('metrics Tests -->', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('plugin', () => {
    test('should return plugin name', () => {
      expect(metrics.plugin.name).toEqual('Metrics')
    })
    test('should return plugin register', () => {
      expect(metrics.plugin.register).toBeInstanceOf(Function)
    })
    test('should register routes', async () => {
      const server = {
        route: jest.fn()
      }
      await metrics.plugin.register(server)

      expect(server.route).toHaveBeenCalledTimes(1)
      expect(server.route).toHaveBeenCalledWith([
        {
          method: 'GET',
          path: '/metrics',
          handler: metrics.handler.get
        }
      ])
    })
  })

  describe('handler', () => {
    test('should return metrics and correct response code', async () => {
      const request = {}
      const code = jest.fn()
      const reply = {
        response: jest.fn(() => ({
          code
        }))
      }
      Metrics.getMetricsForPrometheus.mockResolvedValue('metrics')
      await metrics.handler.get(request, reply)

      expect(reply.response).toHaveBeenCalledWith('metrics')
      expect(code).toHaveBeenCalledWith(HTTPENUM.ReturnCodes.OK.CODE)
    })
  })
})
