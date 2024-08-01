/*****
 LICENSE

 Copyright © 2020 Mojaloop Foundation

 The Mojaloop files are made available by the Mojaloop Foundation under the Apache License, Version 2.0
 (the "License") and you may not use these files except in compliance with the [License](http://www.apache.org/licenses/LICENSE-2.0).

 You may obtain a copy of the License at [http://www.apache.org/licenses/LICENSE-2.0](http://www.apache.org/licenses/LICENSE-2.0)

 Unless required by applicable law or agreed to in writing, the Mojaloop files are distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND,
 either express or implied. See the License for the specific language governing permissions and limitations under the [License](http://www.apache.org/licenses/LICENSE-2.0).

 * Infitx
 - Steven Oderayi <steven.oderayi@infitx.com>
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
const { loggerFactory } = require('../lib')
const { httpRequest } = require('../lib/http')
const { getStackOrInspect, generateRequestHeadersForJWS, generateRequestHeaders, getParticipantEndpoint } = require('../lib/util')
const LOCAL_ENUM = require('../lib/enum')

axios.defaults.headers.common = {}

class FxQuotesModel {
  constructor (deps) {
    this.db = deps.db
    this.requestId = deps.requestId
    this.proxyClient = deps.proxyClient
    this.envConfig = deps.envConfig || new Config()
    this.log = deps.log || loggerFactory(this.constructor.name)
  }

  /**
   * Validates the fx quote request object
   *
   * @returns {promise} - promise will reject if request is not valid
   */
  async validateFxQuoteRequest (fspiopDestination, fxQuoteRequest) {
    const currencies = [fxQuoteRequest.conversionTerms.sourceAmount.currency, fxQuoteRequest.conversionTerms.targetAmount.currency]

    // Ensure the proxy client is connected
    if (this.proxyClient?.isConnected === false) await this.proxyClient.connect()
    // if the payee dfsp has a proxy cache entry, we do not validate the dfsp here
    const proxy = await this.proxyClient?.lookupProxyByDfspId(fspiopDestination)
    if (!proxy) {
      await Promise.all(currencies.map((currency) => {
        return this.db.getParticipant(fspiopDestination, LOCAL_ENUM.COUNTERPARTY_FSP, currency, ENUM.Accounts.LedgerAccountType.POSITION)
      }))
    }
  }

  /**
   * Logic for creating and handling fx quote requests
   *
   * @returns {undefined}
   */
  async handleFxQuoteRequest (headers, fxQuoteRequest, span) {
    let fspiopSource
    const childSpan = span.getChild('qs_fxquote_forwardFxQuoteRequest')
    try {
      await childSpan.audit({ headers, payload: fxQuoteRequest }, EventSdk.AuditEventAction.start)

      fspiopSource = headers[ENUM.Http.Headers.FSPIOP.SOURCE]
      const fspiopDestination = headers[ENUM.Http.Headers.FSPIOP.DESTINATION]

      await this.validateFxQuoteRequest(fspiopDestination, fxQuoteRequest)

      await this.forwardFxQuoteRequest(headers, fxQuoteRequest.conversionRequestId, fxQuoteRequest, childSpan)
    } catch (err) {
      this.writeLog(`Error forwarding fx quote request: ${getStackOrInspect(err)}. Attempting to send error callback to ${fspiopSource}`)
      await this.handleException(fspiopSource, fxQuoteRequest.conversionRequestId, err, headers, childSpan)
    } finally {
      if (childSpan && !childSpan.isFinished) {
        await childSpan.finish()
      }
    }
  }

  /**
   * Forwards an fx quote request to the destination fxp for processing
   *
   * @returns {undefined}
   */
  async forwardFxQuoteRequest (headers, conversionRequestId, originalFxQuoteRequest, span) {
    let endpoint
    const fspiopSource = headers[ENUM.Http.Headers.FSPIOP.SOURCE]
    const fspiopDest = headers[ENUM.Http.Headers.FSPIOP.DESTINATION]

    try {
      // lookup the fxp callback endpoint
      endpoint = await this._getParticipantEndpoint(fspiopDest)

      this.writeLog(`Resolved FSPIOP_CALLBACK_URL_FX_QUOTES endpoint for fxQuote ${conversionRequestId} to: ${util.inspect(endpoint)}`)

      if (!endpoint) {
        throw ErrorHandler.CreateFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.DESTINATION_FSP_ERROR, `No FSPIOP_CALLBACK_URL_FX_QUOTES endpoint found for FXP '${fspiopDest}' while processing fxquote ${conversionRequestId}`, null, fspiopSource)
      }

      const fullCallbackUrl = `${endpoint}${ENUM.EndPoints.FspEndpointTemplates.FX_QUOTES_POST}`
      const newHeaders = generateRequestHeaders(headers, this.db.config.protocolVersions)

      this.writeLog(`Forwarding fx quote request to endpoint: ${fullCallbackUrl}`)
      this.writeLog(`Forwarding fx quote request headers: ${JSON.stringify(newHeaders)}`)
      this.writeLog(`Forwarding fx quote request body: ${JSON.stringify(originalFxQuoteRequest)}`)

      let opts = {
        method: ENUM.Http.RestMethods.POST,
        url: fullCallbackUrl,
        data: JSON.stringify(originalFxQuoteRequest),
        headers: newHeaders
      }

      if (span) {
        opts = span.injectContextToHttpRequest(opts)
        span.audit(opts, EventSdk.AuditEventAction.egress)
      }

      this.writeLog(`Forwarding request : ${util.inspect(opts)}`)
      await httpRequest(opts, fspiopSource)
    } catch (err) {
      this.writeLog(`Error forwarding fxQuote request to endpoint ${endpoint}: ${getStackOrInspect(err)}`)
      throw ErrorHandler.ReformatFSPIOPError(err)
    }
  }

  /**
   * Logic for handling fx quote update requests e.g. PUT /fxQuotes/{id} requests
   *
   * @returns {undefined}
   */
  async handleFxQuoteUpdate (headers, conversionRequestId, fxQuoteUpdateRequest, span) {
    if ('accept' in headers) {
      throw ErrorHandler.CreateFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.VALIDATION_ERROR,
        `Update for fx quote ${conversionRequestId} failed: "accept" header should not be sent in callbacks.`, null, headers['fspiop-source'])
    }

    const childSpan = span.getChild('qs_quote_forwardFxQuoteUpdate')
    try {
      await childSpan.audit({ headers, params: { conversionRequestId }, payload: fxQuoteUpdateRequest }, EventSdk.AuditEventAction.start)
      await this.forwardFxQuoteUpdate(headers, conversionRequestId, fxQuoteUpdateRequest, childSpan)
    } catch (err) {
      const fspiopSource = headers[ENUM.Http.Headers.FSPIOP.SOURCE]
      this.writeLog(`Error forwarding fx quote update: ${getStackOrInspect(err)}. Attempting to send error callback to ${fspiopSource}`)
      await this.handleException(fspiopSource, conversionRequestId, err, headers, childSpan)
    } finally {
      if (childSpan && !childSpan.isFinished) {
        await childSpan.finish()
      }
    }
  }

  /**
   * Forwards an fx quote response to a payer DFSP for processing
   *
   * @returns {undefined}
   */
  async forwardFxQuoteUpdate (headers, conversionRequestId, originalFxQuoteResponse, span) {
    let endpoint = null
    const fspiopSource = headers[ENUM.Http.Headers.FSPIOP.SOURCE]
    const fspiopDest = headers[ENUM.Http.Headers.FSPIOP.DESTINATION]

    try {
      endpoint = await this._getParticipantEndpoint(fspiopDest)
      this.writeLog(`Resolved PAYER party FSPIOP_CALLBACK_URL_FX_QUOTES endpoint for fx quote ${conversionRequestId} to: ${util.inspect(endpoint)}`)

      if (!endpoint) {
        const fspiopError = ErrorHandler.CreateFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.DESTINATION_FSP_ERROR, `No FSPIOP_CALLBACK_URL_FX_QUOTES endpoint found for PAYER party FSP '${fspiopDest}' while processing quote ${conversionRequestId}`, null, fspiopSource)
        return this.sendErrorCallback(fspiopSource, fspiopError, conversionRequestId, headers, span, true)
      }

      const fullCallbackUrl = `${endpoint}/fxQuotes/${conversionRequestId}`
      // we need to strip off the 'accept' header
      // for all PUT requests as per the API Specification Document
      // https://github.com/mojaloop/mojaloop-specification/blob/main/documents/v1.1-document-set/fspiop-v1.1-openapi2.yaml
      const newHeaders = generateRequestHeaders(headers, this.db.config.protocolVersions, true)

      this.writeLog(`Forwarding fx quote response to endpoint: ${fullCallbackUrl}`)
      this.writeLog(`Forwarding fx quote response headers: ${JSON.stringify(newHeaders)}`)
      this.writeLog(`Forwarding fx quote response body: ${JSON.stringify(originalFxQuoteResponse)}`)

      let opts = {
        method: ENUM.Http.RestMethods.PUT,
        url: fullCallbackUrl,
        data: JSON.stringify(originalFxQuoteResponse),
        headers: newHeaders
      }

      if (span) {
        opts = span.injectContextToHttpRequest(opts)
        span.audit(opts, EventSdk.AuditEventAction.egress)
      }

      await httpRequest(opts, fspiopSource)
    } catch (err) {
      this.writeLog(`Error forwarding fx quote callback to endpoint ${endpoint}: ${getStackOrInspect(err)}`)
      throw ErrorHandler.ReformatFSPIOPError(err)
    }
  }

  /**
   * Attempts to handle an fx quote GET request by forwarding it to the destination FXP
   *
   * @returns {undefined}
   */
  async handleFxQuoteGet (headers, conversionRequestId, span) {
    const fspiopSource = headers[ENUM.Http.Headers.FSPIOP.SOURCE]
    const childSpan = span.getChild('qs_quote_forwardFxQuoteGet')
    try {
      await childSpan.audit({ headers, params: { conversionRequestId } }, EventSdk.AuditEventAction.start)
      await this.forwardFxQuoteGet(headers, conversionRequestId, childSpan)
    } catch (err) {
      this.writeLog(`Error forwarding fx quote get: ${getStackOrInspect(err)}. Attempting to send error callback to ${fspiopSource}`)
      await this.handleException(fspiopSource, conversionRequestId, err, headers, childSpan)
    } finally {
      if (childSpan && !childSpan.isFinished) {
        await childSpan.finish()
      }
    }
  }

  /**
   * Attempts to forward an fx quote GET request
   *
   * @returns {undefined}
   */
  async forwardFxQuoteGet (headers, conversionRequestId, span) {
    let endpoint
    try {
      // lookup fxp callback endpoint
      const fspiopSource = headers[ENUM.Http.Headers.FSPIOP.SOURCE]
      const fspiopDest = headers[ENUM.Http.Headers.FSPIOP.DESTINATION]
      endpoint = await this._getParticipantEndpoint(fspiopDest)

      this.writeLog(`Resolved ${fspiopDest} FSPIOP_CALLBACK_URL_FX_QUOTES endpoint for fx quote GET ${conversionRequestId} to: ${util.inspect(endpoint)}`)

      if (!endpoint) {
        throw ErrorHandler.CreateFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.DESTINATION_FSP_ERROR, `No FSPIOP_CALLBACK_URL_FX_QUOTES endpoint found for FXP '${fspiopDest}' while processing fxquote GET ${conversionRequestId}`, null, fspiopSource)
      }

      const fullCallbackUrl = `${endpoint}/fxQuotes/${conversionRequestId}`
      const newHeaders = generateRequestHeaders(headers, this.db.config.protocolVersions)

      this.writeLog(`Forwarding fx quote get request to endpoint: ${fullCallbackUrl}`)

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
      this.writeLog(`Error forwarding fx quote get request: ${getStackOrInspect(err)}`)
      throw ErrorHandler.ReformatFSPIOPError(err)
    }
  }

  /**
   * Handles fx quote error callback e.g. PUT fxQuotes/{id}/error
   *
   * @returns {undefined}
   */
  async handleFxQuoteError (headers, conversionRequestId, error, span) {
    let newError
    const fspiopSource = headers[ENUM.Http.Headers.FSPIOP.SOURCE]
    const childSpan = span.getChild('qs_quote_forwardFxQuoteError')
    try {
      const fspiopError = ErrorHandler.CreateFSPIOPErrorFromErrorInformation(error)
      await childSpan.audit({ headers, params: { conversionRequestId } }, EventSdk.AuditEventAction.start)
      await this.sendErrorCallback(headers[ENUM.Http.Headers.FSPIOP.DESTINATION], fspiopError, conversionRequestId, headers, childSpan, false)
      return newError
    } catch (err) {
      this.writeLog(`Error in handleFxQuoteError: ${getStackOrInspect(err)}`)
      await this.handleException(fspiopSource, conversionRequestId, err, headers, childSpan)
    } finally {
      if (childSpan && !childSpan.isFinished) {
        await childSpan.finish()
      }
    }
  }

  /**
   * Attempts to handle an exception in a sensible manner by forwarding it on to the
   * dfsp that initiated the request.
   */
  async handleException (fspiopSource, conversionRequestId, error, headers, span) {
    const fspiopError = ErrorHandler.ReformatFSPIOPError(error)

    const childSpan = span.getChild('qs_fxQuote_sendErrorCallback')
    try {
      await childSpan.audit({ headers, params: { conversionRequestId } }, EventSdk.AuditEventAction.start)
      return await this.sendErrorCallback(fspiopSource, fspiopError, conversionRequestId, headers, childSpan, true)
    } catch (err) {
      this.log.error('error in handleException, stop request processing!', err)
    } finally {
      if (!childSpan.isFinished) {
        await childSpan.finish()
      }
    }
  }

  /**
   * Makes an error callback. Callback is sent to the FSPIOP_CALLBACK_URL_FX_QUOTES endpoint of the replyTo participant in the
   * supplied fspiopErr object. This should be the participantId for the error callback recipient e.g. value from the
   * FSPIOP-Source header of the original request that caused the error.
   *
   * @returns {promise}
   */
  async sendErrorCallback (fspiopSource, fspiopError, conversionRequestId, headers, span, modifyHeaders = true) {
    const { envConfig, log } = this
    const fspiopDest = headers[ENUM.Http.Headers.FSPIOP.DESTINATION]

    try {
      const endpoint = await this._getParticipantEndpoint(fspiopSource)
      if (!endpoint) {
        throw ErrorHandler.CreateFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.PARTY_NOT_FOUND, `No FSPIOP_CALLBACK_URL_FX_QUOTES endpoint found for FSP '${fspiopSource}', unable to make error callback`, null, fspiopSource)
      }

      const fspiopUri = `/fxQuotes/${conversionRequestId}/error`
      const fullCallbackUrl = `${endpoint}${fspiopUri}`

      log.info('Making error callback to participant...', { fspiopSource, conversionRequestId, fspiopError, fullCallbackUrl })

      // make an error callback
      let fromSwitchHeaders

      // modify/set the headers only in case it is explicitly requested to do so
      // as this part needs to cover two different cases:
      // 1. (do not modify them) when the Switch needs to relay an error, e.g. from a DFSP to another
      // 2. (modify/set them) when the Switch needs to send errors that are originating in the Switch, e.g. to send an error back to the caller
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
      const formattedHeaders =
        envConfig.jws?.jwsSign && fromSwitchHeaders['fspiop-source'] === envConfig.jws.fspiopSourceToSign
          ? generateRequestHeadersForJWS(fromSwitchHeaders, this.db.config.protocolVersions, true)
          : generateRequestHeaders(fromSwitchHeaders, this.db.config.protocolVersions, true)

      let opts = {
        method: ENUM.Http.RestMethods.PUT,
        url: fullCallbackUrl,
        data: JSON.stringify(fspiopError.toApiErrorObject(envConfig.errorHandling), LibUtil.getCircularReplacer()),
        headers: formattedHeaders
      }

      if (span) {
        opts = span.injectContextToHttpRequest(opts)
        span.audit(opts, EventSdk.AuditEventAction.egress)
      }

      let res
      try {
        // If JWS is enabled and the 'fspiop-source' matches the configured jws header value('switch')
        // that means it's a switch generated message and we need to sign it
        if (envConfig.jws?.jwsSign && opts.headers['fspiop-source'] === envConfig.jws.fspiopSourceToSign) {
          const logger = Logger
          logger.log = logger.info
          this.writeLog('Getting the JWS Signer to sign the switch generated message')
          const jwsSigner = new JwsSigner({
            logger,
            signingKey: envConfig.jws.jwsSigningKey
          })
          opts.headers['fspiop-signature'] = jwsSigner.getSignature(opts)
        }

        res = await this.sendHttpRequest(opts)
      } catch (err) {
        throw ErrorHandler.CreateFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.DESTINATION_COMMUNICATION_ERROR, `network error in sendErrorCallback: ${err.message}`, {
          error: err,
          url: fullCallbackUrl,
          sourceFsp: fspiopSource,
          destinationFsp: fspiopDest,
          method: opts && opts.method,
          request: JSON.stringify(opts, LibUtil.getCircularReplacer())
        }, fspiopSource)
      }
      this.writeLog(`Error callback got response ${res.status} ${res.statusText}`)

      if (res.status !== ENUM.Http.ReturnCodes.OK.CODE) {
        throw ErrorHandler.CreateFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.DESTINATION_COMMUNICATION_ERROR, 'Got non-success response sending error callback', {
          url: fullCallbackUrl,
          sourceFsp: fspiopSource,
          destinationFsp: fspiopDest,
          method: opts && opts.method,
          request: JSON.stringify(opts, LibUtil.getCircularReplacer()),
          response: JSON.stringify(res, LibUtil.getCircularReplacer())
        }, fspiopSource)
      }
    } catch (err) {
      this.log.error('Error in sendErrorCallback', err)
      const fspiopError = ErrorHandler.ReformatFSPIOPError(err)
      const state = new EventSdk.EventStateMetadata(EventSdk.EventStatusType.failed, fspiopError.apiErrorCode.code, fspiopError.apiErrorCode.message)
      if (span) {
        await span.error(fspiopError, state)
        await span.finish(fspiopError.message, state)
      }
      throw fspiopError
    }
  }

  // wrapping this dependency here to allow for easier use and testing
  async _getParticipantEndpoint (fspId, endpointType = ENUM.EndPoints.FspEndpointTypes.FSPIOP_CALLBACK_URL_FX_QUOTES) {
    const { db, proxyClient, log } = this
    const endpoint = await getParticipantEndpoint({ fspId, db, loggerFn: this.writeLog.bind(this), endpointType, proxyClient })
    log.debug('Resolved participant endpoint:', { fspId, endpoint, endpointType })
    return endpoint
  }

  /**
   * Writes a formatted message to the console
   *
   * @returns {undefined}
   */
  writeLog (message) {
    Logger.isDebugEnabled && Logger.debug(`${new Date().toISOString()}, (${this.requestId}) [fxQuotesModel]: ${message}`)
  }

  /**
   * Writes a formatted message to the console
   * @param {AxiosRequestConfig} options
   * @returns {AxiosResponse}
   */
  async sendHttpRequest (options) {
    return axios.request(options)
  }
}

module.exports = FxQuotesModel
