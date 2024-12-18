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
 - Rajiv Mothilal <rajiv.mothilal@modusbox.com>
 --------------
 ******/

const axios = require('axios')
const util = require('util')

const ENUM = require('@mojaloop/central-services-shared').Enum
const ErrorHandler = require('@mojaloop/central-services-error-handling')
const EventSdk = require('@mojaloop/event-sdk')
const LibUtil = require('@mojaloop/central-services-shared').Util
const Logger = require('@mojaloop/central-services-logger')
const JwsSigner = require('@mojaloop/sdk-standard-components').Jws.signer

const Config = require('../lib/config')
const { httpRequest } = require('../lib/http')
const { getStackOrInspect, generateRequestHeadersForJWS, generateRequestHeaders, getParticipantEndpoint } = require('../lib/util')
const LOCAL_ENUM = require('../lib/enum')

delete axios.defaults.headers.common.Accept
delete axios.defaults.headers.common['Content-Type']

/**
 * Encapsulates operations on the bulkQuotes domain model
 *
 * @returns {undefined}
 */

class BulkQuotesModel {
  constructor (deps) {
    this.db = deps.db
    this.requestId = deps.requestId
    this.proxyClient = deps.proxyClient
    this.envConfig = deps.config || new Config()
  }

  /**
   * Validates the quote request object
   *
   * @returns {promise} - promise will reject if request is not valid
   */
  async validateBulkQuoteRequest (fspiopSource, fspiopDestination, bulkQuoteRequest) {
    await this.db.getParticipant(fspiopSource, LOCAL_ENUM.PAYER_DFSP, bulkQuoteRequest.individualQuotes[0].amount.currency, ENUM.Accounts.LedgerAccountType.POSITION)

    // Ensure the proxy client is connected
    if (this.proxyClient?.isConnected === false) await this.proxyClient.connect()
    // if the payee dfsp has a proxy cache entry, we do not validate the dfsp here
    if (!(await this.proxyClient?.lookupProxyByDfspId(fspiopDestination))) {
      await this.db.getParticipant(fspiopDestination, LOCAL_ENUM.PAYEE_DFSP, bulkQuoteRequest.individualQuotes[0].amount.currency, ENUM.Accounts.LedgerAccountType.POSITION)
    }
  }

  /**
   * Logic for creating and handling quote requests
   *
   * @returns {object} - returns object containing keys for created database entities
   */
  async handleBulkQuoteRequest (headers, bulkQuoteRequest, span) {
    // accumulate enum ids
    const refs = {}
    let fspiopSource
    let childSpan
    try {
      fspiopSource = headers[ENUM.Http.Headers.FSPIOP.SOURCE]
      const fspiopDestination = headers[ENUM.Http.Headers.FSPIOP.DESTINATION]

      // validate - this will throw if the request is invalid
      childSpan = span.getChild('qs_bulkquote_forwardBulkQuoteRequest')
      await this.validateBulkQuoteRequest(fspiopSource, fspiopDestination, bulkQuoteRequest)
      // if we got here rules passed, so we can forward the quote on to the recipient dfsp
      await childSpan.audit({ headers, payload: bulkQuoteRequest }, EventSdk.AuditEventAction.start)
      await this.forwardBulkQuoteRequest(headers, bulkQuoteRequest.bulkQuoteId, bulkQuoteRequest, childSpan)
    } catch (err) {
      // any-error
      // as we are on our own in this context, dont just rethrow the error, instead...
      // get the model to handle it
      this.writeLog(`Error forwarding quote request: ${getStackOrInspect(err)}. Attempting to send error callback to ${fspiopSource}`)
      await this.handleException(fspiopSource, bulkQuoteRequest.bulkQuoteId, err, headers, childSpan)
    } finally {
      if (childSpan && !childSpan.isFinished) {
        await childSpan.finish()
      }
    }

    // all ok, return refs
    return refs
  }

