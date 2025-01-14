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

const { API_TYPES } = require('@mojaloop/central-services-shared').Util.Hapi

const RESOURCES = Object.freeze({
  quotes: 'quotes',
  fxQuotes: 'fxQuotes'
})

const HEADERS = Object.freeze({
  accept: 'Accept',
  contentType: 'Content-Type',
  date: 'Date',
  fspiopSource: 'FSPIOP-Source',
  fspiopDestination: 'FSPIOP-Destination',
  fspiopHttpMethod: 'FSPIOP-HTTP-Method',
  fspiopSignature: 'FSPIOP-Signature',
  fspiopUri: 'FSPIOP-URI'
})

const ERROR_MESSAGES = {
  CALLBACK_UNSUCCESSFUL_HTTP_RESPONSE: 'Got non-success response sending error callback',
  CALLBACK_NETWORK_ERROR: 'network error in sendErrorCallback',
  NO_FX_CALLBACK_ENDPOINT: (fspiopSource, conversionRequestId) => `No FSPIOP_CALLBACK_URL_FX_QUOTES endpoint found for FSP '${fspiopSource}' while processing fxquote ${conversionRequestId}`
}

const PAYLOAD_STORAGES = Object.freeze({
  none: '',
  kafka: 'kafka',
  redis: 'redis'
})

const ISO_HEADER_PART = 'iso20022'

module.exports = {
  API_TYPES,
  ISO_HEADER_PART,
  RESOURCES,
  HEADERS,
  ERROR_MESSAGES,
  PAYLOAD_STORAGES
}
