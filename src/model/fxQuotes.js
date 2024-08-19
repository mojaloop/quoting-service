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
const { getStackOrInspect, generateRequestHeadersForJWS, generateRequestHeaders, getParticipantEndpoint, calculateRequestHash } = require('../lib/util')
const LOCAL_ENUM = require('../lib/enum')
const { RESOURCES } = require('../constants')

axios.defaults.headers.common = {}

class FxQuotesModel {
  constructor (deps) {
    this.db = deps.db
    this.requestId = deps.requestId
    this.proxyClient = deps.proxyClient
    this.envConfig = deps.envConfig || new Config()
    this.log = deps.log || loggerFactory({
      context: this.constructor.name,
      requestId: this.requestId
    })
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

  async checkDuplicateFxQuoteRequest (fxQuoteRequest) {
    try {
      // calculate a SHA-256 of the request
      const hash = calculateRequestHash(fxQuoteRequest)
      this.log.debug(`Calculated sha256 hash of quote request with id ${fxQuoteRequest.conversionRequestId} as: ${hash}`)

      const dupchk = await this.db.getFxQuoteDuplicateCheck(fxQuoteRequest.conversionRequestId)
      this.log.debug(`DB query for quote duplicate check with id ${fxQuoteRequest.conversionRequestId} returned: ${util.inspect(dupchk)}`)

      if (!dupchk) {
        // no existing record for this quoteId found
        return {
          isResend: false,
          isDuplicateId: false
        }
      }

      if (dupchk.hash === hash) {
        // hash matches, this is a resend
        return {
          isResend: true,
          isDuplicateId: true
        }
      }

      // if we get here then this is a duplicate id but not a resend e.g. hashes dont match.
      return {
        isResend: false,
        isDuplicateId: true
      }
    } catch (err) {
      // internal-error
      this.log.error(`Error in checkDuplicateFxQuoteRequest: ${getStackOrInspect(err)}`)
      throw ErrorHandler.ReformatFSPIOPError(err)
    }
  }

  async checkDuplicateFxQuoteResponse (conversionRequestId, fxQuoteResponse) {
    try {
      // calculate a SHA-256 of the request
      const hash = calculateRequestHash(fxQuoteResponse)
      this.log.debug(`Calculated sha256 hash of quote response with id ${conversionRequestId} as: ${hash}`)

      const dupchk = await this.db.getFxQuoteResponseDuplicateCheck(conversionRequestId)
      this.log.debug(`DB query for quote response duplicate check with id ${conversionRequestId} returned: ${util.inspect(dupchk)}`)

      if (!dupchk) {
        // no existing record for this conversionRequestId found
        return {
          isResend: false,
          isDuplicateId: false
        }
      }

      if (dupchk.hash === hash) {
        // hash matches, this is a resend
        return {
          isResend: true,
          isDuplicateId: true
        }
      }

      // if we get here then this is a duplicate id but not a resend e.g. hashes dont match.
      return {
        isResend: false,
        isDuplicateId: true
      }
    } catch (err) {
      // internal-error
      this.log.error(`Error in checkDuplicateFxQuoteResponse: ${getStackOrInspect(err)}`)
      throw ErrorHandler.ReformatFSPIOPError(err)
    }
  }

  /**
   * Logic for creating and handling fx quote requests
   *
   * @returns {undefined}
   */
  async handleFxQuoteRequest (headers, fxQuoteRequest, span) {
    let fspiopSource
    let txn
    const childSpan = span.getChild('qs_fxquote_forwardFxQuoteRequest')
    try {
      await childSpan.audit({ headers, payload: fxQuoteRequest }, EventSdk.AuditEventAction.start)

      fspiopSource = headers[ENUM.Http.Headers.FSPIOP.SOURCE]
      const fspiopDestination = headers[ENUM.Http.Headers.FSPIOP.DESTINATION]

      await this.validateFxQuoteRequest(fspiopDestination, fxQuoteRequest)

      const envConfig = new Config()
      if (!envConfig.simpleRoutingMode) {
        // check if this is a resend or an erroneous duplicate
        const dupe = await this.checkDuplicateFxQuoteRequest(fxQuoteRequest)

        // fail fast on duplicate
        if (dupe.isDuplicateId && (!dupe.isResend)) {
          // same quoteId but a different request, this is an error!
          // internal-error
          throw ErrorHandler.CreateFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.MODIFIED_REQUEST,
            `Quote ${fxQuoteRequest.conversionRequestId} is a duplicate but hashes dont match`, null, fspiopSource)
        }

        if (dupe.isResend && dupe.isDuplicateId) {
          // this is a resend
          // See section 3.2.5.1 in "API Definition v1.0.docx" API specification document.
          return this.handleFxQuoteRequestResend(
            headers,
            fxQuoteRequest,
            span
          )
        }

        // if we get here we need to create a duplicate check row
        const hash = calculateRequestHash(fxQuoteRequest)

        // do everything in a db txn so we can rollback multiple operations if something goes wrong
        txn = await this.db.newTransaction()
        await this.db.createFxQuoteDuplicateCheck(txn, fxQuoteRequest.conversionRequestId, hash)

        await this.db.createFxQuote(txn, fxQuoteRequest.conversionRequestId)

        await this.db.createFxQuoteConversionTerms(
          txn,
          fxQuoteRequest.conversionRequestId,
          fxQuoteRequest.conversionTerms
        )
        if (fxQuoteRequest.conversionTerms.extensionList &&
          Array.isArray(fxQuoteRequest.conversionTerms.extensionList.extension)) {
          await this.db.createFxQuoteConversionTermsExtension(
            txn,
            fxQuoteRequest.conversionTerms.conversionId,
            fxQuoteRequest.conversionTerms.extensionList.extension
          )
        }

        await txn.commit()
      }

      await this.forwardFxQuoteRequest(headers, fxQuoteRequest.conversionRequestId, fxQuoteRequest, childSpan)
    } catch (err) {
      this.log.error('error in handleFxQuoteRequest', err)
      if (txn) {
        txn.rollback(err)
      }
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
    try {
      const fspiopSource = headers[ENUM.Http.Headers.FSPIOP.SOURCE]
      const fspiopDest = headers[ENUM.Http.Headers.FSPIOP.DESTINATION]
      this.log.verbose('forwardFxQuoteRequest details:', { conversionRequestId, fspiopSource, fspiopDest })

      // lookup the fxp callback endpoint
      const endpoint = await this._getParticipantEndpoint(fspiopDest)
      if (!endpoint) {
        throw ErrorHandler.CreateFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.DESTINATION_FSP_ERROR, `No FSPIOP_CALLBACK_URL_FX_QUOTES endpoint found for FXP '${fspiopDest}' while processing fxquote ${conversionRequestId}`, null, fspiopSource)
      }

      let opts = {
        method: ENUM.Http.RestMethods.POST,
        url: `${endpoint}${ENUM.EndPoints.FspEndpointTemplates.FX_QUOTES_POST}`,
        data: JSON.stringify(originalFxQuoteRequest),
        headers: generateRequestHeaders(headers, this.db.config.protocolVersions, false, RESOURCES.fxQuotes)
      }
      this.log.debug('Forwarding fxQuote request details', { conversionRequestId, opts })

      if (span) {
        opts = span.injectContextToHttpRequest(opts)
        span.audit(opts, EventSdk.AuditEventAction.egress)
      }

      await httpRequest(opts, fspiopSource)
    } catch (err) {
      this.log.error('error in forwardFxQuoteRequest', err)
      throw ErrorHandler.ReformatFSPIOPError(err)
    }
  }

