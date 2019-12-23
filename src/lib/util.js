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
 --------------
 ******/

'use strict'

const util = require('util')
const Enum = require('@mojaloop/central-services-shared').Enum
const Logger = require('@mojaloop/central-services-logger')

const failActionHandler = async (request, h, err) => {
  Logger.error(`validation failure: ${getStackOrInspect}`)
  throw err
}

const getSpanTags = ({ payload, headers, params }, transactionType, transactionAction) => {
  const tags = {
    transactionType,
    transactionAction,
    transactionId: (payload && payload.transactionId) || (params && params.id),
    quoteId: (payload && payload.quoteId) || (params && params.id),
    source: headers[Enum.Http.Headers.FSPIOP.SOURCE],
    destination: headers[Enum.Http.Headers.FSPIOP.DESTINATION]
  }

  const payeeFsp = getSafe(['payee', 'partyIdInfo', 'fspId'], payload)
  const payerFsp = getSafe(['payer', 'partyIdInfo', 'fspId'], payload)

  if (payeeFsp) {
    tags.payeeFsp = payeeFsp
  }
  if (payerFsp) {
    tags.payerFsp = payerFsp
  }

  return tags
}

/**
 * @function getStackOrInspect
 * @description Gets the error stack, or uses util.inspect to inspect the error
 * @param {*} err - An error object
 */
function getStackOrInspect (err) {
  return err.stack || util.inspect(err)
}

/**
 * @function getSafe
 * @description Saftely get a nested value
 * @param {Array<string,number>} path - the path to the required variable
 * @param {*} obj - The object with which to get the value from
 * @returns {any | undefined} - The object at the path, or undefined
 *
 * @example
 *   Instead of the following:
 *   const fspId = payload && payload.payee && payload.payee.partyIdInfo && payload.payee.partyIdInfo.fspId
 *
 *   You can use `getSafe()`:
 *   const fspId = getSafe(['payee', 'partyIdInfo', 'fspId'], payload)
 *
 */
function getSafe (path, obj) {
  return path.reduce((xs, x) => (xs && xs[x]) ? xs[x] : undefined, obj)
}

module.exports = {
  failActionHandler,
  getSafe,
  getSpanTags,
  getStackOrInspect
}
