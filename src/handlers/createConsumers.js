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

*****/

const Logger = require('@mojaloop/central-services-logger')
const { reformatFSPIOPError } = require('@mojaloop/central-services-error-handling').Factory
const { Consumer } = require('@mojaloop/central-services-stream').Util

const { ErrorMessages } = require('../lib/enum')
const Config = require('../lib/config')

const createConsumers = async (onMessageFn, handlerList = []) => {
  try {
    if (typeof onMessageFn !== 'function') {
      throw new TypeError(ErrorMessages.incorrectOnMessageFnType)
    }
    const { kafkaConfig } = new Config()

    const creating = []
    const topics = []
    for (const [key, value] of Object.entries(kafkaConfig.CONSUMER)) {
      if (handlerList.includes(key)) {
        for (const { topic, config } of Object.values(value)) {
          creating.push(Consumer.createHandler(topic, config, onMessageFn)) // think, if we need to pass for each topic a separate fn
          topics.push(topic)
        }
      }
    }
    await Promise.all(creating)
    Logger.isInfoEnabled && Logger.info('createConsumers is done')

    // to get reference to all consumers by topic name
    const consumersMap = topics.reduce((acc, topic) => ({
      ...acc,
      [topic]: Consumer.getConsumer(topic)
    }), {})

    return Object.freeze(consumersMap)
  } catch (err) {
    Logger.isErrorEnabled && Logger.error(`error in createConsumers: ${err.message}`)
    throw reformatFSPIOPError(err)
  }
}

module.exports = createConsumers
