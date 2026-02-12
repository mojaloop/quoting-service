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
 - Eugene Klymniuk <eugen.klymniuk@infitx.com>
--------------
******/

'use strict'

const HealthCheck = require('@mojaloop/central-services-shared').HealthCheck.HealthCheck
const { defaultHealthHandler } = require('@mojaloop/central-services-health')
const packageJson = require('../../../package.json')
const { getSubServiceHealthDatastore } = require('../../api/health')
const { HealthCheckEnums } = require('@mojaloop/central-services-shared').HealthCheck
const { logger } = require('../../lib/logger')
const { statusEnum, serviceName } = HealthCheckEnums
const Consumer = require('@mojaloop/central-services-stream').Util.Consumer

let healthCheck

const createHealthCheck = (consumersMap, db) => {
  const checkKafkaBroker = async () => {
    let status = statusEnum.OK

    try {
      const topics = Object.keys(consumersMap)
      const results = await Promise.all(
        topics.map(async (topic) => {
          try {
            const consumer = Consumer.getConsumer(topic)
            const isHealthy = await consumer.isHealthy()
            if (!isHealthy) {
              logger.isWarnEnabled && logger.warn(`Consumer is not healthy for topic ${topic}`)
            }
            return isHealthy
          } catch (err) {
            logger.isWarnEnabled && logger.warn(`isHealthy check failed for topic ${topic}: ${err.message}`)
            return false
          }
        })
      )

      if (results.some(healthy => !healthy)) {
        status = statusEnum.DOWN
      }
    } catch (err) {
      logger.isWarnEnabled && logger.warn(`checkKafkaBroker failed with error ${err.message}.`)
      status = statusEnum.DOWN
    }

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
