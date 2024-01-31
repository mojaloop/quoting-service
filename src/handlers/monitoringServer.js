const Hapi = require('@hapi/hapi')
const ErrorHandler = require('@mojaloop/central-services-error-handling')
const Logger = require('@mojaloop/central-services-logger')
const Metrics = require('@mojaloop/central-services-metrics')
const Config = require('../lib/config')
const { plugin: HealthPlugin } = require('./health')
const { plugin: MetricsPlugin } = require('./metrics')

const config = new Config()

const initializeInstrumentation = (config) => {
  /* istanbul ignore next */
  if (!config.instrumentationMetricsDisabled) {
    Metrics.setup(config.instrumentationMetricsConfig)
  }
}

const createMonitoringServer = async (port, consumersMap, db) => {
  initializeInstrumentation(config)

  const server = new Hapi.Server({
    port,
    routes: {
      validate: {
        failAction: async (_request, _h, err) => {
          throw ErrorHandler.Factory.reformatFSPIOPError(err)
        }
      },
      payload: {
        parse: true,
        output: 'stream'
      }
    }
  })

  server.app.db = db
  server.app.consumersMap = consumersMap

  await server.register([HealthPlugin, MetricsPlugin])
  await server.start()

  Logger.debug(`Monitoring server running at: ${server.info.uri}`)

  return server
}

module.exports = {
  createMonitoringServer
}
