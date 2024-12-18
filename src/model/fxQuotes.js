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

const ENUM = require('@mojaloop/central-services-shared').Enum
const ErrorHandler = require('@mojaloop/central-services-error-handling')
const EventSdk = require('@mojaloop/event-sdk')
const LibUtil = require('@mojaloop/central-services-shared').Util
const Logger = require('@mojaloop/central-services-logger')
const JwsSigner = require('@mojaloop/sdk-standard-components').Jws.signer
const Metrics = require('@mojaloop/central-services-metrics')

const Config = require('../lib/config')
const { loggerFactory } = require('../lib')
const { httpRequest } = require('../lib/http')
const { getStackOrInspect, generateRequestHeadersForJWS, generateRequestHeaders, getParticipantEndpoint, calculateRequestHash } = require('../lib/util')
const LOCAL_ENUM = require('../lib/enum')
const { RESOURCES, ERROR_MESSAGES } = require('../constants')

axios.defaults.headers.common = {}

class FxQuotesModel {
  constructor (deps) {
    this.db = deps.db
    this.requestId = deps.requestId
    this.proxyClient = deps.proxyClient
    this.envConfig = deps.envConfig || new Config()
    this.httpRequest = deps.httpRequest || httpRequest
    this.log = deps.log || loggerFactory({
      context: this.constructor.name,
      requestId: this.requestId
    })
  }

  /**
   * Validates the fxQuote request object
   *
   * @returns {promise} - promise will reject if request is not valid
   */
  async validateFxQuoteRequest (fspiopDestination, fxQuoteRequest) {
    const histTimer = Metrics.getHistogram(
      'model_fxquote',
      'validateFxQuoteRequest - Metrics for fx quote model',
      ['success', 'queryName']
    ).startTimer()
    try {
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
      histTimer({ success: true, queryName: 'validateFxQuoteRequest' })
    } catch (error) {
      histTimer({ success: false, queryName: 'validateFxQuoteRequest' })
      throw error
    }
  }

