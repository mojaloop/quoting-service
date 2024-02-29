/*****
 LICENSE

 Copyright © 2020 Mojaloop Foundation

 The Mojaloop files are made available by the Mojaloop Foundation under the Apache License, Version 2.0
 (the "License") and you may not use these files except in compliance with the [License](http://www.apache.org/licenses/LICENSE-2.0).

 You may obtain a copy of the License at [http://www.apache.org/licenses/LICENSE-2.0](http://www.apache.org/licenses/LICENSE-2.0)

 Unless required by applicable law or agreed to in writing, the Mojaloop files are distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND,
 either express or implied. See the License for the specific language governing permissions and limitations under the [License](http://www.apache.org/licenses/LICENSE-2.0).

 * Infitx
 - Steven Oderayi <steven.oderayi@infitx.com>
 - Eugene Klymniuk <eugen.klymniuk@infitx.com>
--------------
******/

'use strict'

const HealthCheck = require('@mojaloop/central-services-shared').HealthCheck.HealthCheck
const { defaultHealthHandler } = require('@mojaloop/central-services-health')
const packageJson = require('../../../package.json')
const { getSubServiceHealthDatastore } = require('../../api/health')
const { HealthCheckEnums } = require('@mojaloop/central-services-shared').HealthCheck

const { statusEnum, serviceName } = HealthCheckEnums

let healthCheck

const createHealthCheck = (consumersMap, db) => {
  const checkKafkaBroker = async () => {
    const isAllConnected = await Promise.all(
      Object.values(consumersMap).map(consumer => consumer.isConnected())
    )
    const status = isAllConnected.every(Boolean)
      ? statusEnum.OK
      : statusEnum.DOWN

    return {
      name: serviceName.broker,
      status
    }
  }

  return new HealthCheck(packageJson, [
    checkKafkaBroker,
    () => getSubServiceHealthDatastore(db)
  ])
}

const handler = {
  get: (request, reply) => {
    healthCheck = healthCheck || createHealthCheck(request.server.app.consumersMap, request.server.app.db)
    return defaultHealthHandler(healthCheck)(request, reply)
  }
}

const routes = [
  {
    method: 'GET',
    path: '/health',
    handler: handler.get
  }
]

const plugin = {
  name: 'Health',
  register (server) {
    server.route(routes)
  }
}

module.exports = {
  plugin,
  handler,
  createHealthCheck
}
