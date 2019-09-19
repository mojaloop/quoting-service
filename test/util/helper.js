/*****
 License
 --------------
 Copyright © 2017 Bill & Melinda Gates Foundation
 The Mojaloop files are made available by the Bill & Melinda Gates Foundation under the Apache License, Version 2.0 (the "License") and you may not use these files except in compliance with the License. You may obtain a copy of the License at
 http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, the Mojaloop files are distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
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

 * Rajiv Mothilal <rajiv.mothilal@modusbox.com>

 --------------
 ******/
'use strict'

/**
 * @function defaultHeaders
 *
 * @description This returns a set of default headers used for requests
 *
 * see https://nodejs.org/dist/latest-v10.x/docs/api/http.html#http_message_headers
 *
 * @returns {object} Returns the default headers
 */
function defaultHeaders () {
  const destination = 'payeefsp'
  const source = 'payerfsp'
  const resource = 'quotes'
  const version = '1.0'
  // TODO: See API section 3.2.1; what should we do about X-Forwarded-For? Also, should we
  // add/append to this field in all 'queueResponse' calls?
  return {
    accept: `application/vnd.interoperability.${resource}+json;version=1`,
    'fspiop-destination': destination || '',
    'content-type': `application/vnd.interoperability.${resource}+json;version=${version}`,
    date: (new Date()).toUTCString(),
    'fspiop-source': source
  }
}

module.exports = {
  defaultHeaders
}
