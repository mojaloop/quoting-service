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
const LOCAL_ENUM = require('../lib/enum')
const dto = require('../lib/dto')
const util = require('../lib/util')

const { logger } = require('../lib')
const { httpRequest } = require('../lib/http')
const { getStackOrInspect, generateRequestHeadersForJWS, generateRequestHeaders, getParticipantEndpoint, calculateRequestHash, fetchParticipantInfo } = require('../lib/util')
const { RESOURCES, ERROR_MESSAGES } = require('../constants')
const { executeRules, handleRuleEvents } = require('./executeRules')

const reformatFSPIOPError = ErrorHandler.Factory.reformatFSPIOPError

axios.defaults.headers.common = {}

class FxQuotesModel {
  constructor (deps) {
    this.db = deps.db
    this.requestId = deps.requestId
    this.proxyClient = deps.proxyClient
    this.envConfig = deps.envConfig || new Config()
    this.httpRequest = deps.httpRequest || httpRequest
    this.log = deps.log || logger.child({
      context: this.constructor.name,
      requestId: this.requestId
    })
    try {
      if (!this.envConfig.instrumentationMetricsDisabled) {
        this.errorCounter = Metrics.getCounter('errorCount')
      }
    } catch (err) {
      this.log.error('Error initializing metrics in FxQuotesModel: ', err)
    }
  }

