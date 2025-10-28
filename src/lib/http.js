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

  Initial contribution
 --------------------
 The initial functionality and code base was donated by the Mowali project working in conjunction with MTN and Orange as service provides.
 * Project: Mowali

 * ModusBox
 - Georgi Georgiev <georgi.georgiev@modusbox.com>
 - Henk Kodde <henk.kodde@modusbox.com>
 - Matt Kingston <matt.kingston@modusbox.com>
 - Vassilis Barzokas <vassilis.barzokas@modusbox.com>
 --------------
 ******/

const { sendRequest } = require('@mojaloop/central-services-shared/src/util/request')
const { logger } = require('../lib')
const config = require('./config')

/**
 * Encapsulates making an HTTP request using sendRequest and translating any error response into a domain-specific
 * error type.
 *
 * @param {Object} opts - Options for the HTTP request (must include url, headers, method, source, destination, etc.)
 * @param {String} fspiopSource
 * @returns {Promise<any>}
 */
async function httpRequest (opts, fspiopSource) {
  const log = logger.child({ component: 'httpRequest', fspiopSource })
  log.debug('httpRequest is started...')
  try {
    // Pass httpRequestTimeoutMs from config if not already set in opts
    const timeout = opts.timeout !== undefined ? opts.timeout : config.httpRequestTimeoutMs
    const response = await sendRequest({ timeout, ...opts })
    log.verbose('httpRequest is finished', { response, opts })
    // Axios returns the full response, but sendRequest returns the same, so return response.data if present
    return response.data !== undefined ? response.data : response
  } catch (e) {
    log.error('httpRequest failed due to an error:', e)
    // sendRequest throws FSPIOPError, so just rethrow
    throw e
  }
}

module.exports = {
  httpRequest
}