  /**
   * Forwards a quote request to a payee DFSP for processing
   *
   * @returns {undefined}
   */
  async forwardBulkQuoteRequest (headers, bulkQuoteId, originalBulkQuoteRequest, span) {
    let endpoint
    const fspiopSource = headers[ENUM.Http.Headers.FSPIOP.SOURCE]
    const fspiopDest = headers[ENUM.Http.Headers.FSPIOP.DESTINATION]

    try {
      // lookup payee dfsp callback endpoint
      // TODO: for MVP we assume initiator is always payer dfsp! this may not always be the
      // case if a xfer is requested by payee
      endpoint = await this._getParticipantEndpoint(fspiopDest)

      this.writeLog(`Resolved FSPIOP_CALLBACK_URL_BULK_QUOTES endpoint for bulkQuote ${bulkQuoteId} to: ${util.inspect(endpoint)}`)

      if (!endpoint) {
        // internal-error
        // we didnt get an endpoint for the payee dfsp!
        // make an error callback to the initiator
        const extensions = [{
          key: 'system',
          value: '["proxyClient","db"]'
        }]
        throw ErrorHandler.CreateFSPIOPError(
          ErrorHandler.Enums.FSPIOPErrorCodes.DESTINATION_FSP_ERROR,
          `No FSPIOP_CALLBACK_URL_BULK_QUOTES found for quote ${bulkQuoteId} PAYEE party`,
          null,
          fspiopSource,
          extensions
        )
      }

      const fullCallbackUrl = `${endpoint}${ENUM.EndPoints.FspEndpointTemplates.BULK_QUOTES_POST}`
      const newHeaders = generateRequestHeaders(headers, this.envConfig.protocolVersions)

      this.writeLog(`Forwarding quote request to endpoint: ${fullCallbackUrl}`)
      this.writeLog(`Forwarding quote request headers: ${JSON.stringify(newHeaders)}`)
      this.writeLog(`Forwarding quote request body: ${JSON.stringify(originalBulkQuoteRequest)}`)

      let opts = {
        method: ENUM.Http.RestMethods.POST,
        url: fullCallbackUrl,
        data: originalBulkQuoteRequest,
        headers: newHeaders
      }

      if (span) {
        opts = span.injectContextToHttpRequest(opts)
        const { data, ...rest } = opts
        span.audit({ ...rest, payload: data }, EventSdk.AuditEventAction.egress)
      }

      this.writeLog(`Forwarding request : ${util.inspect(opts)}`)
      await httpRequest(opts, fspiopSource)
    } catch (err) {
      // any-error
      this.writeLog(`Error forwarding bulkQuote request to endpoint ${endpoint}: ${getStackOrInspect(err)}`)
      const extensions = [{
        key: 'system',
        value: '["http","proxyClient","db"]'
      }]
      throw ErrorHandler.ReformatFSPIOPError(
        err,
        undefined,
        undefined,
        extensions
      )
    }
  }

