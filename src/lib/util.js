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

const crypto = require('node:crypto')
const path = require('node:path')
const util = require('node:util')
const axios = require('axios')
const ErrorHandler = require('@mojaloop/central-services-error-handling')
const { Enum, Util } = require('@mojaloop/central-services-shared')
const { AuditEventAction } = require('@mojaloop/event-sdk')

const { RESOURCES, HEADERS, ISO_HEADER_PART } = require('../constants')
const { logger } = require('../lib')
const Config = require('./config')

const config = new Config()

const failActionHandler = async (request, h, err) => {
  logger.error('validation failure: ', err)
  throw err
}

const getSpanTags = ({ payload, headers, params, spanContext }, transactionType, transactionAction) => {
  const tags = {
    transactionType,
    transactionAction,
    transactionId: (payload && payload.transactionId) || (params && params.id) || (spanContext?.tags?.transactionId),
    quoteId: (payload && payload.quoteId) || (params && params.id) || (spanContext?.tags?.quoteId),
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

const makeAppInteroperabilityHeader = (resource, version, isIsoApi) => {
  const isoPart = isIsoApi ? `.${ISO_HEADER_PART}` : ''
  return `application/vnd.interoperability${isoPart}.${resource}+json;version=${version}`
}

function applyResourceVersionHeaders (headers, protocolVersions, resource) {
  const isIsoApi = isIso20022ApiRequest(headers)
  let contentTypeHeader = getContentTypeHeader(headers)
  let acceptHeader = getAcceptHeader(headers)

  if (Util.HeaderValidation.getHubNameRegex(config.hubName).test(headers['fspiop-source'])) {
    if (Enum.Http.Headers.GENERAL.CONTENT_TYPE.regex.test(contentTypeHeader) && !!protocolVersions.CONTENT.DEFAULT) {
      contentTypeHeader = makeAppInteroperabilityHeader(resource, protocolVersions.CONTENT.DEFAULT, isIsoApi)
    }
    if (Enum.Http.Headers.GENERAL.ACCEPT.regex.test(acceptHeader) && !!protocolVersions.ACCEPT.DEFAULT) {
      acceptHeader = makeAppInteroperabilityHeader(resource, protocolVersions.ACCEPT.DEFAULT, isIsoApi)
    }
  }
  return { contentTypeHeader, acceptHeader }
}

const getAcceptHeader = (headers = {}) => (headers.accept || headers.Accept)
const getContentTypeHeader = (headers = {}) => (headers['content-type'] || headers['Content-Type'])

const headersMappingDto = (headers, protocolVersions, noAccept, resource) => {
  const { contentTypeHeader, acceptHeader } = applyResourceVersionHeaders(headers, protocolVersions, resource)
  return {
    [HEADERS.accept]: noAccept ? null : acceptHeader,
    [HEADERS.contentType]: contentTypeHeader,
    [HEADERS.date]: headers.date,
    [HEADERS.fspiopSource]: headers['fspiop-source'],
    [HEADERS.fspiopDestination]: headers['fspiop-destination'],
    [HEADERS.fspiopHttpMethod]: headers['fspiop-http-method'],
    [HEADERS.fspiopSignature]: headers['fspiop-signature'],
    [HEADERS.fspiopUri]: headers['fspiop-uri']
  }
}

/**
 * Generates and returns an object containing API spec compliant HTTP request headers
 *
 * @returns {object}
 */
function generateRequestHeaders (
  headers,
  protocolVersions,
  noAccept = false,
  resource = RESOURCES.quotes,
  additionalHeaders = null
) {
  let ret = headersMappingDto(headers, protocolVersions, noAccept, resource)

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
function generateRequestHeadersForJWS (
  headers,
  protocolVersions,
  noAccept = false,
  resource = RESOURCES.quotes
) {
  const mappedHeaders = headersMappingDto(headers, protocolVersions, noAccept, resource)
  // JWS Signer expects headers in lowercase
  const ret = Object.fromEntries(
    Object.entries(mappedHeaders).map(([key, value]) => [key.toLowerCase(), value])
  )
  // clarify, if we need additionalHeaders here (see generateRequestHeaders fn)

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

const proxyAdjacentParticipantDto = (name) => ({
  data: {
    name,
    id: '',
    // assume source is active
    isActive: 1,
    links: { self: '' },
    accounts: [],
    proxiedParticipant: true
  }
})

// Add caching to the participant endpoint
const fetchParticipantInfo = async (source, destination, cache, proxyClient) => {
  // Get quote participants from central ledger admin
  const { switchEndpoint } = config
  const url = `${switchEndpoint}/participants`
  let requestPayer
  let requestPayee

  if (proxyClient) {
    if (!proxyClient.isConnected) await proxyClient.connect()
    const proxyIdSource = await proxyClient.lookupProxyByDfspId(source)
    const proxyIdDestination = await proxyClient.lookupProxyByDfspId(destination)
    if (proxyIdSource) {
      // construct participant adjacent data structure that uses the original
      // participant when they are proxied and out of scheme
      requestPayer = proxyAdjacentParticipantDto(source)
    }
    if (proxyIdDestination) {
      // construct participant adjacent data structure that uses the original
      // participant when they are proxied and out of scheme
      requestPayee = proxyAdjacentParticipantDto(destination)
    }
  }

  const cachedPayer = cache && !requestPayer && cache.get(`fetchParticipantInfo_${source}`)
  const cachedPayee = cache && !requestPayee && cache.get(`fetchParticipantInfo_${destination}`)

  if (!cachedPayer && !requestPayer) {
    requestPayer = await axios.request({ url: `${url}/${source}` })
    cache && cache.put(`fetchParticipantInfo_${source}`, requestPayer, Config.participantDataCacheExpiresInMs)
    logger.isDebugEnabled && logger.debug(`[fetchParticipantInfo]: cache miss for payer ${source}`)
  } else {
    logger.isDebugEnabled && logger.debug(`[fetchParticipantInfo]: cache hit for payer ${source}`)
  }
  if (!cachedPayee && !requestPayee) {
    requestPayee = await axios.request({ url: `${url}/${destination}` })
    cache && cache.put(`fetchParticipantInfo_${destination}`, requestPayee, Config.participantDataCacheExpiresInMs)
    logger.isDebugEnabled && logger.debug(`[fetchParticipantInfo]: cache miss for payee ${destination}`)
  } else {
    logger.isDebugEnabled && logger.debug(`[fetchParticipantInfo]: cache hit for payee ${destination}`)
  }

  const payer = cachedPayer || requestPayer.data
  const payee = cachedPayee || requestPayee.data
  return { payer, payee }
}

const getParticipantEndpoint = async ({ fspId, db, loggerFn, endpointType, proxyClient = null }) => {
  if (!fspId || !db || !loggerFn || !endpointType) {
    throw ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.INTERNAL_SERVER_ERROR, 'Missing required arguments for \'getParticipantEndpoint\'')
  }

  let endpoint = await db.getParticipantEndpoint(fspId, endpointType)

  loggerFn(`DB lookup: resolved participant '${fspId}' ${endpointType} endpoint to: '${endpoint}'`)

  // if endpoint is not found in db, check the proxy cache for a proxy representative for the fsp (this might be an inter-scheme request)
  if (!endpoint && proxyClient) {
    if (!proxyClient.isConnected) await proxyClient.connect()
    const proxyId = await proxyClient.lookupProxyByDfspId(fspId)
    if (proxyId) {
      endpoint = await db.getParticipantEndpoint(proxyId, endpointType)
    }

    loggerFn(`Proxy lookup: resolved participant '${fspId}' ${endpointType} endpoint to: '${endpoint}', proxyId: ${proxyId} `)
  }

  return endpoint
}

const auditSpan = async (request) => {
  const { span, headers, payload, method } = request
  span.setTags(getSpanTags(request, 'quote', method))
  await span.audit({
    headers,
    payload
  }, AuditEventAction.start)
}

const rethrowFspiopError = (error) => {
  const fspiopError = ErrorHandler.Factory.reformatFSPIOPError(error)
  logger.error(`rethrowFspiopError: ${error?.message}`, { fspiopError })
  throw fspiopError
}

const resolveOpenApiSpecPath = (isIsoApi) => {
  const specFile = isIsoApi
    ? 'QuotingService-swagger_iso20022.yaml'
    : 'QuotingService-swagger.yaml'
  return path.resolve(__dirname, '../interface', specFile)
}

const isFxRequest = (headers) => getContentTypeHeader(headers)?.includes(RESOURCES.fxQuotes)
const isIso20022ApiRequest = (headers) => getContentTypeHeader(headers)?.includes(ISO_HEADER_PART)

module.exports = {
  auditSpan,
  failActionHandler,
  getSpanTags,
  getStackOrInspect,
  generateRequestHeaders,
  generateRequestHeadersForJWS,
  calculateRequestHash,
  removeEmptyKeys,
  rethrowFspiopError,
  fetchParticipantInfo,
  getParticipantEndpoint,
  makeAppInteroperabilityHeader,
  resolveOpenApiSpecPath,
  isFxRequest,
  isIso20022ApiRequest
}