  executeRules = executeRules
  handleRuleEvents = handleRuleEvents
  _fetchParticipantInfo = fetchParticipantInfo

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
        const selfHealFXPProxy = this.envConfig.selfHealFXPProxyMap[fspiopDestination]
        if (selfHealFXPProxy) {
          await this.proxyClient?.addDfspIdToProxyMapping(fspiopDestination, selfHealFXPProxy)
        } else {
          await Promise.all(currencies.map((currency) => {
            return this.db.getParticipant(fspiopDestination, LOCAL_ENUM.COUNTERPARTY_FSP, currency, ENUM.Accounts.LedgerAccountType.POSITION)
          }))
        }
      }
      histTimer({ success: true, queryName: 'validateFxQuoteRequest' })
    } catch (error) {
      histTimer({ success: false, queryName: 'validateFxQuoteRequest' })
      throw error
    }
  }

  async checkDuplicateFxQuoteRequest (fxQuoteRequest) {
    let step
    try {
      const conversionRequestId = fxQuoteRequest.conversionRequestId
      const log = this.log.child({ conversionRequestId })
      // calculate a SHA-256 of the request
      const hash = calculateRequestHash(fxQuoteRequest)
      log.debug('Calculated sha256 hash of fxQuote as: ', { hash })
      step = 'getFxQuoteDuplicateCheck-1'
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
      if (!this.envConfig.instrumentationMetricsDisabled) {
        util.rethrowAndCountFspiopError(err, { operation: 'checkDuplicateFxQuoteRequest', step })
      }
      throw reformatFSPIOPError(err)
    }
  }

  async checkDuplicateFxQuoteResponse (conversionRequestId, fxQuoteResponse) {
    const log = this.log.child({ conversionRequestId })
    let step
    try {
      // calculate a SHA-256 of the request
      const hash = calculateRequestHash(fxQuoteResponse)
      log.debug('Calculated sha256 hash of fxQuote response as: ', { hash })
      step = 'getFxQuoteResponseDuplicateCheck-1'
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
      log.error('Error in checkDuplicateFxQuoteResponse: ', err)
      if (!this.envConfig.instrumentationMetricsDisabled) {
        util.rethrowAndCountFspiopError(err, { operation: 'checkDuplicateFxQuoteResponse', step })
      }
      throw reformatFSPIOPError(err)
    }
  }

  /**
   * Logic for creating and handling fxQuote requests
   *
   * @returns {undefined}
   */
  async handleFxQuoteRequest (headers, fxQuoteRequest, span, originalPayload, cache) {
    const histTimer = Metrics.getHistogram(
      'model_fxquote',
      'handleFxQuoteRequest - Metrics for fx quote model',
      ['success', 'queryName']
    ).startTimer()
    let fspiopSource
    let txn
    const childSpan = span.getChild('qs_fxQuote_forwardFxQuoteRequest')
    try {
      this.envConfig.simpleAudit || await childSpan.audit({ headers, payload: fxQuoteRequest }, EventSdk.AuditEventAction.start)

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
            span,
            originalPayload
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

      const { payer, payee } = await this._fetchParticipantInfo(fspiopSource, fspiopDestination, cache, this.proxyClient)
      this.writeLog(`Got payer ${payer} and payee ${payee}`)

      // Run the rules engine. If the user does not want to run the rules engine, they need only to
      // supply a rules file containing an empty array.
      const handledRuleEvents = await this.executeRules(headers, fxQuoteRequest, originalPayload, payer, payee, 'fxQuoteRequest')

      if (handledRuleEvents.terminate) {
        return
      }

      await this.forwardFxQuoteRequest(headers, fxQuoteRequest, originalPayload, childSpan)
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
  async forwardFxQuoteRequest (headers, fxQuoteRequest, originalPayload, span) {
    const conversionRequestId = fxQuoteRequest.conversionRequestId
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
        data: originalPayload,
        headers: generateRequestHeaders(headers, this.envConfig.protocolVersions, false, RESOURCES.fxQuotes, null)
      }
      this.log.debug('Forwarding fxQuote request details', { conversionRequestId, opts })

      if (span) {
        opts = span.injectContextToHttpRequest(opts)
        const { data, ...rest } = opts
        const queryTags = LibUtil.EventFramework.Tags.getQueryTags(
          ENUM.Tags.QueryTags.serviceName.quotingServiceHandler,
          ENUM.Tags.QueryTags.auditType.transactionFlow,
          ENUM.Tags.QueryTags.contentType.httpRequest,
          ENUM.Tags.QueryTags.operation.postFxQuotes,
          {
            httpMethod: opts.method,
            httpUrl: opts.url,
            conversionRequestId: fxQuoteRequest.conversionRequestId,
            conversionId: fxQuoteRequest.conversionTerms.conversionId,
            determiningTransferId: fxQuoteRequest.conversionTerms.determiningTransferId,
            transactionId: fxQuoteRequest.conversionTerms.determiningTransferId
          }
        )
        span.setTags(queryTags)
        span.audit({ ...rest, payload: data }, EventSdk.AuditEventAction.egress)
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
   * Logic for handling fxQuote update requests e.g. PUT /fxQuotes/{id} requests
   *
   * @returns {undefined}
   */
  async handleFxQuoteUpdate (headers, conversionRequestId, fxQuoteUpdateRequest, span, originalPayload) {
    const histTimer = Metrics.getHistogram(
      'model_fxquote',
      'handleFxQuoteUpdate - Metrics for fx quote model',
      ['success', 'queryName']
    ).startTimer()

    let txn
    const fspiopSource = headers[ENUM.Http.Headers.FSPIOP.SOURCE]
    const childSpan = span.getChild('qs_fxQuote_forwardFxQuoteUpdate')

    try {
      this.envConfig.simpleAudit || await childSpan.audit({ headers, params: { conversionRequestId }, payload: fxQuoteUpdateRequest }, EventSdk.AuditEventAction.start)
      if ('accept' in headers) {
        throw ErrorHandler.CreateFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.VALIDATION_ERROR,
          `Update for fx quote ${conversionRequestId} failed: "accept" header should not be sent in callbacks.`, null, headers['fspiop-source'])
      }

      if (!this.envConfig.simpleRoutingMode) {
        // check if this is a resend or an erroneous duplicate
        const dupe = await this.checkDuplicateFxQuoteResponse(conversionRequestId, fxQuoteUpdateRequest)

        // fail fast on duplicate
        if (dupe.isDuplicateId && (!dupe.isResend)) {
          // internal-error
          // same conversionRequestId but a different request, this is an error!
          throw ErrorHandler.CreateFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.MODIFIED_REQUEST,
            `Update for fxQuote ${conversionRequestId} is a duplicate but hashes don't match`, null, fspiopSource)
        }

        if (dupe.isResend && dupe.isDuplicateId) {
          // this is a resend
          // See section 3.2.5.1 in "API Definition v1.0.docx" API specification document.
          return this.handleFxQuoteUpdateResend(
            headers,
            conversionRequestId,
            fxQuoteUpdateRequest,
            originalPayload,
            span
          )
        }

        // do everything in a transaction so we can rollback multiple operations if something goes wrong
        txn = await this.db.newTransaction()

        // create the fxQuote response row in the db
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

      await this.forwardFxQuoteUpdate(headers, conversionRequestId, fxQuoteUpdateRequest, originalPayload, childSpan)
      histTimer({ success: true, queryName: 'handleFxQuoteUpdate' })
    } catch (err) {
      histTimer({ success: false, queryName: 'handleFxQuoteUpdate' })
      this.log.error('error in handleFxQuoteUpdate', err)
      const fspiopSource = headers[ENUM.Http.Headers.FSPIOP.SOURCE]
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
   * Forwards an fxQuote response to a payer DFSP for processing
   *
   * @returns {undefined}
   */
  async forwardFxQuoteUpdate (headers, conversionRequestId, fxQuoteUpdateRequest, originalFxQuoteResponse, span) {
    const histTimer = Metrics.getHistogram(
      'model_fxquote',
      'forwardFxQuoteUpdate - Metrics for fx quote model',
      ['success', 'queryName']
    ).startTimer()
    const log = this.log.child({ conversionRequestId })
    let step
    try {
      const fspiopSource = headers[ENUM.Http.Headers.FSPIOP.SOURCE]
      const fspiopDest = headers[ENUM.Http.Headers.FSPIOP.DESTINATION]
      log.verbose('forwardFxQuoteUpdate request:', { fspiopSource, fspiopDest })
      step = 'getParticipantEndpoint-1'
      const endpoint = await this._getParticipantEndpoint(fspiopDest)
      if (!endpoint) {
        const fspiopError = ErrorHandler.CreateFSPIOPError(
          ErrorHandler.Enums.FSPIOPErrorCodes.DESTINATION_FSP_ERROR,
          `No FSPIOP_CALLBACK_URL_FX_QUOTES endpoint found for PAYER party FSP '${fspiopDest}' while processing fxQuote ${conversionRequestId}`,
          null,
          fspiopSource
        )
        step = 'sendErrorCallback-2'
        return this.sendErrorCallback(fspiopSource, fspiopError, conversionRequestId, headers, span, true)
      }

      let opts = {
        method: ENUM.Http.RestMethods.PUT,
        url: `${endpoint}/fxQuotes/${conversionRequestId}`,
        data: originalFxQuoteResponse,
        headers: generateRequestHeaders(headers, this.envConfig.protocolVersions, true, RESOURCES.fxQuotes, null)
        // we need to strip off the 'accept' header
        // for all PUT requests as per the API Specification Document
        // https://github.com/mojaloop/mojaloop-specification/blob/main/documents/v1.1-document-set/fspiop-v1.1-openapi2.yaml
      }
      log.debug('Forwarding fxQuote update request details', { opts })

      if (span) {
        opts = span.injectContextToHttpRequest(opts)
        const { data, ...rest } = opts
        const queryTags = LibUtil.EventFramework.Tags.getQueryTags(
          ENUM.Tags.QueryTags.serviceName.quotingServiceHandler,
          ENUM.Tags.QueryTags.auditType.transactionFlow,
          ENUM.Tags.QueryTags.contentType.httpRequest,
          ENUM.Tags.QueryTags.operation.putFxQuotesByID,
          {
            httpMethod: opts.method,
            httpUrl: opts.url,
            conversionRequestId,
            conversionId: fxQuoteUpdateRequest.conversionTerms.conversionId,
            determiningTransferId: fxQuoteUpdateRequest.conversionTerms.determiningTransferId,
            transactionId: fxQuoteUpdateRequest.conversionTerms.determiningTransferId
          }
        )
        span.setTags(queryTags)
        span.audit({ ...rest, payload: data }, EventSdk.AuditEventAction.egress)
      }
      step = 'httpRequest-3'
      await this.httpRequest(opts, fspiopSource)
      histTimer({ success: true, queryName: 'forwardFxQuoteUpdate' })
    } catch (err) {
      histTimer({ success: false, queryName: 'forwardFxQuoteUpdate' })
      log.error('error in forwardFxQuoteUpdate', err)
      if (!this.envConfig.instrumentationMetricsDisabled) {
        util.rethrowAndCountFspiopError(err, { operation: 'forwardFxQuoteUpdate', step })
      }
      throw reformatFSPIOPError(err)
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
      this.envConfig.simpleAudit || await childSpan.audit({ headers, params: { conversionRequestId } }, EventSdk.AuditEventAction.start)
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
    let step
    try {
      const fspiopSource = headers[ENUM.Http.Headers.FSPIOP.SOURCE]
      const fspiopDest = headers[ENUM.Http.Headers.FSPIOP.DESTINATION]
      this.log.verbose('forwardFxQuoteGet request', { conversionRequestId, fspiopSource, fspiopDest })
      // lookup fxp callback endpoint
      step = 'getParticipantEndpoint-1'
      const endpoint = await this._getParticipantEndpoint(fspiopDest)
      if (!endpoint) {
        throw ErrorHandler.CreateFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.DESTINATION_FSP_ERROR, ERROR_MESSAGES.NO_FX_CALLBACK_ENDPOINT(fspiopDest, conversionRequestId), null, fspiopSource)
      }

      let opts = {
        method: ENUM.Http.RestMethods.GET,
        url: `${endpoint}/fxQuotes/${conversionRequestId}`,
        headers: generateRequestHeaders(headers, this.envConfig.protocolVersions, false, RESOURCES.fxQuotes, null)
      }
      this.log.debug('Forwarding fxQuote get request details:', { conversionRequestId, opts })

      if (span) {
        opts = span.injectContextToHttpRequest(opts)
        const queryTags = LibUtil.EventFramework.Tags.getQueryTags(
          ENUM.Tags.QueryTags.serviceName.quotingServiceHandler,
          ENUM.Tags.QueryTags.auditType.transactionFlow,
          ENUM.Tags.QueryTags.contentType.httpRequest,
          ENUM.Tags.QueryTags.operation.getFxQuotesByID,
          {
            httpMethod: opts.method,
            httpUrl: opts.url,
            conversionRequestId
          }
        )
        span.setTags(queryTags)
        span.audit(opts, EventSdk.AuditEventAction.egress)
      }
      step = 'httpRequest-2'
      await this.httpRequest(opts, fspiopSource)
      histTimer({ success: true, queryName: 'forwardFxQuoteGet' })
    } catch (err) {
      histTimer({ success: false, queryName: 'forwardFxQuoteGet' })
      this.log.error('error in forwardFxQuoteGet', err)
      if (!this.envConfig.instrumentationMetricsDisabled) {
        util.rethrowAndCountFspiopError(err, { operation: 'forwardFxQuoteGet', step })
      }
      throw reformatFSPIOPError(err)
    }
  }

  /**
   * Handles fxQuote error callback e.g. PUT fxQuotes/{id}/error
   *
   * @returns {undefined}
   */
  async handleFxQuoteError (headers, conversionRequestId, error, span, originalPayload) {
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
          errorCode: Number(error.errorCode) || 2001, // Internal Server Error: https://github.com/mojaloop/central-services-error-handling/blob/master/src/errors.js#L29
          errorDescription: error.errorDescription
        })

        // commit the txn to the db
        await txn.commit()
      }

      this.envConfig.simpleAudit || await childSpan.audit({ headers, params: { conversionRequestId } }, EventSdk.AuditEventAction.start)
      const fspiopError = ErrorHandler.CreateFSPIOPErrorFromErrorInformation(error)
      await this.sendErrorCallback(headers[ENUM.Http.Headers.FSPIOP.DESTINATION], fspiopError, conversionRequestId, headers, childSpan, false, originalPayload)
      histTimer({ success: true, queryName: 'handleFxQuoteError' })
    } catch (err) {
      histTimer({ success: false, queryName: 'handleFxQuoteError' })
      this.log.child({ headers, conversionRequestId, error }).error('error in handleFxQuoteError', err)
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
  async handleFxQuoteRequestResend (headers, payload, span, originalPayload) {
    try {
      const fspiopSource = headers[ENUM.Http.Headers.FSPIOP.SOURCE]
      const fspiopDestination = headers[ENUM.Http.Headers.FSPIOP.DESTINATION]

      this.log.debug(`Handling resend of fxQuoteRequest from ${fspiopSource} to ${fspiopDestination}: `, payload)

      // we are ok to assume the payload object passed to us is the same as the original...
      // as it passed a hash duplicate check...so go ahead and use it to resend rather than
      // hit the db again

      // if we got here rules passed, so we can forward the fxQuote on to the recipient dfsp
      const childSpan = span.getChild('qs_fxQuote_forwardQuoteRequestResend')
      try {
        this.envConfig.simpleAudit || await childSpan.audit({ headers, payload }, EventSdk.AuditEventAction.start)
        await this.forwardFxQuoteRequest(headers, payload.conversionRequestId, originalPayload, childSpan)
      } catch (err) {
        // any-error
        // as we are on our own in this context, dont just rethrow the error, instead...
        // get the model to handle it
        this.log.error('Error forwarding fxQuote request: ', err)
        const fspiopError = ErrorHandler.ReformatFSPIOPError(err)
        await this.handleException(fspiopSource, payload.conversionRequestId, fspiopError, headers, childSpan)
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
  async handleFxQuoteUpdateResend (headers, conversionRequestId, fxQuoteUpdateRequest, originalPayload, span) {
    try {
      const fspiopSource = headers[ENUM.Http.Headers.FSPIOP.SOURCE]
      const fspiopDest = headers[ENUM.Http.Headers.FSPIOP.DESTINATION]
      this.log.debug('Handling resend of fxQuoteUpdate: ', { fspiopSource, fspiopDest, originalPayload })

      // we are ok to assume the originalPayload object passed to us is the same as the original...
      // as it passed a hash duplicate check...so go ahead and use it to resend rather than
      // hit the db again

      // if we got here rules passed, so we can forward the fxQuote on to the recipient dfsp
      const childSpan = span.getChild('qs_fxQuote_forwardFxQuoteUpdateResend')
      try {
        this.envConfig.simpleAudit || await childSpan.audit({ headers, params: { conversionRequestId }, payload: originalPayload }, EventSdk.AuditEventAction.start)
        await this.forwardFxQuoteUpdate(headers, conversionRequestId, fxQuoteUpdateRequest, originalPayload, childSpan)
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
      this.envConfig.simpleAudit || await childSpan.audit({ headers, params: { conversionRequestId } }, EventSdk.AuditEventAction.start)
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
  async sendErrorCallback (fspiopSource, fspiopError, conversionRequestId, headers, span, modifyHeaders = true, originalPayload) {
    // todo: refactor to remove lots of code duplication from QuotesModel/BulkQuotes!!
    const histTimer = Metrics.getHistogram(
      'model_fxquote',
      'sendErrorCallback - Metrics for fx quote model',
      ['success', 'queryName']
    ).startTimer()
    const { envConfig } = this
    const fspiopDest = headers[ENUM.Http.Headers.FSPIOP.DESTINATION]
    const log = this.log.child({ conversionRequestId, fspiopDest })
    let step
    try {
      step = 'getParticipantEndpoint-1'
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
      let formattedHeaders
      if (envConfig.jws?.jwsSign && fromSwitchHeaders['fspiop-source'] === envConfig.jws.fspiopSourceToSign) {
        formattedHeaders = generateRequestHeadersForJWS(fromSwitchHeaders, envConfig.protocolVersions, true, RESOURCES.fxQuotes)
      } else {
        formattedHeaders = generateRequestHeaders(fromSwitchHeaders, envConfig.protocolVersions, true, RESOURCES.fxQuotes, null)
      }

      let opts = {
        method: ENUM.Http.RestMethods.PUT,
        url: fullCallbackUrl,
        data: originalPayload || await this.makeErrorPayload(fspiopError, headers),
        headers: formattedHeaders
      }
      this.addFspiopSignatureHeader(opts) // try to "combine" with formattedHeaders logic

      if (span) {
        opts = span.injectContextToHttpRequest(opts)
        const { data, ...rest } = opts
        const queryTags = LibUtil.EventFramework.Tags.getQueryTags(
          ENUM.Tags.QueryTags.serviceName.quotingServiceHandler,
          ENUM.Tags.QueryTags.auditType.transactionFlow,
          ENUM.Tags.QueryTags.contentType.httpRequest,
          ENUM.Tags.QueryTags.operation.putFxQuotesErrorByID,
          {
            httpMethod: opts.method,
            httpUrl: opts.url,
            conversionRequestId
          }
        )
        span.setTags(queryTags)
        span.audit({ ...rest, payload: data }, EventSdk.AuditEventAction.egress)
      }
      step = 'sendHttpRequest-2'
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
      if (!this.envConfig.instrumentationMetricsDisabled) {
        util.rethrowAndCountFspiopError(fspiopError, { operation: 'sendErrorCallback', step })
      }
      throw fspiopError
    }
  }

  async makeErrorPayload (fspiopError, headers) {
    const errObject = fspiopError.toApiErrorObject(this.envConfig.errorHandling)
    return dto.makeErrorPayloadDto(errObject, headers, RESOURCES.fxQuotes, this.log)
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
    let step
    try {
      step = 'axios-request-1'
      return axios.request(options)
    } catch (err) {
      this.log.warn('error in sendHttpRequest', err)
      const extensions = err.extensions || []
      const fspiopError = ErrorHandler.CreateFSPIOPError(
        ErrorHandler.Enums.FSPIOPErrorCodes.DESTINATION_COMMUNICATION_ERROR,
        `network error in sendErrorCallback: ${err.message}`,
        {
          error: err,
          method: options?.method,
          url: options?.url,
          sourceFsp: fspiopSource,
          destinationFsp: fspiopDest,
          request: JSON.stringify(options, LibUtil.getCircularReplacer())
        },
        fspiopSource,
        extensions
      )
      if (!this.envConfig.instrumentationMetricsDisabled) {
        util.rethrowAndCountFspiopError(fspiopError, { operation: 'sendHttpRequest', step })
      }
      throw fspiopError
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

  /**
   * Writes a formatted message to the console
   *
   * @returns {undefined}
   */
  // eslint-disable-next-line no-unused-vars
  writeLog (message) {
    Logger.isDebugEnabled && Logger.debug(`(${this.requestId}) [quotesmodel]: ${message}`)
  }
}

module.exports = FxQuotesModel