  async checkDuplicateFxQuoteRequest (fxQuoteRequest) {
    try {
      const conversionRequestId = fxQuoteRequest.conversionRequestId
      const log = this.log.child({ conversionRequestId })

      // calculate a SHA-256 of the request
      const hash = calculateRequestHash(fxQuoteRequest)
      log.debug('Calculated sha256 hash of fxQuote as: ', { hash })

      const dupchk = await this.db.getFxQuoteDuplicateCheck(fxQuoteRequest.conversionRequestId)
      log.debug('DB query for fxQuote duplicate check returned: ', { dupchk })

      if (!dupchk) {
        this.log.info('no existing record for this conversionRequestId found')
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
      this.log.error('Error in checkDuplicateFxQuoteRequest: ', err)
      throw ErrorHandler.ReformatFSPIOPError(err)
    }
  }

  async checkDuplicateFxQuoteResponse (conversionRequestId, fxQuoteResponse) {
    try {
      const log = this.log.child({ conversionRequestId })
      // calculate a SHA-256 of the request
      const hash = calculateRequestHash(fxQuoteResponse)
      log.debug('Calculated sha256 hash of fxQuote response as: ', { hash })

      const dupchk = await this.db.getFxQuoteResponseDuplicateCheck(conversionRequestId)
      log.debug('DB query for fxQuote response duplicate check returned: ', { dupchk })

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
      this.log.error('Error in checkDuplicateFxQuoteResponse: ', err)
      throw ErrorHandler.ReformatFSPIOPError(err)
    }
  }

  /**
   * Logic for creating and handling fxQuote requests
   *
   * @returns {undefined}
   */
  async handleFxQuoteRequest (headers, fxQuoteRequest, span) {
    const histTimer = Metrics.getHistogram(
      'model_fxquote',
      'handleFxQuoteRequest - Metrics for fx quote model',
      ['success', 'queryName']
    ).startTimer()
    let fspiopSource
    let txn
    const childSpan = span.getChild('qs_fxQuote_forwardFxQuoteRequest')
    try {
      await childSpan.audit({ headers, payload: fxQuoteRequest }, EventSdk.AuditEventAction.start)

      fspiopSource = headers[ENUM.Http.Headers.FSPIOP.SOURCE]
      const fspiopDestination = headers[ENUM.Http.Headers.FSPIOP.DESTINATION]

      await this.validateFxQuoteRequest(fspiopDestination, fxQuoteRequest)

      if (!this.envConfig.simpleRoutingMode) {
        // check if this is a resend or an erroneous duplicate
        const dupe = await this.checkDuplicateFxQuoteRequest(fxQuoteRequest)

        // fail fast on duplicate
        if (dupe.isDuplicateId && (!dupe.isResend)) {
          // same conversionRequestId but a different request, this is an error!
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
      histTimer({ success: true, queryName: 'handleFxQuoteRequest' })
    } catch (err) {
      histTimer({ success: false, queryName: 'handleFxQuoteRequest' })
      this.log.error('error in handleFxQuoteRequest', err)
      if (txn) {
        await txn.rollback().catch(() => {})
      }
      await this.handleException(fspiopSource, fxQuoteRequest.conversionRequestId, err, headers, childSpan)
    } finally {
      if (childSpan && !childSpan.isFinished) {
        await childSpan.finish()
      }
    }
  }

  /**
   * Forwards an fxQuote request to the destination fxp for processing
   *
   * @returns {undefined}
   */
  async forwardFxQuoteRequest (headers, conversionRequestId, originalFxQuoteRequest, span) {
    const histTimer = Metrics.getHistogram(
      'model_fxquote',
      'forwardFxQuoteRequest - Metrics for fx quote model',
      ['success', 'queryName']
    ).startTimer()

    try {
      const fspiopSource = headers[ENUM.Http.Headers.FSPIOP.SOURCE]
      const fspiopDest = headers[ENUM.Http.Headers.FSPIOP.DESTINATION]
      this.log.verbose('forwardFxQuoteRequest details:', { conversionRequestId, fspiopSource, fspiopDest })

      // lookup the fxp callback endpoint
      const endpoint = await this._getParticipantEndpoint(fspiopDest)
      if (!endpoint) {
        throw ErrorHandler.CreateFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.DESTINATION_FSP_ERROR, ERROR_MESSAGES.NO_FX_CALLBACK_ENDPOINT(fspiopDest, conversionRequestId), null, fspiopSource)
      }

      let opts = {
        method: ENUM.Http.RestMethods.POST,
        url: `${endpoint}${ENUM.EndPoints.FspEndpointTemplates.FX_QUOTES_POST}`,
        data: JSON.stringify(originalFxQuoteRequest),
        headers: generateRequestHeaders(headers, this.envConfig.protocolVersions, false, RESOURCES.fxQuotes)
      }
      this.log.debug('Forwarding fxQuote request details', { conversionRequestId, opts })

      if (span) {
        opts = span.injectContextToHttpRequest(opts)
        span.audit(opts, EventSdk.AuditEventAction.egress)
      }

      await this.httpRequest(opts, fspiopSource)
      histTimer({ success: true, queryName: 'forwardFxQuoteRequest' })
    } catch (err) {
      histTimer({ success: false, queryName: 'forwardFxQuoteRequest' })
      this.log.error('error in forwardFxQuoteRequest', err)
      throw ErrorHandler.ReformatFSPIOPError(err)
    }
  }

  /**
   * Handles an fxQuote response i.e PUT /fxQuotes/{id} requests
   *
   * @param {object} headers
   * @param {string} conversionRequestId
   * @param {object} fxQuoteUpdateRequest
   * @param {object} span
   * @returns {undefined}
   */
  async handleFxQuoteUpdate (headers, conversionRequestId, fxQuoteUpdateRequest, span) {
    const histTimer = Metrics.getHistogram(
      'model_fxquote',
      'handleFxQuoteUpdate - Metrics for fx quote model',
      ['success', 'queryName']
    ).startTimer()

    const fspiopSource = headers[ENUM.Http.Headers.FSPIOP.SOURCE]
    const childSpan = span.getChild('qs_fxQuote_forwardFxQuoteUpdate')
    let txn

    try {
      await childSpan.audit({ headers, params: { conversionRequestId }, payload: fxQuoteUpdateRequest }, EventSdk.AuditEventAction.start)

      this.validateHeaders(headers, conversionRequestId)

      if (!this.envConfig.simpleRoutingMode) {
        const dupe = await this.checkDuplicateFxQuoteResponse(conversionRequestId, fxQuoteUpdateRequest)

        this.handleDuplicate(dupe, conversionRequestId, fspiopSource, headers, fxQuoteUpdateRequest, span)

        txn = await this.db.newTransaction()
        await this.processFxQuoteUpdate(txn, conversionRequestId, fxQuoteUpdateRequest)
      }

      await this.forwardFxQuoteUpdate(headers, conversionRequestId, fxQuoteUpdateRequest, childSpan)
      histTimer({ success: true, queryName: 'handleFxQuoteUpdate' })
    } catch (err) {
      histTimer({ success: false, queryName: 'handleFxQuoteUpdate' })
      this.log.error('error in handleFxQuoteUpdate', err)
      if (txn) {
        await txn.rollback().catch(() => {})
      }
      await this.handleException(fspiopSource, conversionRequestId, err, headers, childSpan)
    } finally {
      if (childSpan && !childSpan.isFinished) {
        await childSpan.finish()
      }
    }
  }

  validateHeaders (headers, conversionRequestId) {
    if ('accept' in headers) {
      throw ErrorHandler.CreateFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.VALIDATION_ERROR,
        `Update for fx quote ${conversionRequestId} failed: "accept" header should not be sent in callbacks.`, null, headers['fspiop-source'])
    }
  }

  handleDuplicate (dupe, conversionRequestId, fspiopSource, headers, fxQuoteUpdateRequest, span) {
    if (dupe.isDuplicateId && (!dupe.isResend)) {
      throw ErrorHandler.CreateFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.MODIFIED_REQUEST,
        `Update for fxQuote ${conversionRequestId} is a duplicate but hashes don't match`, null, fspiopSource)
    }

    if (dupe.isResend && dupe.isDuplicateId) {
      return this.handleFxQuoteUpdateResend(headers, conversionRequestId, fxQuoteUpdateRequest, span)
    }
  }