  /**
   * Logic for handling fx quote update requests e.g. PUT /fxQuotes/{id} requests
   *
   * @returns {undefined}
   */
  async handleFxQuoteUpdate (headers, conversionRequestId, fxQuoteUpdateRequest, span) {
    let txn
    const fspiopSource = headers[ENUM.Http.Headers.FSPIOP.SOURCE]
    if ('accept' in headers) {
      throw ErrorHandler.CreateFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.VALIDATION_ERROR,
        `Update for fx quote ${conversionRequestId} failed: "accept" header should not be sent in callbacks.`, null, headers['fspiop-source'])
    }

    const childSpan = span.getChild('qs_quote_forwardFxQuoteUpdate')
    try {
      await childSpan.audit({ headers, params: { conversionRequestId }, payload: fxQuoteUpdateRequest }, EventSdk.AuditEventAction.start)

      const envConfig = new Config()
      if (!envConfig.simpleRoutingMode) {
        // check if this is a resend or an erroneous duplicate
        const dupe = await this.checkDuplicateFxQuoteResponse(conversionRequestId, fxQuoteUpdateRequest)

        // fail fast on duplicate
        if (dupe.isDuplicateId && (!dupe.isResend)) {
          // internal-error
          // same quoteId but a different request, this is an error!
          throw ErrorHandler.CreateFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.MODIFIED_REQUEST,
            `Update for fxQuote ${conversionRequestId} is a duplicate but hashes don't match`, null, fspiopSource)
        }

        if (dupe.isResend && dupe.isDuplicateId) {
          // this is a resend
          // See section 3.2.5.1 in "API Definition v1.0.docx" API specification document.
          // return this.handleQuoteUpdateResend(headers, quoteId, quoteUpdateRequest, handleQuoteUpdateSpan)
          return this.handleFxQuoteUpdateResend(
            headers,
            conversionRequestId,
            fxQuoteUpdateRequest,
            span
          )
        }

        // do everything in a transaction so we can rollback multiple operations if something goes wrong
        txn = await this.db.newTransaction()

        // create the quote response row in the db
        const newFxQuoteResponse = await this.db.createFxQuoteResponse(
          txn,
          conversionRequestId,
          fxQuoteUpdateRequest
        )

        await this.db.createFxQuoteResponseConversionTerms(
          txn,
          conversionRequestId,
          newFxQuoteResponse.fxQuoteResponseId,
          fxQuoteUpdateRequest.conversionTerms
        )

        if (fxQuoteUpdateRequest.conversionTerms.charges &&
          Array.isArray(fxQuoteUpdateRequest.conversionTerms.charges)) {
          await this.db.createFxQuoteResponseFxCharge(
            txn,
            fxQuoteUpdateRequest.conversionTerms.conversionId,
            fxQuoteUpdateRequest.conversionTerms.charges)
        }

        if (fxQuoteUpdateRequest.conversionTerms.extensionList &&
          Array.isArray(fxQuoteUpdateRequest.conversionTerms.extensionList.extension)) {
          await this.db.createFxQuoteResponseConversionTermsExtension(
            txn,
            fxQuoteUpdateRequest.conversionTerms.conversionId,
            fxQuoteUpdateRequest.conversionTerms.extensionList.extension
          )
        }

        // if we get here we need to create a duplicate check row
        const hash = calculateRequestHash(fxQuoteUpdateRequest)
        await this.db.createFxQuoteResponseDuplicateCheck(txn, newFxQuoteResponse.fxQuoteResponseId, conversionRequestId, hash)

        await txn.commit()
      }

