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
const axios = require('axios')
const Logger = require('@mojaloop/central-services-logger')
const ErrorHandler = require('@mojaloop/central-services-error-handling')
const { Enum, Util } = require('@mojaloop/central-services-shared')
const { AuditEventAction } = require('@mojaloop/event-sdk')

const Config = require('./config')

const config = new Config()

const failActionHandler = async (request, h, err) => {
  Logger.isErrorEnabled && Logger.error(`validation failure: ${err ? getStackOrInspect(err) : ''}`)
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

function applyResourceVersionHeaders (headers, protocolVersions) {
  let contentTypeHeader = headers['content-type'] || headers['Content-Type']
  let acceptHeader = headers.accept || headers.Accept
  if (Util.HeaderValidation.getHubNameRegex(config.hubName).test(headers['fspiop-source'])) {
    if (Enum.Http.Headers.GENERAL.CONTENT_TYPE.regex.test(contentTypeHeader) && !!protocolVersions.CONTENT.DEFAULT) {
      contentTypeHeader = `application/vnd.interoperability.quotes+json;version=${protocolVersions.CONTENT.DEFAULT}`
    }
    if (Enum.Http.Headers.GENERAL.ACCEPT.regex.test(acceptHeader) && !!protocolVersions.ACCEPT.DEFAULT) {
      acceptHeader = `application/vnd.interoperability.quotes+json;version=${protocolVersions.ACCEPT.DEFAULT}`
    }
  }
  return { contentTypeHeader, acceptHeader }
}

/**
 * Generates and returns an object containing API spec compliant HTTP request headers
 *
 * @returns {object}
 */
function generateRequestHeaders (headers, protocolVersions, noAccept = false, additionalHeaders) {
  const { contentTypeHeader, acceptHeader } = applyResourceVersionHeaders(headers, protocolVersions)
  let ret = {
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
  // below are the non-standard headers added by the rules
  if (additionalHeaders) {
    ret = { ...ret, ...additionalHeaders }
  }

  return removeEmptyKeys(ret)
}

/**
 * Generates and returns an object containing API spec compliant lowercase HTTP request headers for JWS Signing
 *
 * @returns {object}
 */
function generateRequestHeadersForJWS (headers, protocolVersions, noAccept = false) {
  const { contentTypeHeader, acceptHeader } = applyResourceVersionHeaders(headers, protocolVersions)
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

// Add caching to the participant endpoint
const fetchParticipantInfo = async (source, destination, cache) => {
  // Get quote participants from central ledger admin
  const { switchEndpoint } = config
  const url = `${switchEndpoint}/participants`
  let requestPayer
  let requestPayee
  const cachedPayer = cache && cache.get(`fetchParticipantInfo_${source}`)
  const cachedPayee = cache && cache.get(`fetchParticipantInfo_${destination}`)

  if (!cachedPayer) {
    requestPayer = await axios.request({ url: `${url}/${source}` })
    cache && cache.put(`fetchParticipantInfo_${source}`, requestPayer, Config.participantDataCacheExpiresInMs)
    Logger.isDebugEnabled && Logger.debug(`${new Date().toISOString()}, [fetchParticipantInfo]: cache miss for payer ${source}`)
  } else {
    Logger.isDebugEnabled && Logger.debug(`${new Date().toISOString()}, [fetchParticipantInfo]: cache hit for payer ${source}`)
  }
  if (!cachedPayee) {
    requestPayee = await axios.request({ url: `${url}/${destination}` })
    cache && cache.put(`fetchParticipantInfo_${destination}`, requestPayee, Config.participantDataCacheExpiresInMs)
    Logger.isDebugEnabled && Logger.debug(`${new Date().toISOString()}, [fetchParticipantInfo]: cache miss for payer ${source}`)
  } else {
    Logger.isDebugEnabled && Logger.debug(`${new Date().toISOString()}, [fetchParticipantInfo]: cache hit for payee ${destination}`)
  }
  const payer = cachedPayer || requestPayer.data
  const payee = cachedPayee || requestPayee.data
  return { payer, payee }
}

const auditSpan = async (request) => {
  const { span, headers, payload } = request
  await span.audit({
    headers,
    payload
  }, AuditEventAction.start)
}

const rethrowFspiopError = (error) => {
  const fspiopError = ErrorHandler.Factory.reformatFSPIOPError(error)
  Logger.isErrorEnabled && Logger.error(fspiopError)
  throw fspiopError
}

module.exports = {
  auditSpan,
  failActionHandler,
  getSafe,
  getSpanTags,
  getStackOrInspect,
  generateRequestHeaders,
  generateRequestHeadersForJWS,
  calculateRequestHash,
  removeEmptyKeys,
  rethrowFspiopError,
  fetchParticipantInfo
}