  async processFxQuoteUpdate (txn, conversionRequestId, fxQuoteUpdateRequest) {
    const newFxQuoteResponse = await this.db.createFxQuoteResponse(txn, conversionRequestId, fxQuoteUpdateRequest)

    await this.db.createFxQuoteResponseConversionTerms(txn, conversionRequestId, newFxQuoteResponse.fxQuoteResponseId, fxQuoteUpdateRequest.conversionTerms)

    if (fxQuoteUpdateRequest.conversionTerms.charges && Array.isArray(fxQuoteUpdateRequest.conversionTerms.charges)) {
      await this.db.createFxQuoteResponseFxCharge(txn, fxQuoteUpdateRequest.conversionTerms.conversionId, fxQuoteUpdateRequest.conversionTerms.charges)
    }

    if (fxQuoteUpdateRequest.conversionTerms.extensionList && Array.isArray(fxQuoteUpdateRequest.conversionTerms.extensionList.extension)) {
      await this.db.createFxQuoteResponseConversionTermsExtension(txn, fxQuoteUpdateRequest.conversionTerms.conversionId, fxQuoteUpdateRequest.conversionTerms.extensionList.extension)
    }

    const hash = calculateRequestHash(fxQuoteUpdateRequest)
    await this.db.createFxQuoteResponseDuplicateCheck(txn, newFxQuoteResponse.fxQuoteResponseId, conversionRequestId, hash)

    await txn.commit()
  }

