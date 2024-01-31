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
const Hapi = require('@hapi/hapi')
const Logger = require('@mojaloop/central-services-logger')
const Metrics = require('@mojaloop/central-services-metrics')
const Config = require('../lib/config')
const { plugin: HealthPlugin } = require('./plugins/health')
const { plugin: MetricsPlugin } = require('./plugins/metrics')

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
    port
  })

  server.app.db = db
  server.app.consumersMap = consumersMap

  await server.register([HealthPlugin, MetricsPlugin])
  await server.start()

  Logger.debug(`Monitoring server running at: ${server.info.uri}`)

  return server
}

module.exports = {
  createMonitoringServer,
  initializeInstrumentation // exported for testing purposes only
}