  /**
   * Logic for handling quote update requests e.g. PUT /bulkQuotes/{id} requests
   *
   * @returns {object} - object containing updated entities
   */
  async handleBulkQuoteUpdate (headers, bulkQuoteId, bulkQuoteUpdateRequest, span) {
    // ensure no 'accept' header is present in the request headers.
    if ('accept' in headers) {
      // internal-error
      throw ErrorHandler.CreateFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.VALIDATION_ERROR,
        `Update for bulk quote ${bulkQuoteId} failed: "accept" header should not be sent in callbacks.`, null, headers['fspiop-source'])
    }
    // if we got here rules passed, so we can forward the quote on to the recipient dfsp
    const childSpan = span.getChild('qs_quote_forwardBulkQuoteUpdate')
    try {
      await childSpan.audit({ headers, params: { bulkQuoteId }, payload: bulkQuoteUpdateRequest }, EventSdk.AuditEventAction.start)
      await this.forwardBulkQuoteUpdate(headers, bulkQuoteId, bulkQuoteUpdateRequest, childSpan)
    } catch (err) {
      // any-error
      // as we are on our own in this context, dont just rethrow the error, instead...
      // get the model to handle it
      const fspiopSource = headers[ENUM.Http.Headers.FSPIOP.SOURCE]
      this.writeLog(`Error forwarding bulk quote update: ${getStackOrInspect(err)}. Attempting to send error callback to ${fspiopSource}`)
      await this.handleException(fspiopSource, bulkQuoteId, err, headers, childSpan)
    } finally {
      if (childSpan && !childSpan.isFinished) {
        await childSpan.finish()
      }
    }
  }

  /**
   * Forwards a bulk quote response to a payer DFSP for processing
   *
   * @returns {undefined}
   */
  async forwardBulkQuoteUpdate (headers, bulkQuoteId, originalBulkQuoteResponse, span) {
    let endpoint = null
    const fspiopSource = headers[ENUM.Http.Headers.FSPIOP.SOURCE]
    const fspiopDest = headers[ENUM.Http.Headers.FSPIOP.DESTINATION]

    try {
      // lookup payer dfsp callback endpoint
      endpoint = await this._getParticipantEndpoint(fspiopDest)
      this.writeLog(`Resolved PAYER party FSPIOP_CALLBACK_URL_BULK_QUOTES endpoint for bulk quote ${bulkQuoteId} to: ${util.inspect(endpoint)}`)

      if (!endpoint) {
        // we didnt get an endpoint for the payee dfsp!
        // make an error callback to the initiator
        const fspiopError = ErrorHandler.CreateFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.DESTINATION_FSP_ERROR, `No FSPIOP_CALLBACK_URL_BULK_QUOTES found for quote ${bulkQuoteId} PAYER party`, null, fspiopSource)
        return this.sendErrorCallback(fspiopSource, fspiopError, bulkQuoteId, headers, true)
      }

      const fullCallbackUrl = `${endpoint}/bulkQuotes/${bulkQuoteId}`
      // we need to strip off the 'accept' header
      // for all PUT requests as per the API Specification Document
      // https://github.com/mojaloop/mojaloop-specification/blob/main/documents/v1.1-document-set/fspiop-v1.1-openapi2.yaml
      const newHeaders = generateRequestHeaders(headers, this.envConfig.protocolVersions, true)

      this.writeLog(`Forwarding bulk quote response to endpoint: ${fullCallbackUrl}`)
      this.writeLog(`Forwarding bulk quote response headers: ${JSON.stringify(newHeaders)}`)
      this.writeLog(`Forwarding bulk quote response body: ${JSON.stringify(originalBulkQuoteResponse)}`)

      let opts = {
        method: ENUM.Http.RestMethods.PUT,
        url: fullCallbackUrl,
        data: originalBulkQuoteResponse,
        headers: newHeaders
      }

      if (span) {
        opts = span.injectContextToHttpRequest(opts)
        const { data, ...rest } = opts
        span.audit({ ...rest, payload: data }, EventSdk.AuditEventAction.egress)
      }

      await httpRequest(opts, fspiopSource)
    } catch (err) {
      // any-error
      this.writeLog(`Error forwarding bulk quote response to endpoint ${endpoint}: ${getStackOrInspect(err)}`)
      const extensions = [{
        key: 'system',
        value: '["http","proxyClient","db"]'
      }]
      throw ErrorHandler.ReformatFSPIOPError(
        err,
        undefined,
        undefined,
        extensions
      )
    }
  }

  /**
   * Attempts to handle a bulk quote GET request by forwarding it to the destination DFSP
   *
   * @returns {undefined}
   */
  async handleBulkQuoteGet (headers, bulkQuoteId, span) {
    const fspiopSource = headers[ENUM.Http.Headers.FSPIOP.SOURCE]
    const childSpan = span.getChild('qs_quote_forwardBulkQuoteGet')
    try {
      await childSpan.audit({ headers, params: { bulkQuoteId } }, EventSdk.AuditEventAction.start)
      await this.forwardBulkQuoteGet(headers, bulkQuoteId, childSpan)
    } catch (err) {
      // any-error
      // as we are on our own in this context, dont just rethrow the error, instead...
      // get the model to handle it
      this.writeLog(`Error forwarding bulk quote get: ${getStackOrInspect(err)}. Attempting to send error callback to ${fspiopSource}`)
      await this.handleException(fspiopSource, bulkQuoteId, err, headers, childSpan)
    } finally {
      if (childSpan && !childSpan.isFinished) {
        await childSpan.finish()
      }
    }
  }

  /**
   * Attempts to forward a bulk quote GET request
   *
   * @returns {undefined}
   */
  async forwardBulkQuoteGet (headers, bulkQuoteId, span) {
    let endpoint
    try {
      // lookup payee dfsp callback endpoint
      // todo: for MVP we assume initiator is always payer dfsp! this may not always be the case if a xfer is requested by payee
      const fspiopSource = headers[ENUM.Http.Headers.FSPIOP.SOURCE]
      const fspiopDest = headers[ENUM.Http.Headers.FSPIOP.DESTINATION]
      endpoint = await this._getParticipantEndpoint(fspiopDest)

      this.writeLog(`Resolved ${fspiopDest} FSPIOP_CALLBACK_URL_BULK_QUOTES endpoint for bulk quote GET ${bulkQuoteId} to: ${util.inspect(endpoint)}`)

      if (!endpoint) {
        // we didnt get an endpoint for the payee dfsp!
        // make an error callback to the initiator
        // internal-error
        const extensions = [{
          key: 'system',
          value: '["proxyClient","db"]'
        }]
        throw ErrorHandler.CreateFSPIOPError(
          ErrorHandler.Enums.FSPIOPErrorCodes.DESTINATION_FSP_ERROR,
          `No FSPIOP_CALLBACK_URL_BULK_QUOTES found for bulk quote GET ${bulkQuoteId}`,
          null,
          fspiopSource,
          extensions
        )
      }

      const fullCallbackUrl = `${endpoint}/bulkQuotes/${bulkQuoteId}`
      const newHeaders = generateRequestHeaders(headers, this.envConfig.protocolVersions)

      this.writeLog(`Forwarding quote get request to endpoint: ${fullCallbackUrl}`)

      let opts = {
        method: ENUM.Http.RestMethods.GET,
        url: fullCallbackUrl,
        headers: newHeaders
      }

      if (span) {
        opts = span.injectContextToHttpRequest(opts)
        span.audit(opts, EventSdk.AuditEventAction.egress)
      }

      await httpRequest(opts, fspiopSource)
    } catch (err) {
      // any-error
      this.writeLog(`Error forwarding quote get request: ${getStackOrInspect(err)}`)
      const extensions = [{
        key: 'system',
        value: '["http","proxyClient","db"]'
      }]
      throw ErrorHandler.ReformatFSPIOPError(
        err,
        undefined,
        undefined,
        extensions
      )
    }
  }

  /**
   * Handles error reports from clients e.g. POST bulkQuotes/{id}/error
   *
   * @returns {undefined}
   */
  async handleBulkQuoteError (headers, bulkQuoteId, error, span) {
    let newError
    const fspiopSource = headers[ENUM.Http.Headers.FSPIOP.SOURCE]
    const childSpan = span.getChild('qs_quote_forwardBulkQuoteError')
    try {
      // create a new object to represent the error
      const fspiopError = ErrorHandler.CreateFSPIOPErrorFromErrorInformation(error)
      await childSpan.audit({ headers, params: { bulkQuoteId } }, EventSdk.AuditEventAction.start)
      // Needed to add await here to prevent 'span already finished' bug
      await this.sendErrorCallback(headers[ENUM.Http.Headers.FSPIOP.DESTINATION], fspiopError, bulkQuoteId, headers, childSpan, false)
      return newError
    } catch (err) {
      // internal-error
      this.writeLog(`Error in handleBulkQuoteError: ${getStackOrInspect(err)}`)
      await this.handleException(fspiopSource, bulkQuoteId, err, headers, childSpan)
    } finally {
      if (childSpan && !childSpan.isFinished) {
        await childSpan.finish()
      }
    }
  }

  /**
   * Attempts to handle an exception in a sensible manner by forwarding it on to the
   * source of the request that caused the error.
   */
  async handleException (fspiopSource, bulkQuoteId, error, headers, span) {
    // is this exception already wrapped as an API spec compatible type?
    const fspiopError = ErrorHandler.ReformatFSPIOPError(error)

    const childSpan = span.getChild('qs_bulkQuote_sendErrorCallback')
    try {
      await childSpan.audit({ headers, params: { bulkQuoteId } }, EventSdk.AuditEventAction.start)
      return await this.sendErrorCallback(fspiopSource, fspiopError, bulkQuoteId, headers, childSpan, true)
    } catch (err) {
      // any-error
      // not much we can do other than log the error
      this.writeLog(`Error occurred while handling error. Check service logs as this error may not have been propagated successfully to any other party: ${getStackOrInspect(err)}`)
    } finally {
      if (!childSpan.isFinished) {
        await childSpan.finish()
      }
    }
  }

  /**
   * Makes an error callback. Callback is sent to the FSPIOP_CALLBACK_URL_QUOTES endpoint of the replyTo participant in the
   * supplied fspiopErr object. This should be the participantId for the error callback recipient e.g. value from the
   * FSPIOP-Source header of the original request that caused the error.
   *
   * @returns {promise}
   */
  async sendErrorCallback (fspiopSource, fspiopError, bulkQuoteId, headers, span, modifyHeaders = true) {
    // todo: refactor to remove lots of code duplication from QuotesModel/FxQuotesModel!!
    const { envConfig } = this
    const fspiopDest = headers[ENUM.Http.Headers.FSPIOP.DESTINATION]
    try {
      // look up the callback base url
      const endpoint = await this._getParticipantEndpoint(fspiopSource)

      this.writeLog(`Resolved participant '${fspiopSource}' '${ENUM.EndPoints.FspEndpointTypes.FSPIOP_CALLBACK_URL_BULK_QUOTES}' to: '${endpoint}'`)

      if (!endpoint) {
        // oops, we cant make an error callback if we dont have an endpoint to call!
        // internal-error
        const extensions = [{
          key: 'system',
          value: '["proxyClient","db"]'
        }]
        throw ErrorHandler.CreateFSPIOPError(
          ErrorHandler.Enums.FSPIOPErrorCodes.PARTY_NOT_FOUND,
          `No FSPIOP_CALLBACK_URL_BULK_QUOTES found for ${fspiopSource} unable to make error callback`,
          null,
          fspiopSource,
          extensions
        )
      }

      const fspiopUri = `/bulkQuotes/${bulkQuoteId}/error`
      const fullCallbackUrl = `${endpoint}${fspiopUri}`

      // log the original error
      this.writeLog(`Making error callback to participant '${fspiopSource}' for bulkQuoteId '${bulkQuoteId}' to ${fullCallbackUrl} for error: ${util.inspect(fspiopError.toFullErrorObject())}`)

      // make an error callback
      let fromSwitchHeaders
      let formattedHeaders

      // modify/set the headers only in case it is explicitly requested to do so
      // as this part needs to cover two different cases:
      // 1. (do not modify them) when the Switch needs to relay an error, e.g. from a DFSP to another
      // 2. (modify/set them) when the Switch needs send errors that are originating in the Switch, e.g. to send an error back to the caller
      if (modifyHeaders === true) {
        // Should not forward 'fspiop-signature' header for switch generated messages
        delete headers['fspiop-signature']
        fromSwitchHeaders = Object.assign({}, headers, {
          'fspiop-destination': fspiopSource,
          'fspiop-source': envConfig.hubName,
          'fspiop-http-method': ENUM.Http.RestMethods.PUT,
          'fspiop-uri': fspiopUri
        })
      } else {
        fromSwitchHeaders = Object.assign({}, headers)
      }

      // JWS Signer expects headers in lowercase
      if (envConfig.jws && envConfig.jws.jwsSign && fromSwitchHeaders['fspiop-source'] === envConfig.jws.fspiopSourceToSign) {
        formattedHeaders = generateRequestHeadersForJWS(fromSwitchHeaders, envConfig.protocolVersions, true)
      } else {
        formattedHeaders = generateRequestHeaders(fromSwitchHeaders, envConfig.protocolVersions, true)
      }

      let opts = {
        method: ENUM.Http.RestMethods.PUT,
        url: fullCallbackUrl,
        data: fspiopError.toApiErrorObject(envConfig.errorHandling),
        // use headers of the error object if they are there...
        // otherwise use sensible defaults
        headers: formattedHeaders
      }

      if (span) {
        opts = span.injectContextToHttpRequest(opts)
        const { data, ...rest } = opts
        span.audit({ ...rest, payload: data }, EventSdk.AuditEventAction.egress)
      }

      let res
      try {
        // If JWS is enabled and the 'fspiop-source' matches the configured jws header value(i.e the hub name)
        // that means it's a switch generated message and we need to sign it
        if (envConfig.jws && envConfig.jws.jwsSign && opts.headers['fspiop-source'] === envConfig.jws.fspiopSourceToSign) {
          this.writeLog('Getting the JWS Signer to sign the switch generated message')
          const jwsSigner = new JwsSigner({
            logger: Logger,
            signingKey: envConfig.jws.jwsSigningKey
          })
          opts.headers['fspiop-signature'] = jwsSigner.getSignature(opts)
        }

        res = await axios.request(opts)
      } catch (err) {
        // external-error
        const extensions = [{
          key: 'system',
          value: '["http","proxyClient","db"]'
        }]
        throw ErrorHandler.CreateFSPIOPError(
          ErrorHandler.Enums.FSPIOPErrorCodes.DESTINATION_COMMUNICATION_ERROR,
          `network error in sendErrorCallback: ${err.message}`,
          {
            error: err,
            url: fullCallbackUrl,
            sourceFsp: fspiopSource,
            destinationFsp: fspiopDest,
            method: opts && opts.method,
            request: JSON.stringify(opts, LibUtil.getCircularReplacer())
          },
          fspiopSource,
          extensions
        )
      }
      this.writeLog(`Error callback got response ${res.status} ${res.statusText}`)

      if (res.status !== ENUM.Http.ReturnCodes.OK.CODE) {
        // external-error
        const extensions = [{
          key: 'system',
          value: '["http"]'
        }]
        throw ErrorHandler.CreateFSPIOPError(
          ErrorHandler.Enums.FSPIOPErrorCodes.DESTINATION_COMMUNICATION_ERROR,
          'Got non-success response sending error callback', {
            url: fullCallbackUrl,
            sourceFsp: fspiopSource,
            destinationFsp: fspiopDest,
            method: opts && opts.method,
            request: JSON.stringify(opts, LibUtil.getCircularReplacer()),
            response: JSON.stringify(res, LibUtil.getCircularReplacer())
          },
          fspiopSource,
          extensions
        )
      }
    } catch (err) {
      // any-error
      this.writeLog(`Error in sendErrorCallback: ${getStackOrInspect(err)}`)
      const extensions = [{
        key: 'system',
        value: '["http","proxyClient","db"]'
      }]
      const fspiopError = ErrorHandler.ReformatFSPIOPError(
        err,
        undefined,
        undefined,
        extensions
      )
      const state = new EventSdk.EventStateMetadata(EventSdk.EventStatusType.failed, fspiopError.apiErrorCode.code, fspiopError.apiErrorCode.message)
      if (span) {
        await span.error(fspiopError, state)
        await span.finish(fspiopError.message, state)
      }
      throw fspiopError
    }
  }

  // wrapping this dependency here to allow for easier use and testing
  async _getParticipantEndpoint (fspId, endpointType = ENUM.EndPoints.FspEndpointTypes.FSPIOP_CALLBACK_URL_BULK_QUOTES) {
    return getParticipantEndpoint({ fspId, db: this.db, loggerFn: this.writeLog.bind(this), endpointType, proxyClient: this.proxyClient })
  }

  /**
   * Writes a formatted message to the console
   *
   * @returns {undefined}
   */
  // eslint-disable-next-line no-unused-vars
  writeLog (message) {
    Logger.isDebugEnabled && Logger.debug(`${new Date().toISOString()}, (${this.requestId}) [bulkQuotesModel]: ${message}`)
  }
}

module.exports = BulkQuotesModel
