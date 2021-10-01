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
const crypto = require('crypto')
const Enum = require('@mojaloop/central-services-shared').Enum
const Logger = require('@mojaloop/central-services-logger')
const resourceVersions = require('@mojaloop/central-services-shared').Util.resourceVersions
const Config = require('./config')
const axios = require('axios')

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

/**
 * Utility function to remove null and undefined keys from an object.
 * This is useful for removing "nulls" that come back from database queries
 * when projecting into API spec objects
 *
 * @returns {object}
 */
function removeEmptyKeys (originalObject) {
  const obj = { ...originalObject }
  Object.keys(obj).forEach(key => {
    if (obj[key] && typeof obj[key] === 'object') {
      if (Object.keys(obj[key]).length < 1) {
        // remove empty object
        delete obj[key]
      } else {
        // recurse
        obj[key] = removeEmptyKeys(obj[key])
      }
    } else if (obj[key] == null) {
      // null or undefined, remove it
      delete obj[key]
    }
  })
  return obj
}

function applyResourceVersionHeaders (headers) {
  let contentTypeHeader = headers['content-type'] || headers['Content-Type']
  let acceptHeader = headers.accept || headers.Accept
  if (Enum.Http.Headers.FSPIOP.SWITCH.regex.test(headers['fspiop-source'])) {
    if (Enum.Http.Headers.GENERAL.CONTENT_TYPE.regex.test(contentTypeHeader) && !!resourceVersions.quotes.contentVersion) {
      contentTypeHeader = `application/vnd.interoperability.quotes+json;version=${resourceVersions.quotes.contentVersion}`
    }
    if (Enum.Http.Headers.GENERAL.ACCEPT.regex.test(acceptHeader) && !!resourceVersions.quotes.acceptVersion) {
      acceptHeader = `application/vnd.interoperability.quotes+json;version=${resourceVersions.quotes.acceptVersion}`
    }
  }
  return { contentTypeHeader, acceptHeader }
}

/**
 * Generates and returns an object containing API spec compliant HTTP request headers
 *
 * @returns {object}
 */
function generateRequestHeaders (headers, noAccept) {
  const { contentTypeHeader, acceptHeader } = applyResourceVersionHeaders(headers)
  const ret = {
    'Content-Type': contentTypeHeader,
    Date: headers.date,
    'FSPIOP-Source': headers['fspiop-source'],
    'FSPIOP-Destination': headers['fspiop-destination'],
    'FSPIOP-HTTP-Method': headers['fspiop-http-method'],
    'FSPIOP-Signature': headers['fspiop-signature'],
    'FSPIOP-URI': headers['fspiop-uri'],
    Accept: null
  }

  if (!noAccept) {
    ret.Accept = acceptHeader
  }
  if (headers['fspiop-sourcecurrency']) {
    ret['FSPIOP-SourceCurrency'] = headers['fspiop-sourcecurrency']
  }
  if (headers['fspiop-destinationcurrency']) {
    ret['FSPIOP-DestinationCurrency'] = headers['fspiop-destinationcurrency']
  }

  return removeEmptyKeys(ret)
}

/**
 * Generates and returns an object containing API spec compliant lowercase HTTP request headers for JWS Signing
 *
 * @returns {object}
 */
function generateRequestHeadersForJWS (headers, noAccept) {
  const { contentTypeHeader, acceptHeader } = applyResourceVersionHeaders(headers)
  const ret = {
    'Content-Type': contentTypeHeader,
    date: headers.date,
    'fspiop-source': headers['fspiop-source'],
    'fspiop-destination': headers['fspiop-destination'],
    'fspiop-http-method': headers['fspiop-http-method'],
    'fspiop-signature': headers['fspiop-signature'],
    'fspiop-uri': headers['fspiop-uri'],
    Accept: null
  }

  if (!noAccept) {
    ret.Accept = acceptHeader
  }

  return removeEmptyKeys(ret)
}

/**
 * Returns the SHA-256 hash of the supplied request object
 *
 * @returns {undefined}
 */
function calculateRequestHash (request) {
  // calculate a SHA-256 of the request
  const requestStr = JSON.stringify(request)
  return crypto.createHash('sha256').update(requestStr).digest('hex')
}

const fetchParticipantInfo = async (source, destination) => {
  // Get quote participants from central ledger admin
  const { switchEndpoint } = new Config()
  const url = `${switchEndpoint}/participants`
  const [payer, payee] = await Promise.all([
    axios.request({ url: `${url}/${source}` }),
    axios.request({ url: `${url}/${destination}` })
  ])
  return { payer: payer.data, payee: payee.data }
}

module.exports = {
  failActionHandler,
  getSafe,
  getSpanTags,
  getStackOrInspect,
  generateRequestHeaders,
  generateRequestHeadersForJWS,
  calculateRequestHash,
  removeEmptyKeys,
  fetchParticipantInfo
}
