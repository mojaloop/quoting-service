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

 * Infitx
 - Steven Oderayi <steven.oderayi@infitx.com>
--------------
******/
const Hapi = require('@hapi/hapi')
const Logger = require('@mojaloop/central-services-logger')
const Metrics = require('@mojaloop/central-services-metrics')
const Config = require('../lib/config')
const { plugin: HealthPlugin } = require('./plugins/health')
const { version } = require('../../package.json')

const config = new Config()

const initializeInstrumentation = (config) => {
  /* istanbul ignore next */
  if (!config.instrumentationMetricsDisabled) {
    if (config.instrumentationMetricsConfig) {
      config.instrumentationMetricsConfig.defaultLabels.serviceVersion = version
    }
    Metrics.setup(config.instrumentationMetricsConfig)
  }
}

const createMonitoringServer = async (port, consumersMap, db) => {
  initializeInstrumentation(config)

  const server = new Hapi.Server({
    port
  })

  server.app.db = db
  server.app.consumersMap = consumersMap

  await server.register([HealthPlugin, !config.instrumentationMetricsDisabled && Metrics.plugin].filter(Boolean))
  await server.start()

  Logger.info(`Monitoring server running at: ${server.info.uri}`)

  return server
}

module.exports = {
  createMonitoringServer,
  initializeInstrumentation
}
