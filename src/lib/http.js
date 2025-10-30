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

const http = require('node:http')
const util = require('node:util')
const axios = require('axios')
const ErrorHandler = require('@mojaloop/central-services-error-handling')

const { logger } = require('../lib')
const { getStackOrInspect } = require('../lib/util')
const Config = require('./config')

axios.defaults.httpAgent = new http.Agent({ keepAlive: true })
axios.defaults.httpAgent.toJSON = () => ({})
axios.defaults.headers.common = {}
const config = new Config()

/**
 * Encapsulates making an HTTP request and translating any error response into a domain-specific
 * error type.
 *
 * @param {Object} opts
 * @param {String} fspiopSource
 * @returns {Promise<void>}
 */
async function httpRequest (opts, fspiopSource) {
  const log = logger.child({ component: 'httpRequest', fspiopSource })
  log.debug('httpRequest is started...')
  opts = {
    timeout: config.httpRequestTimeoutMs,
    ...opts
  }
  let res
  let body
  try {
    res = await httpRequestBase(opts)
    body = await res.data
    log.verbose('httpRequest is finished', { body, opts })
  } catch (e) {
    log.error('httpRequest failed due to an error:', e)
    const [fspiopErrorType, fspiopErrorDescr] = e.response && e.response.status === 404
      ? [ErrorHandler.Enums.FSPIOPErrorCodes.CLIENT_ERROR, 'Not found']
      : [ErrorHandler.Enums.FSPIOPErrorCodes.DESTINATION_COMMUNICATION_ERROR, 'Network error']
    throw ErrorHandler.CreateFSPIOPError(fspiopErrorType, fspiopErrorDescr,
      `${getStackOrInspect(e)}. Opts: ${util.inspect(opts)}`,
      fspiopSource)
  }

  if (res.status < 200 || res.status >= 300) {
    const errObj = {
      opts,
      status: res.status,
      statusText: res.statusText,
      body
    }
    log.warn('httpRequest returned non-success status code', errObj)

    throw ErrorHandler.CreateFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.DESTINATION_COMMUNICATION_ERROR,
      'Non-success response in HTTP request',
      `${errObj}`,
      fspiopSource)
  }

  return body
}

async function httpRequestBase (opts, axiosInstance = axios) {
  return axiosInstance.request({
    timeout: config.httpRequestTimeoutMs,
    ...opts
  })
}

module.exports = {
  httpRequest,
  httpRequestBase
}