  /**
   * Forwards an fxQuote response to a payer DFSP for processing
   *
   * @returns {undefined}
   */
  async forwardFxQuoteUpdate (headers, conversionRequestId, originalFxQuoteResponse, span) {
    const histTimer = Metrics.getHistogram(
      'model_fxquote',
      'forwardFxQuoteUpdate - Metrics for fx quote model',
      ['success', 'queryName']
    ).startTimer()

    try {
      const fspiopSource = headers[ENUM.Http.Headers.FSPIOP.SOURCE]
      const fspiopDest = headers[ENUM.Http.Headers.FSPIOP.DESTINATION]
      this.log.verbose('forwardFxQuoteUpdate request:', { conversionRequestId, fspiopSource, fspiopDest })

      const endpoint = await this._getParticipantEndpoint(fspiopDest)
      if (!endpoint) {
        const fspiopError = ErrorHandler.CreateFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.DESTINATION_FSP_ERROR, `No FSPIOP_CALLBACK_URL_FX_QUOTES endpoint found for PAYER party FSP '${fspiopDest}' while processing fxQuote ${conversionRequestId}`, null, fspiopSource)
        return this.sendErrorCallback(fspiopSource, fspiopError, conversionRequestId, headers, span, true)
      }

      let opts = {
        method: ENUM.Http.RestMethods.PUT,
        url: `${endpoint}/fxQuotes/${conversionRequestId}`,
        data: JSON.stringify(originalFxQuoteResponse),
        headers: generateRequestHeaders(headers, this.envConfig.protocolVersions, true, RESOURCES.fxQuotes)
        // we need to strip off the 'accept' header
        // for all PUT requests as per the API Specification Document
        // https://github.com/mojaloop/mojaloop-specification/blob/main/documents/v1.1-document-set/fspiop-v1.1-openapi2.yaml
      }
      this.log.debug('Forwarding fxQuote update request details', { conversionRequestId, opts })

      if (span) {
        opts = span.injectContextToHttpRequest(opts)
        span.audit(opts, EventSdk.AuditEventAction.egress)
      }

      await this.httpRequest(opts, fspiopSource)
      histTimer({ success: true, queryName: 'forwardFxQuoteUpdate' })
    } catch (err) {
      histTimer({ success: false, queryName: 'forwardFxQuoteUpdate' })
      this.log.error('error in forwardFxQuoteUpdate', err)
      throw ErrorHandler.ReformatFSPIOPError(err)
    }
  }

  /**
   * Attempts to handle an fxQuote GET request by forwarding it to the destination FXP
   *
   * @returns {undefined}
   */
  async handleFxQuoteGet (headers, conversionRequestId, span) {
    const histTimer = Metrics.getHistogram(
      'model_fxquote',
      'handleFxQuoteGet - Metrics for fx quote model',
      ['success', 'queryName']
    ).startTimer()
    const fspiopSource = headers[ENUM.Http.Headers.FSPIOP.SOURCE]
    const childSpan = span.getChild('qs_fxQuote_forwardFxQuoteGet')
    try {
      await childSpan.audit({ headers, params: { conversionRequestId } }, EventSdk.AuditEventAction.start)
      await this.forwardFxQuoteGet(headers, conversionRequestId, childSpan)
      histTimer({ success: true, queryName: 'handleFxQuoteGet' })
    } catch (err) {
      histTimer({ success: false, queryName: 'handleFxQuoteGet' })
      this.log.error('error in handleFxQuoteGet', err)
      await this.handleException(fspiopSource, conversionRequestId, err, headers, childSpan)
    } finally {
      if (childSpan && !childSpan.isFinished) {
        await childSpan.finish()
      }
    }
  }

  /**
   * Attempts to forward an fxQuote GET request
   *
   * @returns {undefined}
   */
  async forwardFxQuoteGet (headers, conversionRequestId, span) {
    const histTimer = Metrics.getHistogram(
      'model_fxquote',
      'forwardFxQuoteGet - Metrics for fx quote model',
      ['success', 'queryName']
    ).startTimer()
    try {
      const fspiopSource = headers[ENUM.Http.Headers.FSPIOP.SOURCE]
      const fspiopDest = headers[ENUM.Http.Headers.FSPIOP.DESTINATION]
      this.log.verbose('forwardFxQuoteGet request', { conversionRequestId, fspiopSource, fspiopDest })
      // lookup fxp callback endpoint
      const endpoint = await this._getParticipantEndpoint(fspiopDest)
      if (!endpoint) {
        throw ErrorHandler.CreateFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.DESTINATION_FSP_ERROR, ERROR_MESSAGES.NO_FX_CALLBACK_ENDPOINT(fspiopDest, conversionRequestId), null, fspiopSource)
      }

      let opts = {
        method: ENUM.Http.RestMethods.GET,
        url: `${endpoint}/fxQuotes/${conversionRequestId}`,
        headers: generateRequestHeaders(headers, this.envConfig.protocolVersions, false, RESOURCES.fxQuotes)
      }
      this.log.debug('Forwarding fxQuote get request details:', { conversionRequestId, opts })

      if (span) {
        opts = span.injectContextToHttpRequest(opts)
        span.audit(opts, EventSdk.AuditEventAction.egress)
      }

      await this.httpRequest(opts, fspiopSource)
      histTimer({ success: true, queryName: 'forwardFxQuoteGet' })
    } catch (err) {
      histTimer({ success: false, queryName: 'forwardFxQuoteGet' })
      this.log.error('error in forwardFxQuoteGet', err)
      throw ErrorHandler.ReformatFSPIOPError(err)
    }
  }

  /**
   * Handles fxQuote error callback e.g. PUT fxQuotes/{id}/error
   *
   * @returns {undefined}
   */
  async handleFxQuoteError (headers, conversionRequestId, error, span) {
    const histTimer = Metrics.getHistogram(
      'model_fxquote',
      'handleFxQuoteError - Metrics for fx quote model',
      ['success', 'queryName']
    ).startTimer()
    let txn
    const fspiopSource = headers[ENUM.Http.Headers.FSPIOP.SOURCE]
    const childSpan = span.getChild('qs_fxQuote_forwardFxQuoteError')
    try {
      if (!this.envConfig.simpleRoutingMode) {
        // do everything in a transaction so we can rollback multiple operations if something goes wrong
        txn = await this.db.newTransaction()

        // persist the error
        await this.db.createFxQuoteError(txn, conversionRequestId, {
          errorCode: Number(error.errorCode),
          errorDescription: error.errorDescription
        })

        // commit the txn to the db
        await txn.commit()
      }

      await childSpan.audit({ headers, params: { conversionRequestId } }, EventSdk.AuditEventAction.start)
      const fspiopError = ErrorHandler.CreateFSPIOPErrorFromErrorInformation(error)
      await this.sendErrorCallback(headers[ENUM.Http.Headers.FSPIOP.DESTINATION], fspiopError, conversionRequestId, headers, childSpan, false)
      histTimer({ success: true, queryName: 'handleFxQuoteError' })
    } catch (err) {
      histTimer({ success: false, queryName: 'handleFxQuoteError' })
      this.log.error('error in handleFxQuoteError', err)
      if (txn) {
        await txn.rollback().catch(() => {})
      }
      await this.handleException(fspiopSource, conversionRequestId, err, headers, childSpan)
    } finally {
      if (childSpan && !childSpan.isFinished) {
        await childSpan.finish()
      }
    }
  }

  /**
   * Deals with resends of fxQuote requests (POST) under the API spec:
   * See section 3.2.5.1, 9.4 and 9.5 in "API Definition v1.0.docx" API specification document.
   */
  async handleFxQuoteRequestResend (headers, fxQuoteRequest, span, additionalHeaders) {
    try {
      const fspiopSource = headers[ENUM.Http.Headers.FSPIOP.SOURCE]
      const fspiopDestination = headers[ENUM.Http.Headers.FSPIOP.DESTINATION]
      this.log.debug(`Handling resend of fxQuoteRequest from ${fspiopSource} to ${fspiopDestination}: `, fxQuoteRequest)

      // we are ok to assume the fxQuoteRequest object passed to us is the same as the original...
      // as it passed a hash duplicate check...so go ahead and use it to resend rather than
      // hit the db again

      // if we got here rules passed, so we can forward the fxQuote on to the recipient dfsp
      const childSpan = span.getChild('qs_fxQuote_forwardQuoteRequestResend')
      try {
        await childSpan.audit({ headers, payload: fxQuoteRequest }, EventSdk.AuditEventAction.start)
        await this.forwardFxQuoteRequest(headers, fxQuoteRequest.conversionRequestId, fxQuoteRequest, childSpan, additionalHeaders)
      } catch (err) {
        // any-error
        // as we are on our own in this context, dont just rethrow the error, instead...
        // get the model to handle it
        this.log.error('Error forwarding fxQuote request: ', err)
        const fspiopError = ErrorHandler.ReformatFSPIOPError(err)
        await this.handleException(fspiopSource, fxQuoteRequest.conversionRequestId, fspiopError, headers, childSpan)
      } finally {
        if (childSpan && !childSpan.isFinished) {
          await childSpan.finish()
        }
      }
    } catch (err) {
      // internal-error
      this.log.error('Error in handleFxQuoteRequestResend: ', err)
      throw ErrorHandler.ReformatFSPIOPError(err)
    }
  }

  /**
   * Deals with resends of fxQuote responses (PUT) under the API spec:
   * See section 3.2.5.1, 9.4 and 9.5 in "API Definition v1.0.docx" API specification document.
   */
  async handleFxQuoteUpdateResend (headers, conversionRequestId, fxQuoteUpdate, span) {
    try {
      const fspiopSource = headers[ENUM.Http.Headers.FSPIOP.SOURCE]
      const fspiopDest = headers[ENUM.Http.Headers.FSPIOP.DESTINATION]
      this.log.debug(`Handling resend of fxQuoteUpdate from ${fspiopSource} to ${fspiopDest}: `, fxQuoteUpdate)

      // we are ok to assume the fxQuoteUpdate object passed to us is the same as the original...
      // as it passed a hash duplicate check...so go ahead and use it to resend rather than
      // hit the db again

      // if we got here rules passed, so we can forward the fxQuote on to the recipient dfsp
      const childSpan = span.getChild('qs_fxQuote_forwardFxQuoteUpdateResend')
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
        if (childSpan && !childSpan.isFinished) {
          await childSpan.finish()
        }
      }
    } catch (err) {
      // internal-error
      this.log.error('Error in handleQuoteUpdateResend: ', err)
      throw ErrorHandler.ReformatFSPIOPError(err)
    }
  }

  /**
   * Attempts to handle an exception in a sensible manner by forwarding it on to the
   * dfsp that initiated the request.
   */
  async handleException (fspiopSource, conversionRequestId, error, headers, span) {
    const histTimer = Metrics.getHistogram(
      'model_fxquote',
      'handleException - Metrics for fx quote model',
      ['success', 'queryName']
    ).startTimer()
    this.log.info('Attempting to send error callback to fspiopSource:', { conversionRequestId, fspiopSource })
    const fspiopError = ErrorHandler.ReformatFSPIOPError(error)
    const childSpan = span.getChild('qs_fxQuote_sendErrorCallback')
    try {
      await childSpan.audit({ headers, params: { conversionRequestId } }, EventSdk.AuditEventAction.start)
      await this.sendErrorCallback(fspiopSource, fspiopError, conversionRequestId, headers, childSpan, true)
      histTimer({ success: true, queryName: 'handleException' })
    } catch (err) {
      histTimer({ success: false, queryName: 'handleException' })
      this.log.error('error in handleException, stop request processing!', err)
    } finally {
      if (childSpan && !childSpan.isFinished) {
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
    const histTimer = Metrics.getHistogram(
      'model_fxquote',
      'sendErrorCallback - Metrics for fx quote model',
      ['success', 'queryName']
    ).startTimer()
    const { envConfig, log } = this
    const fspiopDest = headers[ENUM.Http.Headers.FSPIOP.DESTINATION]

    try {
      const endpoint = await this._getParticipantEndpoint(fspiopSource)

      log.debug(`Resolved participant '${fspiopSource}' FSPIOP_CALLBACK_URL_FX_QUOTES to: '${endpoint}'`)

      if (!endpoint) {
        throw ErrorHandler.CreateFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.PARTY_NOT_FOUND, ERROR_MESSAGES.NO_FX_CALLBACK_ENDPOINT(fspiopSource, conversionRequestId), null, fspiopSource)
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
      const formattedHeaders = generateHeadersFn(fromSwitchHeaders, envConfig.protocolVersions, true, RESOURCES.fxQuotes)

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
      histTimer({ success: false, queryName: 'sendErrorCallback' })
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
