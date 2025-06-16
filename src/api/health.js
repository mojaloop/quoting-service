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

 * ModusBox
 - Henk Kodde <henk.kodde@modusbox.com>
 - Miguel de Barros <miguel.debarros@modusbox.com>
 --------------
 ******/
'use strict'

const { HealthCheck } = require('@mojaloop/central-services-shared').HealthCheck
const { responseCode, statusEnum, serviceName } = require('@mojaloop/central-services-shared').HealthCheck.HealthCheckEnums
const { Producer } = require('@mojaloop/central-services-stream').Util
const Logger = require('@mojaloop/central-services-logger')
const Config = require('../lib/config.js')
const packageJson = require('../../package.json')

const config = new Config()

/**
 * @function getSubServiceHealthDatastore
 *
 * @description
 *   Gets the health of the Datastore by ensuring the table is currently locked
 *   in a migration state. This implicity checks the connection with the database.
 *
 * @returns Promise<SubServiceHealth> The SubService health object for the broker
 */
const getSubServiceHealthDatastore = async (db) => {
  let status = statusEnum.OK

  try {
    const isLocked = await db.getIsMigrationLocked()
    if (isLocked) {
      status = statusEnum.DOWN
    }
  } catch (err) {
    Logger.isWarnEnabled && Logger.warn(`getSubServiceHealthDatastore failed with error ${err.message}.`)
    status = statusEnum.DOWN
  }

  return {
    name: serviceName.datastore,
    status
  }
}

const checkKafkaProducers = async (topicNames) => {
  let status = statusEnum.OK
  try {
    await Producer.allConnected()
    status = statusEnum.OK
  } catch (err) {
    Logger.isDebugEnabled && Logger.debug(`getSubServiceHealthBroker failed with error: ${err.message}.`)
    status = statusEnum.DOWN
  }

  return {
    name: serviceName.broker,
    status
  }
}

/**
 * Operations on /health
 */
module.exports = {
  /**
   * summary: Get Quoting Service Health
   * description: The HTTP request GET /health is used to return the current status of the API .
   * parameters:
   * produces: application/json
   * responses: 200, 400, 401, 403, 404, 405, 406, 501, 503
   */
  get: async (context, request, h) => {
    // Check to see if we are NOT in simpleRoutingMode
    let serviceHealthList = []

    if (!config.simpleRoutingMode) {
      // assign the db object
      /* istanbul ignore next */
      // ignoring coverage, since we can't test this anonymous function and its tests are covered
      // elsewhere
      serviceHealthList = [
        async () => checkKafkaProducers(request.server.app.topicNames)
      ]
    }

    // create healthCheck object
    const healthCheck = new HealthCheck(packageJson, serviceHealthList)

    // query health status
    const healthCheckResponse = await healthCheck.getHealth()

    // set default code
    let code = responseCode.success

    // check for errors
    if (!healthCheckResponse || healthCheckResponse.status !== statusEnum.OK) {
      // Set Error
      code = responseCode.gatewayTimeout
    }

    // return response
    return h.response(healthCheckResponse).code(code)
  },

  getSubServiceHealthDatastore,
  checkKafkaProducers
}
