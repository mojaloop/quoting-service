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

 Initial contribution
 --------------------
 The initial functionality and code base was donated by the Mowali project working in conjunction with MTN and Orange as service provides.
 * Project: Mowali

 * ModusBox
 - Rajiv Mothilal <rajiv.mothilal@modusbox.com>
 --------------
 ******/

const axios = require('axios')

const { Enum, Util } = require('@mojaloop/central-services-shared')
const ErrorHandler = require('@mojaloop/central-services-error-handling')
const EventSdk = require('@mojaloop/event-sdk')

const LOCAL_ENUM = require('../lib/enum')
const BaseQuotesModel = require('./BaseQuotesModel')

const reformatFSPIOPError = ErrorHandler.Factory.reformatFSPIOPError

delete axios.defaults.headers.common.Accept
delete axios.defaults.headers.common['Content-Type']

/**
 * Encapsulates operations on the bulkQuotes domain model
 */
class BulkQuotesModel extends BaseQuotesModel {
  /**
   * Validates the quote request object
   *
   * @returns {promise} - promise will reject if request is not valid
   */
  async validateBulkQuoteRequest (fspiopSource, fspiopDestination, bulkQuoteRequest) {
    await this.db.getParticipant(fspiopSource, LOCAL_ENUM.PAYER_DFSP, bulkQuoteRequest.individualQuotes[0].amount.currency, Enum.Accounts.LedgerAccountType.POSITION)

    // Ensure the proxy client is connected
    if (this.proxyClient?.isConnected === false) await this.proxyClient.connect()
    // if the payee dfsp has a proxy cache entry, we do not validate the dfsp here
    if (!(await this.proxyClient?.lookupProxyByDfspId(fspiopDestination))) {
      await this.db.getParticipant(fspiopDestination, LOCAL_ENUM.PAYEE_DFSP, bulkQuoteRequest.individualQuotes[0].amount.currency, Enum.Accounts.LedgerAccountType.POSITION)
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
      fspiopSource = headers[Enum.Http.Headers.FSPIOP.SOURCE]
      const fspiopDestination = headers[Enum.Http.Headers.FSPIOP.DESTINATION]

      // validate - this will throw if the request is invalid
      childSpan = span.getChild('qs_bulkquote_forwardBulkQuoteRequest')
      await this.validateBulkQuoteRequest(fspiopSource, fspiopDestination, bulkQuoteRequest)
      // if we got here rules passed, so we can forward the quote on to the recipient dfsp
      this.envConfig.simpleAudit || await childSpan.audit({ headers, payload: bulkQuoteRequest }, EventSdk.AuditEventAction.start)
      await this.forwardBulkQuoteRequest(headers, bulkQuoteRequest.bulkQuoteId, bulkQuoteRequest, childSpan)
    } catch (err) {
      // as we are on our own in this context, dont just rethrow the error, instead...
      // get the model to handle it
      this.log.error('error in handleBulkQuoteRequest: ', err)
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
    const source = headers[Enum.Http.Headers.FSPIOP.SOURCE]
    const destination = headers[Enum.Http.Headers.FSPIOP.DESTINATION]
    const log = this.log.child({ bulkQuoteId, source, destination })
    let endpoint
    let step

    try {
      // lookup payee dfsp callback endpoint
      // TODO: for MVP we assume initiator is always payer dfsp! this may not always be the
      // case if a xfer is requested by payee
      step = 'getParticipantEndpoint-1'
      endpoint = await this._getParticipantEndpoint(destination)
      log.debug('Resolved FSPIOP_CALLBACK_URL_BULK_QUOTES endpoint for bulkQuote: ', { endpoint })

      if (!endpoint) {
        // internal-error
        // we didnt get an endpoint for the payee dfsp!
        // make an error callback to the initiator
        const fspiopError = ErrorHandler.CreateFSPIOPError(
          ErrorHandler.Enums.FSPIOPErrorCodes.DESTINATION_FSP_ERROR,
          `No FSPIOP_CALLBACK_URL_BULK_QUOTES found for quote ${bulkQuoteId} PAYEE party`,
          null,
          source
        )
        if (!this.envConfig.instrumentationMetricsDisabled) {
          this.libUtil.rethrowAndCountFspiopError(fspiopError, { operation: 'forwardBulkQuoteRequest', step })
        }
        throw fspiopError
      }

      const fullCallbackUrl = `${endpoint}${Enum.EndPoints.FspEndpointTemplates.BULK_QUOTES_POST}`
      log.verbose('fullCallbackUrl: ', { fullCallbackUrl })

      let opts = {
        method: Enum.Http.RestMethods.POST,
        url: fullCallbackUrl,
        data: originalBulkQuoteRequest,
        headers: this.libUtil.generateRequestHeaders(headers, this.envConfig.protocolVersions)
      }
      log.debug('forwarding request opts:', { opts })
      if (span) opts = super.injectSpanContext(span, opts, 'postBulkQuotes', { bulkQuoteId })

      step = 'httpRequest-2'
      await this.httpRequest(opts, source)
      log.info('forwardBulkQuoteRequest is done')
    } catch (err) {
      log.error('error in forwardBulkQuoteRequest: ', err)
      if (!this.envConfig.instrumentationMetricsDisabled) {
        this.libUtil.rethrowAndCountFspiopError(err, { operation: 'forwardBulkQuoteRequest', step })
      }
      throw reformatFSPIOPError(err)
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
      this.envConfig.simpleAudit || await childSpan.audit({ headers, params: { bulkQuoteId }, payload: bulkQuoteUpdateRequest }, EventSdk.AuditEventAction.start)
      await this.forwardBulkQuoteUpdate(headers, bulkQuoteId, bulkQuoteUpdateRequest, childSpan)
    } catch (err) {
      this.log.error('error in handleBulkQuoteUpdate: ', err)
      const fspiopSource = headers[Enum.Http.Headers.FSPIOP.SOURCE]
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
    const source = headers[Enum.Http.Headers.FSPIOP.SOURCE]
    const destination = headers[Enum.Http.Headers.FSPIOP.DESTINATION]
    const log = this.log.child({ bulkQuoteId, source, destination })
    let endpoint
    let step

    try {
      // lookup payer dfsp callback endpoint
      step = 'getParticipantEndpoint-1'
      endpoint = await this._getParticipantEndpoint(destination)
      log.debug('Resolved PAYER party FSPIOP_CALLBACK_URL_BULK_QUOTES endpoint for bulkQuote: ', { endpoint })

      if (!endpoint) {
        // we didnt get an endpoint for the payee dfsp!
        // make an error callback to the initiator
        const fspiopError = ErrorHandler.CreateFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.DESTINATION_FSP_ERROR, `No FSPIOP_CALLBACK_URL_BULK_QUOTES found for quote ${bulkQuoteId} PAYER party`, null, source)
        step = 'sendErrorCallback-2'
        return this.sendErrorCallback(source, fspiopError, bulkQuoteId, headers, true)
      }

      const fullCallbackUrl = `${endpoint}/bulkQuotes/${bulkQuoteId}`
      log.verbose('fullCallbackUrl: ', { fullCallbackUrl })

      let opts = {
        method: Enum.Http.RestMethods.PUT,
        url: fullCallbackUrl,
        data: originalBulkQuoteResponse,
        headers: this.libUtil.generateRequestHeaders(headers, this.envConfig.protocolVersions, true)
        // we need to strip off the 'accept' header
        // for all PUT requests as per the API Specification Document
        // https://github.com/mojaloop/mojaloop-specification/blob/main/documents/v1.1-document-set/fspiop-v1.1-openapi2.yaml
      }
      if (span) opts = super.injectSpanContext(span, opts, 'putBulkQuotesByID', { bulkQuoteId })

      step = 'httpRequest-3'
      await this.httpRequest(opts, source)
      log.info('forwardBulkQuoteUpdate is done')
    } catch (err) {
      log.error('error in forwardBulkQuoteUpdate: ', err)
      if (!this.envConfig.instrumentationMetricsDisabled) {
        this.libUtil.rethrowAndCountFspiopError(err, { operation: 'forwardBulkQuoteUpdate', step })
      }
      throw reformatFSPIOPError(err)
    }
  }

  /**
   * Attempts to handle a bulk quote GET request by forwarding it to the destination DFSP
   *
   * @returns {undefined}
   */
  async handleBulkQuoteGet (headers, bulkQuoteId, span) {
    const fspiopSource = headers[Enum.Http.Headers.FSPIOP.SOURCE]
    const childSpan = span.getChild('qs_quote_forwardBulkQuoteGet')
    try {
      this.envConfig.simpleAudit || await childSpan.audit({ headers, params: { bulkQuoteId } }, EventSdk.AuditEventAction.start)
      await this.forwardBulkQuoteGet(headers, bulkQuoteId, childSpan)
    } catch (err) {
      this.log.error('error in handleBulkQuoteGet: ', err)
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
    const source = headers[Enum.Http.Headers.FSPIOP.SOURCE]
    const destination = headers[Enum.Http.Headers.FSPIOP.DESTINATION]
    const log = this.log.child({ bulkQuoteId, source, destination })
    let endpoint
    let step

    try {
      // lookup payee dfsp callback endpoint
      // todo: for MVP we assume initiator is always payer dfsp! this may not always be the case if a xfer is requested by payee
      step = 'getParticipantEndpoint-1'
      endpoint = await this._getParticipantEndpoint(destination)
      log.debug('Resolved destination FSPIOP_CALLBACK_URL_BULK_QUOTES endpoint for bulkQuote GET to: ', { endpoint })

      if (!endpoint) {
        // we didnt get an endpoint for the payee dfsp!
        // make an error callback to the initiator
        // internal-error
        const fspiopError = ErrorHandler.CreateFSPIOPError(
          ErrorHandler.Enums.FSPIOPErrorCodes.DESTINATION_FSP_ERROR,
          `No FSPIOP_CALLBACK_URL_BULK_QUOTES found for bulk quote GET ${bulkQuoteId}`,
          null,
          source
        )
        if (!this.envConfig.instrumentationMetricsDisabled) {
          this.libUtil.rethrowAndCountFspiopError(fspiopError, { operation: 'forwardBulkQuoteGet', step })
        }
        throw fspiopError
      }

      const fullCallbackUrl = `${endpoint}/bulkQuotes/${bulkQuoteId}`
      log.verbose(`Forwarding bulkQuote get request to endpoint: ${fullCallbackUrl}`)

      let opts = {
        method: Enum.Http.RestMethods.GET,
        url: fullCallbackUrl,
        headers: this.libUtil.generateRequestHeaders(headers, this.envConfig.protocolVersions)
      }
      if (span) opts = super.injectSpanContext(span, opts, 'getBulkQuotesByID', { bulkQuoteId })

      step = 'httpRequest-2'
      await this.httpRequest(opts, source)
    } catch (err) {
      log.error('error in forwardBulkQuoteGet: ', err)
      if (!this.envConfig.instrumentationMetricsDisabled) {
        this.libUtil.rethrowAndCountFspiopError(err, { operation: 'forwardBulkQuoteGet', step })
      }
      throw reformatFSPIOPError(err)
    }
  }

  /**
   * Handles error reports from clients e.g. POST bulkQuotes/{id}/error
   *
   * @returns {undefined}
   */
  async handleBulkQuoteError (headers, bulkQuoteId, error, span) {
    const fspiopSource = headers[Enum.Http.Headers.FSPIOP.SOURCE]
    const childSpan = span.getChild('qs_quote_forwardBulkQuoteError')
    try {
      // create a new object to represent the error
      const fspiopError = ErrorHandler.CreateFSPIOPErrorFromErrorInformation(error)
      this.envConfig.simpleAudit || await childSpan.audit({ headers, params: { bulkQuoteId } }, EventSdk.AuditEventAction.start)
      // Needed to add await here to prevent 'span already finished' bug
      await this.sendErrorCallback(headers[Enum.Http.Headers.FSPIOP.DESTINATION], fspiopError, bulkQuoteId, headers, childSpan, false)
    } catch (err) {
      this.log.error('error in handleBulkQuoteError: ', err)
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
      this.envConfig.simpleAudit || await childSpan.audit({ headers, params: { bulkQuoteId } }, EventSdk.AuditEventAction.start)
      return await this.sendErrorCallback(fspiopSource, fspiopError, bulkQuoteId, headers, childSpan, true)
    } catch (err) {
      // not much we can do other than log the error
      this.log.error('Error occurred while handling error. Check service logs as this error may not have been propagated successfully to any other party: ', err)
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
    const destination = headers[Enum.Http.Headers.FSPIOP.DESTINATION]
    const log = this.log.child({ bulkQuoteId, fspiopSource, destination })
    let step

    try {
      // look up the callback base url
      step = 'getParticipantEndpoint-1'
      const endpoint = await this._getParticipantEndpoint(fspiopSource)
      log.debug(`Resolved participant '${fspiopSource}' '${Enum.EndPoints.FspEndpointTypes.FSPIOP_CALLBACK_URL_BULK_QUOTES}' to: '${endpoint}'`)

      if (!endpoint) {
        // oops, we cant make an error callback if we dont have an endpoint to call!
        // internal-error
        const fspiopError = ErrorHandler.CreateFSPIOPError(
          ErrorHandler.Enums.FSPIOPErrorCodes.PARTY_NOT_FOUND,
          `No FSPIOP_CALLBACK_URL_BULK_QUOTES found for ${fspiopSource} unable to make error callback`,
          null,
          fspiopSource
        )
        if (!this.envConfig.instrumentationMetricsDisabled) {
          this.libUtil.rethrowAndCountFspiopError(fspiopError, { operation: 'sendErrorCallback', step })
        }
        throw fspiopError
      }

      const fspiopUri = `/bulkQuotes/${bulkQuoteId}/error`
      const fullCallbackUrl = `${endpoint}${fspiopUri}`
      log.verbose(`Making error callback to participant '${fspiopSource}' for bulkQuoteId '${bulkQuoteId}' to ${fullCallbackUrl}`)

      const callbackHeaders = super.makeErrorCallbackHeaders({
        modifyHeaders, headers, fspiopSource, fspiopUri
      })

      let opts = {
        method: Enum.Http.RestMethods.PUT,
        url: fullCallbackUrl,
        data: fspiopError.toApiErrorObject(this.envConfig.errorHandling),
        // use headers of the error object if they are there...
        // otherwise use sensible defaults
        headers: callbackHeaders
      }
      if (span) opts = super.injectSpanContext(span, opts, 'putBulkQuotesErrorByID', { bulkQuoteId })

      let res
      try {
        super.addFspiopSignatureHeader(opts)

        step = 'axios-request-2'
        res = await axios.request(opts)
      } catch (err) {
        log.warn('error in axios.request:', err)
        const extensions = err.extensions || []
        const fspiopError = ErrorHandler.CreateFSPIOPError(
          ErrorHandler.Enums.FSPIOPErrorCodes.DESTINATION_COMMUNICATION_ERROR,
          `network error in sendErrorCallback: ${err.message}`,
          {
            error: err,
            url: fullCallbackUrl,
            sourceFsp: fspiopSource,
            destinationFsp: destination,
            method: opts && opts.method,
            request: JSON.stringify(opts, Util.getCircularReplacer())
          },
          fspiopSource,
          extensions
        )
        if (!this.envConfig.instrumentationMetricsDisabled) {
          this.libUtil.rethrowAndCountFspiopError(fspiopError, { operation: 'sendErrorCallback', step })
        }
        throw fspiopError
      }
      log.verbose(`Error callback got response ${res.status} ${res.statusText}`)

      if (res.status !== Enum.Http.ReturnCodes.OK.CODE) {
        // external-error
        const fspiopError = ErrorHandler.CreateFSPIOPError(
          ErrorHandler.Enums.FSPIOPErrorCodes.DESTINATION_COMMUNICATION_ERROR,
          'Got non-success response sending error callback', {
            url: fullCallbackUrl,
            sourceFsp: fspiopSource,
            destinationFsp: destination,
            method: opts && opts.method,
            request: JSON.stringify(opts, Util.getCircularReplacer()),
            response: JSON.stringify(res, Util.getCircularReplacer())
          },
          fspiopSource
        )
        if (!this.envConfig.instrumentationMetricsDisabled) {
          this.libUtil.rethrowAndCountFspiopError(fspiopError, { operation: 'sendErrorCallback', step })
        }
        throw fspiopError
      }
    } catch (err) {
      log.error('error in sendErrorCallback: ', err)
      const fspiopError = ErrorHandler.ReformatFSPIOPError(err)
      const state = new EventSdk.EventStateMetadata(EventSdk.EventStatusType.failed, fspiopError.apiErrorCode.code, fspiopError.apiErrorCode.message)
      if (span) {
        await span.error(fspiopError, state)
        await span.finish(fspiopError.message, state)
      }
      if (!this.envConfig.instrumentationMetricsDisabled) {
        this.libUtil.rethrowAndCountFspiopError(fspiopError, { operation: 'sendErrorCallback', step })
      }
      throw fspiopError
    }
  }

  // wrapping this dependency here to allow for easier use and testing
  async _getParticipantEndpoint (fspId, endpointType = Enum.EndPoints.FspEndpointTypes.FSPIOP_CALLBACK_URL_BULK_QUOTES) {
    const { db, log, proxyClient } = this
    return this.libUtil.getParticipantEndpoint({ fspId, endpointType, db, log, proxyClient })
  }
}

module.exports = BulkQuotesModel
