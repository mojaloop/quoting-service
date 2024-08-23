// (C)2018 ModusBox Inc.
/*****
 License
 --------------
 Copyright © 2017 Bill & Melinda Gates Foundation
 The Mojaloop files are made available by the Bill & Melinda Gates Foundation under the Apache License, Version 2.0 (the "License") and you may not use these files except in compliance with the License. You may obtain a copy of the License at
 http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, the Mojaloop files are distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.

 Initial contribution
 --------------------
 The initial functionality and code base was donated by the Mowali project working in conjunction with MTN and Orange as service provides.
 * Project: Mowali

 Contributors
 --------------
 This is the official list of the Mojaloop project contributors for this file.
 Names of the original copyright holders (individuals or organizations)
 should be listed with a '*' in the first column. People who have
 contributed from an organization can be listed under the organization
 that actually holds the copyright for their contributions (see the
 Gates Foundation organization for an example). Those individuals should have
 their names indented and be marked with a '-'. Email address can be added
 optionally within square brackets <email>.
 * Gates Foundation
 - Name Surname <name.surname@gatesfoundation.com>

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

axios.defaults.httpAgent = new http.Agent({ keepAlive: true })
axios.defaults.httpAgent.toJSON = () => ({})

// TODO: where httpRequest is called, there's a pretty common pattern of obtaining an endpoint from
// the database, specialising a template string with that endpoint, then calling httpRequest. Is
// there common functionality in these places than can reasonably be factored out?
/**
 * Encapsulates making an HTTP request and translating any error response into a domain-specific
 * error type.
 *
 * @param {Object} opts
 * @param {String} fspiopSource
 * @returns {Promise<void>}
 */
async function httpRequest (opts, fspiopSource) {
  // Network errors lob an exception. Bear in mind 3xx 4xx and 5xx are not network errors so we
  // need to wrap the request below in a `try catch` to handle network errors
  let res
  let body
  const log = logger.child({ context: 'httpRequest', fspiopSource, opts })

  try {
    res = await axios.request(opts)
    body = await res.data
    log.debug('httpRequest is finished', { body })
  } catch (e) {
    log.error('httpRequest is failed due to error:', e)
    const [fspiopErrorType, fspiopErrorDescr] = e.response && e.response.status === 404
      ? [ErrorHandler.Enums.FSPIOPErrorCodes.CLIENT_ERROR, 'Not found']
      : [ErrorHandler.Enums.FSPIOPErrorCodes.DESTINATION_COMMUNICATION_ERROR, 'Network error']
    throw ErrorHandler.CreateFSPIOPError(fspiopErrorType, fspiopErrorDescr,
      `${getStackOrInspect(e)}. Opts: ${util.inspect(opts)}`,
      fspiopSource)
  }

  // handle non network related errors below
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

module.exports = {
  httpRequest
}