      await this.forwardFxQuoteUpdate(headers, conversionRequestId, fxQuoteUpdateRequest, childSpan)
    } catch (err) {
      this.log.error('error in handleFxQuoteUpdate', err)
      const fspiopSource = headers[ENUM.Http.Headers.FSPIOP.SOURCE]
      if (txn) {
        txn.rollback(err)
      }
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
    try {
      const fspiopSource = headers[ENUM.Http.Headers.FSPIOP.SOURCE]
      const fspiopDest = headers[ENUM.Http.Headers.FSPIOP.DESTINATION]
      this.log.verbose('forwardFxQuoteUpdate request:', { conversionRequestId, fspiopSource, fspiopDest })

      const endpoint = await this._getParticipantEndpoint(fspiopDest)
      if (!endpoint) {
        const fspiopError = ErrorHandler.CreateFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.DESTINATION_FSP_ERROR, `No FSPIOP_CALLBACK_URL_FX_QUOTES endpoint found for PAYER party FSP '${fspiopDest}' while processing quote ${conversionRequestId}`, null, fspiopSource)
        return this.sendErrorCallback(fspiopSource, fspiopError, conversionRequestId, headers, span, true)
      }

      let opts = {
        method: ENUM.Http.RestMethods.PUT,
        url: `${endpoint}/fxQuotes/${conversionRequestId}`,
        data: JSON.stringify(originalFxQuoteResponse),
        headers: generateRequestHeaders(headers, this.db.config.protocolVersions, true, RESOURCES.fxQuotes)
        // we need to strip off the 'accept' header
        // for all PUT requests as per the API Specification Document
        // https://github.com/mojaloop/mojaloop-specification/blob/main/documents/v1.1-document-set/fspiop-v1.1-openapi2.yaml
      }
      this.log.debug('Forwarding fxQuote update request details', { conversionRequestId, opts })

      if (span) {
        opts = span.injectContextToHttpRequest(opts)
        span.audit(opts, EventSdk.AuditEventAction.egress)
      }

      await httpRequest(opts, fspiopSource)
    } catch (err) {
      this.log.error('error in forwardFxQuoteUpdate', err)
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
      this.log.error('error in handleFxQuoteGet', err)
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
    try {
      const fspiopSource = headers[ENUM.Http.Headers.FSPIOP.SOURCE]
      const fspiopDest = headers[ENUM.Http.Headers.FSPIOP.DESTINATION]
      this.log.verbose('forwardFxQuoteGet request', { conversionRequestId, fspiopSource, fspiopDest })
      // lookup fxp callback endpoint
      const endpoint = await this._getParticipantEndpoint(fspiopDest)
      if (!endpoint) {
        throw ErrorHandler.CreateFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.DESTINATION_FSP_ERROR, `No FSPIOP_CALLBACK_URL_FX_QUOTES endpoint found for FXP '${fspiopDest}' while processing fxquote GET ${conversionRequestId}`, null, fspiopSource)
      }

      let opts = {
        method: ENUM.Http.RestMethods.GET,
        url: `${endpoint}/fxQuotes/${conversionRequestId}`,
        headers: generateRequestHeaders(headers, this.db.config.protocolVersions, false, RESOURCES.fxQuotes)
      }
      this.log.debug('Forwarding fxQuote get request details:', { conversionRequestId, opts })

      if (span) {
        opts = span.injectContextToHttpRequest(opts)
        span.audit(opts, EventSdk.AuditEventAction.egress)
      }

      await httpRequest(opts, fspiopSource)
    } catch (err) {
      this.log.error('error in forwardFxQuoteGet', err)
      throw ErrorHandler.ReformatFSPIOPError(err)
    }
  }

  /**
   * Handles fx quote error callback e.g. PUT fxQuotes/{id}/error
   *
   * @returns {undefined}
   */
  async handleFxQuoteError (headers, conversionRequestId, error, span) {
    let txn
    const fspiopSource = headers[ENUM.Http.Headers.FSPIOP.SOURCE]
    const childSpan = span.getChild('qs_quote_forwardFxQuoteError')
    try {
      const envConfig = new Config()
      if (!envConfig.simpleRoutingMode) {
        // do everything in a transaction so we can rollback multiple operations if something goes wrong
        txn = await this.db.newTransaction()

        // persist the error
        await this.db.createFxQuoteError(txn, conversionRequestId, {
          errorCode: Number(error.errorCode),
          errorDescription: error.errorDescription
        })

        // commit the txn to the db
        txn.commit()
      }

      const fspiopError = ErrorHandler.CreateFSPIOPErrorFromErrorInformation(error)
      await childSpan.audit({ headers, params: { conversionRequestId } }, EventSdk.AuditEventAction.start)
      await this.sendErrorCallback(headers[ENUM.Http.Headers.FSPIOP.DESTINATION], fspiopError, conversionRequestId, headers, childSpan, false)
    } catch (err) {
      this.log.error('error in handleFxQuoteError', err)
      if (txn) {
        txn.rollback(err)
      }
      await this.handleException(fspiopSource, conversionRequestId, err, headers, childSpan)
    } finally {
      if (childSpan && !childSpan.isFinished) {
        await childSpan.finish()
      }
    }
  }

  /**
   * Deals with resends of quote requests (POST) under the API spec:
   * See section 3.2.5.1, 9.4 and 9.5 in "API Definition v1.0.docx" API specification document.
   */
  async handleFxQuoteRequestResend (headers, fxQuoteRequest, span, additionalHeaders) {
    try {
      const fspiopSource = headers[ENUM.Http.Headers.FSPIOP.SOURCE]
      this.writeLog(`Handling resend of fxQuoteRequest: ${util.inspect(fxQuoteRequest)} from ${fspiopSource} to ${headers[ENUM.Http.Headers.FSPIOP.DESTINATION]}`)

      // we are ok to assume the quoteRequest object passed to us is the same as the original...
      // as it passed a hash duplicate check...so go ahead and use it to resend rather than
      // hit the db again

      // if we got here rules passed, so we can forward the quote on to the recipient dfsp
      const childSpan = span.getChild('qs_quote_forwardQuoteRequestResend')
      try {
        await childSpan.audit({ headers, payload: fxQuoteRequest }, EventSdk.AuditEventAction.start)
        await this.forwardFxQuoteRequest(headers, fxQuoteRequest.conversionRequestId, fxQuoteRequest, childSpan, additionalHeaders)
      } catch (err) {
        // any-error
        // as we are on our own in this context, dont just rethrow the error, instead...
        // get the model to handle it
        this.log.error(`Error forwarding quote request: ${getStackOrInspect(err)}. Attempting to send error callback to ${fspiopSource}`)
        const fspiopError = ErrorHandler.ReformatFSPIOPError(err)
        await this.handleException(fspiopSource, fxQuoteRequest.conversionRequestId, fspiopError, headers, childSpan)
      } finally {
        if (!childSpan.isFinished) {
          await childSpan.finish()
        }
      }
    } catch (err) {
      // internal-error
      this.log.error(`Error in handleFxQuoteRequestResend: ${getStackOrInspect(err)}`)
      throw ErrorHandler.ReformatFSPIOPError(err)
    }
  }

  /**
   * Deals with resends of quote responses (PUT) under the API spec:
   * See section 3.2.5.1, 9.4 and 9.5 in "API Definition v1.0.docx" API specification document.
   */
  async handleFxQuoteUpdateResend (headers, conversionRequestId, fxQuoteUpdate, span) {
    try {
      const fspiopSource = headers[ENUM.Http.Headers.FSPIOP.SOURCE]
      const fspiopDest = headers[ENUM.Http.Headers.FSPIOP.DESTINATION]
      this.writeLog(`Handling resend of quoteUpdate: ${util.inspect(fxQuoteUpdate)} from ${fspiopSource} to ${fspiopDest}`)

      // we are ok to assume the fxQuoteUpdate object passed to us is the same as the original...
      // as it passed a hash duplicate check...so go ahead and use it to resend rather than
      // hit the db again

      // if we got here rules passed, so we can forward the quote on to the recipient dfsp
      const childSpan = span.getChild('qs_quote_forwardFxQuoteUpdateResend')
      try {
        await childSpan.audit({ headers, params: { conversionRequestId }, payload: fxQuoteUpdate }, EventSdk.AuditEventAction.start)
        await this.forwardFxQuoteUpdate(headers, conversionRequestId, fxQuoteUpdate, childSpan)
      } catch (err) {
        // any-error
        // as we are on our own in this context, dont just rethrow the error, instead...
        // get the model to handle it
        this.log.error(`Error forwarding fxQuote response: ${getStackOrInspect(err)}. Attempting to send error callback to ${fspiopSource}`)
        await this.handleException(fspiopSource, conversionRequestId, err, headers, childSpan)
      } finally {
        if (!childSpan.isFinished) {
          await childSpan.finish()
        }
      }
    } catch (err) {
      // internal-error
      this.log.error(`Error in handleQuoteUpdateResend: ${getStackOrInspect(err)}`)
      throw ErrorHandler.ReformatFSPIOPError(err)
    }
  }

  /**
   * Attempts to handle an exception in a sensible manner by forwarding it on to the
   * dfsp that initiated the request.
   */
  async handleException (fspiopSource, conversionRequestId, error, headers, span) {
    this.log.info('Attempting to send error callback to fspiopSource:', { conversionRequestId, fspiopSource })
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
      log.info('Sending error callback to participant...', { conversionRequestId, fspiopSource, fspiopError, fullCallbackUrl })

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
      const generateHeadersFn = (envConfig.jws?.jwsSign && fromSwitchHeaders['fspiop-source'] === envConfig.jws.fspiopSourceToSign)
        ? generateRequestHeadersForJWS
        : generateRequestHeaders
      const formattedHeaders = generateHeadersFn(fromSwitchHeaders, this.db.config.protocolVersions, true, RESOURCES.fxQuotes)

      let opts = {
        method: ENUM.Http.RestMethods.PUT,
        url: fullCallbackUrl,
        data: JSON.stringify(fspiopError.toApiErrorObject(envConfig.errorHandling), LibUtil.getCircularReplacer()),
        headers: formattedHeaders
      }
      this.addFspiopSignatureHeader(opts) // todo: "combine" with formattedHeaders logic

      if (span) {
        opts = span.injectContextToHttpRequest(opts)
        span.audit(opts, EventSdk.AuditEventAction.egress)
      }

      const res = await this.sendHttpRequest(opts, fspiopSource, fspiopDest)
      const statusCode = res.status
      log.info('got errorCallback response with statusCode:', { statusCode })

      if (statusCode !== ENUM.Http.ReturnCodes.OK.CODE) {
        // think, if it's better to move this logic into this.sendHttpRequest()
        throw ErrorHandler.CreateFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.DESTINATION_COMMUNICATION_ERROR, 'Got non-success response sending error callback', {
          method: opts?.method,
          url: fullCallbackUrl,
          sourceFsp: fspiopSource,
          destinationFsp: fspiopDest,
          request: JSON.stringify(opts, LibUtil.getCircularReplacer()),
          response: JSON.stringify(res, LibUtil.getCircularReplacer())
        }, fspiopSource)
      }
    } catch (err) {
      log.error('Error in sendErrorCallback', err)
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
    const endpoint = await getParticipantEndpoint({ fspId, db, loggerFn: log.debug.bind(log), endpointType, proxyClient })
    log.debug('Resolved participant endpoint:', { fspId, endpoint, endpointType })
    return endpoint
  }

  /**
   * Writes a formatted message to the console
   * @param {AxiosRequestConfig} options
   * @param {String} fspiopSource
   * @param {String} fspiopDest
   * @returns {AxiosResponse}
   */
  async sendHttpRequest (options, fspiopSource, fspiopDest) {
    try {
      return axios.request(options)
    } catch (err) {
      this.log.warn('error in sendHttpRequest', err)
      throw ErrorHandler.CreateFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.DESTINATION_COMMUNICATION_ERROR, `network error in sendErrorCallback: ${err.message}`, {
        error: err,
        method: options?.method,
        url: options?.url,
        sourceFsp: fspiopSource,
        destinationFsp: fspiopDest,
        request: JSON.stringify(options, LibUtil.getCircularReplacer())
      }, fspiopSource)
    }
  }

  addFspiopSignatureHeader (opts) {
    const { jws } = this.envConfig
    // If JWS is enabled and the 'fspiop-source' matches the configured jws header value('switch')
    // that means it's a switch generated message and we need to sign it
    if (jws?.jwsSign && opts.headers['fspiop-source'] === jws.fspiopSourceToSign) {
      const logger = Logger
      logger.log = logger.info
      this.log.verbose('Getting the JWS Signer to sign the switch generated message')
      const jwsSigner = new JwsSigner({
        logger,
        signingKey: jws.jwsSigningKey
      })
      opts.headers['fspiop-signature'] = jwsSigner.getSignature(opts)
    }
  }
}

module.exports = FxQuotesModel
