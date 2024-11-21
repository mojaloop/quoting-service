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
 - Henk Kodde <henk.kodde@modusbox.com>
 - Matt Kingston <matt.kingston@modusbox.com>
 - Vassilis Barzokas <vassilis.barzokas@modusbox.com>
 - Shashikant Hirugade <shashikant.hirugade@modusbox.com>
 --------------
 ******/

const axios = require('axios')
const ENUM = require('@mojaloop/central-services-shared').Enum
const ErrorHandler = require('@mojaloop/central-services-error-handling')
const EventSdk = require('@mojaloop/event-sdk')
const LibUtil = require('@mojaloop/central-services-shared').Util
const Logger = require('@mojaloop/central-services-logger')
const MLNumber = require('@mojaloop/ml-number')
const JwsSigner = require('@mojaloop/sdk-standard-components').Jws.signer
const Metrics = require('@mojaloop/central-services-metrics')

const Config = require('../lib/config')
const LOCAL_ENUM = require('../lib/enum')
const dto = require('../lib/dto')
const util = require('../lib/util')
const { logger } = require('../lib')
const { httpRequest } = require('../lib/http')
const { RESOURCES } = require('../constants')
const { executeRules, handleRuleEvents } = require('./executeRules')

axios.defaults.headers.common = {}

/**
 * Encapsulates operations on the quotes domain model
 *
 * @returns {undefined}
 */
class QuotesModel {
  constructor (deps) {
    this.db = deps.db
    this.requestId = deps.requestId
    this.proxyClient = deps.proxyClient
    this.envConfig = deps.config || new Config()
    this.log = deps.log || logger.child({
      context: this.constructor.name,
      requestId: this.requestId
    })
  }

  executeRules () {
    return executeRules.apply(this, arguments)
  }

  handleRuleEvents = handleRuleEvents

  /**
   * Validates the quote request object
   *
   * @returns {promise} - promise will reject if request is not valid
   */
  async validateQuoteRequest (fspiopSource, fspiopDestination, quoteRequest) {
    const histTimer = Metrics.getHistogram(
      'model_quote',
      'validateQuoteRequest - Metrics for quote model',
      ['success', 'queryName', 'duplicateResult']
    ).startTimer()
    const { envConfig } = this
    const log = this.log.child({ quoteId: quoteRequest?.quoteId })
    // note that the framework should validate the form of the request
    // here we can do some hard-coded rule validations to ensure requests
    // do not lead to unsupported scenarios or use-cases.

    // This validation is being removed because it prevents the switch from supporting PAYEE initiated use cases
    // if (quoteRequest.transactionType.initiator !== 'PAYER') {
    //   throw ErrorHandler.CreateFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.NOT_IMPLEMENTED, 'Only PAYER initiated transactions are supported', null, fspiopSource)
    // }

    try {
      // Any quoteRequest specific validations to be added here
      if (!quoteRequest) {
        // internal-error
        throw ErrorHandler.CreateInternalServerFSPIOPError('Missing quoteRequest', null, fspiopSource)
      }

      // Ensure the proxy client is connected if we need to use it down the road
      if (this.proxyClient?.isConnected === false) await this.proxyClient.connect()

      // In fspiop api spec 2.0, to support FX, `supportedCurrencies` can be optionally passed in via the payer property.
      // If `supportedCurrencies` is present, then payer FSP must have position accounts for all those currencies.
      if (quoteRequest.payer.supportedCurrencies &&
          quoteRequest.payer.supportedCurrencies.length > 0 &&
          // if the payer dfsp has a proxy cache entry, we do not validate the dfsp here
          !(await this.proxyClient?.lookupProxyByDfspId(fspiopSource))
      ) {
        await Promise.all(quoteRequest.payer.supportedCurrencies.map(currency =>
          this.db.getParticipant(fspiopSource, LOCAL_ENUM.PAYER_DFSP, currency, ENUM.Accounts.LedgerAccountType.POSITION)
        ))
      } else {
        // If it is not passed in, then we validate payee against the `amount` currency.
        // if the payee dfsp has a proxy cache entry, we do not validate the dfsp here
        if (!(await this.proxyClient?.lookupProxyByDfspId(fspiopDestination))) {
          await this.db.getParticipant(fspiopDestination, LOCAL_ENUM.PAYEE_DFSP, quoteRequest.amount.currency, ENUM.Accounts.LedgerAccountType.POSITION)
        }
      }

      // Following is the validation to make sure valid fsp's are used in the payload for simple routing mode
      if (envConfig.simpleRoutingMode) {
        log.debug('simpleRoutingMode case')
        // Lets make sure the optional fspId exists in the payer's partyIdInfo before we validate it
        if (
          quoteRequest.payer?.partyIdInfo?.fspId &&
          quoteRequest.payer.partyIdInfo.fspId !== fspiopSource &&
          // if the payer dfsp has a proxy cache entry, we do not validate the dfsp here
          !(await this.proxyClient?.lookupProxyByDfspId(quoteRequest.payer.partyIdInfo.fspId))
        ) {
          await this.db.getParticipant(quoteRequest.payer.partyIdInfo.fspId, LOCAL_ENUM.PAYER_DFSP, quoteRequest.amount.currency, ENUM.Accounts.LedgerAccountType.POSITION)
        }
        // Lets make sure the optional fspId exists in the payee's partyIdInfo before we validate it
        if (
          quoteRequest.payee?.partyIdInfo?.fspId &&
          quoteRequest.payee.partyIdInfo.fspId !== fspiopDestination &&
          // if the payee dfsp has a proxy cache entry, we do not validate the dfsp here
          !(await this.proxyClient?.lookupProxyByDfspId(quoteRequest.payee.partyIdInfo.fspId))
        ) {
          await this.db.getParticipant(quoteRequest.payee.partyIdInfo.fspId, LOCAL_ENUM.PAYEE_DFSP, quoteRequest.amount.currency, ENUM.Accounts.LedgerAccountType.POSITION)
        }
      }
      histTimer({ success: true, queryName: 'quote_validateQuoteRequest' })
      log.verbose('validateQuoteRequest is done')
    } catch (err) {
      log.warn('validateQuoteRequest is failed with error', err)
      histTimer({ success: false, queryName: 'quote_validateQuoteRequest' })
      throw err
    }
  }

  /**
   * Validates the quote update request
   *
   * @returns {promise} - promise will reject if request is not valid
   */
  async validateQuoteUpdate (headers, quoteUpdateRequest) {
    if (this.proxyClient?.isConnected === false) await this.proxyClient.connect()
    const fspiopSource = headers[ENUM.Http.Headers.FSPIOP.SOURCE]
    let proxyIdSource
    if (this.proxyClient) {
      proxyIdSource = await this.proxyClient.lookupProxyByDfspId(fspiopSource)
    }
    // skip fulfil validation if the source is a proxy
    if (!proxyIdSource) {
      const payeeCurrency = quoteUpdateRequest.payeeReceiveAmount?.currency || quoteUpdateRequest.transferAmount.currency
      await this.db.getParticipant(fspiopSource, LOCAL_ENUM.PAYEE_DFSP, payeeCurrency, ENUM.Accounts.LedgerAccountType.POSITION)
    }
  }

  /**
   * Logic for creating and handling quote requests
   *
   * @returns {object} - returns object containing keys for created database entities
   */
  async handleQuoteRequest (headers, quoteRequest, span, cache, originalPayload) {
    // todo: update method signature to use object destructuring
    const histTimer = Metrics.getHistogram(
      'model_quote',
      'handleQuoteRequest - Metrics for quote model',
      ['success', 'queryName', 'duplicateResult']
    ).startTimer()
    const { envConfig } = this
    // accumulate enum ids
    const refs = {}

    const fspiopSource = headers[ENUM.Http.Headers.FSPIOP.SOURCE]
    const fspiopDestination = headers[ENUM.Http.Headers.FSPIOP.DESTINATION]
    const log = this.log.child({ quoteId: quoteRequest?.quoteId })
    log.debug('handleQuoteRequest...', { fspiopSource, fspiopDestination })

    let txn
    let handledRuleEvents
    const handleQuoteRequestSpan = span.getChild('qs_quote_handleQuoteRequest')
    try {
      await this.validateQuoteRequest(fspiopSource, fspiopDestination, quoteRequest)

      const { payer, payee } = await util.fetchParticipantInfo(fspiopSource, fspiopDestination, cache, this.proxyClient)
      log.debug('got payer and payee', { payer, payee })

      // Run the rules engine. If the user does not want to run the rules engine, they need only to
      // supply a rules file containing an empty array.
      handledRuleEvents = await this.executeRules(headers, quoteRequest, originalPayload, payer, payee, 'quoteRequest')

      if (handledRuleEvents.terminate) {
        return
      }

      if (!envConfig.simpleRoutingMode) {
        // check if this is a resend or an erroneous duplicate
        const dupe = await this.checkDuplicateQuoteRequest(quoteRequest)
        log.debug('check duplicate for quote', { dupe })

        // fail fast on duplicate
        if (dupe.isDuplicateId && (!dupe.isResend)) {
          // same quoteId but a different request, this is an error!
          // internal-error
          throw ErrorHandler.CreateFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.MODIFIED_REQUEST,
            `Quote ${quoteRequest.quoteId} is a duplicate but hashes dont match`, null, fspiopSource)
        }

        if (dupe.isResend && dupe.isDuplicateId) {
          // this is a resend
          // See section 3.2.5.1 in "API Definition v1.0.docx" API specification document.
          return this.handleQuoteRequestResend(
            handledRuleEvents.headers,
            handledRuleEvents.quoteRequest,
            handleQuoteRequestSpan,
            handledRuleEvents.additionalHeaders
          )
        }

        // get various enum ids (async, as parallel as possible)
        const payerEnumVals = []
        const payeeEnumVals = []
        ;[
          refs.transactionInitiatorTypeId,
          refs.transactionInitiatorId,
          refs.transactionScenarioId,
          refs.amountTypeId,
          payerEnumVals[0],
          payerEnumVals[1],
          payerEnumVals[2],
          payerEnumVals[3],
          payerEnumVals[4],
          payeeEnumVals[0],
          payeeEnumVals[1],
          payeeEnumVals[2],
          payeeEnumVals[3],
          payeeEnumVals[4]
        ] = await Promise.all([
          this.db.getInitiatorType(quoteRequest.transactionType.initiatorType),
          this.db.getInitiator(quoteRequest.transactionType.initiator),
          this.db.getScenario(quoteRequest.transactionType.scenario),
          this.db.getAmountType(quoteRequest.amountType),
          this.db.getPartyType(LOCAL_ENUM.PAYER),
          this.db.getPartyIdentifierType(quoteRequest.payer.partyIdInfo.partyIdType),
          payer.proxiedParticipant ? null : this.db.getParticipantByName(quoteRequest.payer.partyIdInfo.fspId),
          this.db.getTransferParticipantRoleType(LOCAL_ENUM.PAYER_DFSP),
          this.db.getLedgerEntryType(LOCAL_ENUM.PRINCIPLE_VALUE),
          this.db.getPartyType(LOCAL_ENUM.PAYEE),
          this.db.getPartyIdentifierType(quoteRequest.payee.partyIdInfo.partyIdType),
          payee.proxiedParticipant ? null : this.db.getParticipantByName(quoteRequest.payee.partyIdInfo.fspId),
          this.db.getTransferParticipantRoleType(LOCAL_ENUM.PAYEE_DFSP),
          this.db.getLedgerEntryType(LOCAL_ENUM.PRINCIPLE_VALUE)
        ])

        if (quoteRequest.transactionType.subScenario) {
          // a sub scenario is specified, we need to look it up
          refs.transactionSubScenarioId = await this.db.getSubScenario(quoteRequest.transactionType.subScenario)
        }

        // if we get here we need to create a duplicate check row
        const hash = util.calculateRequestHash(quoteRequest)

        // do everything in a db txn so we can rollback multiple operations if something goes wrong
        txn = await this.db.newTransaction()
        await this.db.createQuoteDuplicateCheck(txn, quoteRequest.quoteId, hash)

        // create a txn reference
        refs.transactionReferenceId = await this.db.createTransactionReference(
          txn,
          quoteRequest.quoteId,
          quoteRequest.transactionId
        )
        this.log.verbose('transactionReference for quote is created in db: ', {
          quoteId: quoteRequest.quoteId,
          transactionId: quoteRequest.transactionId,
          transactionReferenceId: refs.transactionReferenceId
        })

        // create the quote row itself
        // eslint-disable-next-line require-atomic-updates
        refs.quoteId = await this.db.createQuote(txn, {
          quoteId: quoteRequest.quoteId,
          transactionReferenceId: refs.transactionReferenceId,
          transactionRequestId: quoteRequest.transactionRequestId || null,
          note: quoteRequest.note,
          expirationDate: quoteRequest.expiration ? new Date(quoteRequest.expiration) : null,
          transactionInitiatorId: refs.transactionInitiatorId,
          transactionInitiatorTypeId: refs.transactionInitiatorTypeId,
          transactionScenarioId: refs.transactionScenarioId,
          balanceOfPaymentsId: quoteRequest.transactionType.balanceOfPayments ? Number(quoteRequest.transactionType.balanceOfPayments) : null,
          transactionSubScenarioId: refs.transactionSubScenarioId,
          amountTypeId: refs.amountTypeId,
          amount: new MLNumber(quoteRequest.amount.amount).toFixed(envConfig.amount.scale),
          currencyId: quoteRequest.amount.currency
        })

        ;[
          refs.payerId,
          refs.payeeId
        ] = await Promise.all([
          this.db.createPayerQuoteParty(txn, refs.quoteId, quoteRequest.payer,
            quoteRequest.amount.amount, quoteRequest.amount.currency, payerEnumVals),
          this.db.createPayeeQuoteParty(txn, refs.quoteId, quoteRequest.payee,
            quoteRequest.amount.amount, quoteRequest.amount.currency, payeeEnumVals)
        ])

        // store any extension list items
        if (quoteRequest.extensionList && Array.isArray(quoteRequest.extensionList.extension)) {
          refs.extensions = await this.db.createQuoteExtensions(
            txn, quoteRequest.extensionList.extension, quoteRequest.quoteId, quoteRequest.transactionId
          )
        }

        // did we get a geoCode for the initiator?
        if (quoteRequest.geoCode) {
          // eslint-disable-next-line require-atomic-updates
          refs.geoCodeId = await this.db.createGeoCode(txn, {
            quotePartyId: quoteRequest.transactionType.initiator === 'PAYER' ? refs.payerId : refs.payeeId,
            latitude: quoteRequest.geoCode.latitude,
            longitude: quoteRequest.geoCode.longitude
          })
        }

        await txn.commit()
        log.debug('create quote transaction committed to db', { refs })
      }

      log.verbose('rules passed, forwarding the quote on to the recipient dfsp...')
    } catch (err) {
      log.error('error in handleQuoteRequest:', err)
      if (txn) {
        await txn.rollback().catch(() => {})
      }

      const fspiopError = ErrorHandler.ReformatFSPIOPError(err)
      const state = new EventSdk.EventStateMetadata(EventSdk.EventStatusType.failed, fspiopError.apiErrorCode.code, fspiopError.apiErrorCode.message)
      if (handleQuoteRequestSpan) {
        await handleQuoteRequestSpan.error(fspiopError, state)
        await handleQuoteRequestSpan.finish(fspiopError.message, state)
      }
      histTimer({ success: false, queryName: 'quote_handleQuoteRequest' })
      throw fspiopError
    }

    let forwardQuoteRequestSpan
    try {
      forwardQuoteRequestSpan = handleQuoteRequestSpan.getChild('qs_quote_forwardQuoteRequest')
      histTimer({ success: true, queryName: 'quote_handleQuoteRequest' })

      if (envConfig.simpleRoutingMode) {
        await forwardQuoteRequestSpan.audit({ headers, payload: quoteRequest }, EventSdk.AuditEventAction.start)
        await this.forwardQuoteRequest(handledRuleEvents.headers, quoteRequest.quoteId, handledRuleEvents.quoteRequest, forwardQuoteRequestSpan)
      } else {
        await forwardQuoteRequestSpan.audit({ headers, payload: refs }, EventSdk.AuditEventAction.start)
        await this.forwardQuoteRequest(handledRuleEvents.headers, refs.quoteId, handledRuleEvents.quoteRequest, forwardQuoteRequestSpan, handledRuleEvents.additionalHeaders)
      }
    } catch (err) {
      // any-error
      // as we are on our own in this context, dont just rethrow the error, instead...
      // get the model to handle it
      log.warn('handleQuoteRequest failed on forwarding quote request:', err)
      if (envConfig.simpleRoutingMode) {
        await this.handleException(fspiopSource, quoteRequest.quoteId, err, headers, forwardQuoteRequestSpan)
      } else {
        await this.handleException(fspiopSource, refs.quoteId, err, headers, forwardQuoteRequestSpan)
      }
      histTimer({ success: false, queryName: 'quote_handleQuoteRequest' })
    } finally {
      if (!forwardQuoteRequestSpan.isFinished) {
        await forwardQuoteRequestSpan.finish()
      }
      if (!handleQuoteRequestSpan.isFinished) {
        await handleQuoteRequestSpan.finish()
      }
    }

    log.info('handleQuoteRequest is done')
    // all ok, return refs
    return refs
  }

  /**
   * Forwards a quote request to a payee DFSP for processing
   *
   * @returns {undefined}
   */
  async forwardQuoteRequest (headers, quoteId, originalQuoteRequest, span, additionalHeaders) {
    const histTimer = Metrics.getHistogram(
      'model_quote',
      'forwardQuoteRequest - Metrics for quote model',
      ['success', 'queryName', 'duplicateResult']
    ).startTimer()
    const log = this.log.child({ quoteId })
    const fspiopSource = headers[ENUM.Http.Headers.FSPIOP.SOURCE]
    const fspiopDest = headers[ENUM.Http.Headers.FSPIOP.DESTINATION]

    try {
      if (!originalQuoteRequest) {
        // internal-error
        throw ErrorHandler.CreateInternalServerFSPIOPError('No quote request to forward', null, fspiopSource)
      }

      // lookup payee dfsp callback endpoint
      // TODO: for MVP we assume initiator is always payer dfsp! this may not always be the
      // case if a xfer is requested by payee
      const endpoint = await this._getParticipantEndpoint(fspiopDest)
      log.verbose('Resolved PAYEE party FSPIOP_CALLBACK_URL_QUOTES endpoint', { endpoint, fspiopDest })

      // if the endpoint is also not found in the proxy cache, throw an error
      if (!endpoint) {
        // internal-error
        // we didnt get an endpoint for the payee dfsp!
        // make an error callback to the initiator
        throw ErrorHandler.CreateFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.DESTINATION_FSP_ERROR, `No FSPIOP_CALLBACK_URL_QUOTES found for quote ${quoteId} PAYEE party ${fspiopDest}`, null, fspiopSource)
      }

      let opts = {
        method: ENUM.Http.RestMethods.POST,
        url: `${endpoint}/quotes`,
        data: JSON.stringify(originalQuoteRequest),
        headers: util.generateRequestHeaders(headers, this.envConfig.protocolVersions, false, RESOURCES.quotes, additionalHeaders)
      }
      if (span) {
        opts = span.injectContextToHttpRequest(opts)
        span.audit(opts, EventSdk.AuditEventAction.egress)
      }
      log.debug('Forwarding quote request...', { opts })

      await httpRequest(opts, fspiopSource)
      histTimer({ success: true, queryName: 'quote_forwardQuoteRequest' })
      log.info('forwardQuoteRequest is done')
    } catch (err) {
      log.error('forwardQuoteRequest is failed with error:', err)
      histTimer({ success: false, queryName: 'quote_forwardQuoteRequest' })
      throw ErrorHandler.ReformatFSPIOPError(err)
    }
  }

  /**
   * Deals with resends of quote requests (POST) under the API spec:
   * See section 3.2.5.1, 9.4 and 9.5 in "API Definition v1.0.docx" API specification document.
   */
  async handleQuoteRequestResend (headers, quoteRequest, span, additionalHeaders) {
    const histTimer = Metrics.getHistogram(
      'model_quote',
      'handleQuoteRequestResend - Metrics for quote model',
      ['success', 'queryName', 'duplicateResult']
    ).startTimer()
    const log = this.log.child({ quoteId: quoteRequest?.quoteId })
    try {
      const fspiopSource = headers[ENUM.Http.Headers.FSPIOP.SOURCE]
      log.debug('handleQuoteRequestResend...', { fspiopSource, quoteRequest, headers })

      // we are ok to assume the quoteRequest object passed to us is the same as the original...
      // as it passed a hash duplicate check...so go ahead and use it to resend rather than
      // hit the db again

      // if we got here rules passed, so we can forward the quote on to the recipient dfsp
      const childSpan = span.getChild('qs_quote_forwardQuoteRequestResend')
      try {
        await childSpan.audit({ headers, payload: quoteRequest }, EventSdk.AuditEventAction.start)
        await this.forwardQuoteRequest(headers, quoteRequest.quoteId, quoteRequest, childSpan, additionalHeaders)
        histTimer({ success: true, queryName: 'quote_handleQuoteRequestResend' })
        log.info('handleQuoteRequestResend is done')
      } catch (err) {
        // any-error
        // as we are on our own in this context, dont just rethrow the error, instead...
        // get the model to handle it
        log.error('error in handleQuoteRequestResend', err)
        const fspiopError = ErrorHandler.ReformatFSPIOPError(err)
        await this.handleException(fspiopSource, quoteRequest.quoteId, fspiopError, headers, childSpan)
        histTimer({ success: false, queryName: 'quote_handleQuoteRequestResend' })
      } finally {
        if (!childSpan.isFinished) {
          await childSpan.finish()
        }
      }
    } catch (err) {
      log.error('Error in handleQuoteRequestResend: ', err)
      histTimer({ success: false, queryName: 'quote_handleQuoteRequestResend' })
      throw ErrorHandler.ReformatFSPIOPError(err)
    }
  }

  /**
   * Logic for handling quote update requests e.g. PUT /quotes/{id} requests
   *
   * @returns {object} - object containing updated entities
   */
  async handleQuoteUpdate (headers, quoteId, payload, span, originalPayload) {
    // todo: update method signature to use object destructuring
    const histTimer = Metrics.getHistogram(
      'model_quote',
      'handleQuoteUpdate - Metrics for quote model',
      ['success', 'queryName', 'duplicateResult']
    ).startTimer()
    let txn = null
    let payeeParty = null
    const fspiopSource = headers[ENUM.Http.Headers.FSPIOP.SOURCE]
    const handleQuoteUpdateSpan = span.getChild('qs_quote_handleQuoteUpdate')
    const log = this.log.child({ quoteId, fspiopSource })

    try {
      // ensure no 'accept' header is present in the request headers.
      if ('accept' in headers) {
        throw ErrorHandler.CreateFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.VALIDATION_ERROR,
          `Update for quote ${quoteId} failed: "accept" header should not be sent in callbacks.`, null, headers['fspiop-source'])
      }

      await this.validateQuoteUpdate(headers, payload)

      // accumulate enum ids
      const refs = {}
      if (!this.envConfig.simpleRoutingMode) {
        // check if this is a resend or an erroneous duplicate
        const dupe = await this.checkDuplicateQuoteResponse(quoteId, payload)
        log.debug('Check duplicate for quote update: ', { dupe })

        // fail fast on duplicate
        if (dupe.isDuplicateId && (!dupe.isResend)) {
          // internal-error
          // same quoteId but a different request, this is an error!
          throw ErrorHandler.CreateFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.MODIFIED_REQUEST, `Update for quote ${quoteId} is a duplicate but hashes don't match`, null, fspiopSource)
        }

        if (dupe.isResend && dupe.isDuplicateId) {
          // this is a resend
          // See section 3.2.5.1 in "API Definition v1.0.docx" API specification document.
          histTimer({ success: true, queryName: 'quote_handleQuoteUpdate' })
          return this.handleQuoteUpdateResend(headers, quoteId, originalPayload, handleQuoteUpdateSpan)
        }

        if (payload.geoCode) {
          payeeParty = await this.db.getQuoteParty(quoteId, 'PAYEE')

          if (!payeeParty) {
            // internal-error
            throw ErrorHandler.CreateFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.PARTY_NOT_FOUND, `Unable to find payee party for quote ${quoteId}`, null, fspiopSource)
          }
        }

        // do everything in a transaction so we can rollback multiple operations if something goes wrong
        txn = await this.db.newTransaction()

        // create the quote response row in the db
        const newQuoteResponse = await this.db.createQuoteResponse(txn, quoteId, {
          transferAmount: payload.transferAmount,
          payeeReceiveAmount: payload.payeeReceiveAmount,
          payeeFspFee: payload.payeeFspFee,
          payeeFspCommission: payload.payeeFspCommission,
          condition: payload.condition,
          expiration: payload.expiration ? new Date(payload.expiration) : null,
          isValid: 1 // assume the request is valid if we passed validation and duplicate checks etc...
        })

        refs.quoteResponseId = newQuoteResponse.quoteResponseId

        // if we get here we need to create a duplicate check row
        const hash = util.calculateRequestHash(payload)
        await this.db.createQuoteUpdateDuplicateCheck(txn, quoteId, refs.quoteResponseId, hash)

        // create ilp packet in the db
        await this.db.createQuoteResponseIlpPacket(txn, refs.quoteResponseId, payload.ilpPacket)

        // did we get a geoCode for the payee?
        if (payload.geoCode) {
          refs.geoCodeId = await this.db.createGeoCode(txn, {
            quotePartyId: payeeParty?.quotePartyId,
            latitude: payload.geoCode.latitude,
            longitude: payload.geoCode.longitude
          })
        }

        // store any extension list items
        if (payload.extensionList && Array.isArray(payload.extensionList.extension)) {
          refs.extensions = await this.db.createQuoteExtensions(
            txn, payload.extensionList.extension, quoteId, null, refs.quoteResponseId
          )
        }

        // todo: create any additional quoteParties e.g. for fees, commission etc...

        await txn.commit()
        log.debug('create quote update transaction committed to db:', { refs })

        /// if we got here, all entities have been created in db correctly to record the quote request

        // check quote response rules
        // let test = { ...payload };

        // const failures = await quoteRules.getFailures(test);
        // if (failures && failures.length > 0) {
        // quote broke business rules, queue up an error callback to the caller
        //    this.writeLog(`Rules failed for quoteId ${refs.quoteId}: ${util.inspect(failures)}`);
        // todo: make error callback
        // }
      }
      // if we got here rules passed, so we can forward the quote on to the recipient dfsp
      const childSpan = handleQuoteUpdateSpan.getChild('qs_quote_forwardQuoteUpdate')
      try {
        histTimer({ success: true, queryName: 'quote_handleQuoteUpdate' })
        await this.forwardQuoteUpdate(headers, quoteId, originalPayload, childSpan)
      } catch (err) {
        // any-error
        // as we are on our own in this context, dont just rethrow the error, instead...
        // get the model to handle it
        log.warn('error forwarding quote update', err)
        histTimer({ success: false, queryName: 'quote_handleQuoteUpdate' })
        await this.handleException(fspiopSource, quoteId, err, headers, childSpan)
      } finally {
        if (!childSpan.isFinished) {
          await childSpan.finish()
        }
        if (!handleQuoteUpdateSpan.isFinished) {
          await handleQuoteUpdateSpan.finish()
        }
      }

      // all ok, return refs
      return refs
    } catch (err) {
      // internal-error
      log.error('error in handleQuoteUpdate: ', err)
      if (txn) {
        await txn.rollback().catch(() => {})
      }
      const fspiopError = ErrorHandler.ReformatFSPIOPError(err)
      const state = new EventSdk.EventStateMetadata(EventSdk.EventStatusType.failed, fspiopError.apiErrorCode.code, fspiopError.apiErrorCode.message)
      if (handleQuoteUpdateSpan) {
        await handleQuoteUpdateSpan.error(fspiopError, state)
        await handleQuoteUpdateSpan.finish(fspiopError.message, state)
      }
      histTimer({ success: false, queryName: 'quote_handleQuoteUpdate' })
      throw fspiopError
    }
  }

  /**
   * Forwards a quote response to a payer DFSP for processing
   *
   * @returns {undefined}
   */
  async forwardQuoteUpdate (headers, quoteId, originalQuoteResponse, span) {
    const histTimer = Metrics.getHistogram(
      'model_quote',
      'forwardQuoteUpdate - Metrics for quote model',
      ['success', 'queryName', 'duplicateResult']
    ).startTimer()
    const log = this.log.child({ quoteId })
    const fspiopSource = headers[ENUM.Http.Headers.FSPIOP.SOURCE]
    const fspiopDest = headers[ENUM.Http.Headers.FSPIOP.DESTINATION]

    try {
      if (!originalQuoteResponse) {
        // we need to recreate the quote response
        // internal-error
        throw ErrorHandler.CreateInternalServerFSPIOPError('No quote response to forward', null, fspiopSource)
      }

      // lookup payer dfsp callback endpoint
      const endpoint = await this._getParticipantEndpoint(fspiopDest)
      log.verbose('Resolved PAYER party FSPIOP_CALLBACK_URL_QUOTES endpoint', { endpoint, fspiopDest })

      if (!endpoint) {
        // make an error callback to the initiator
        const fspiopError = ErrorHandler.CreateFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.DESTINATION_FSP_ERROR, `No FSPIOP_CALLBACK_URL_QUOTES found for quote ${quoteId} PAYER party`, null, fspiopSource)
        return this.sendErrorCallback(fspiopSource, fspiopError, quoteId, headers, span, true)
      }

      // we need to strip off the 'accept' header
      // for all PUT requests as per the API Specification Document
      // https://github.com/mojaloop/mojaloop-specification/blob/main/documents/v1.1-document-set/fspiop-v1.1-openapi2.yaml
      let opts = {
        method: ENUM.Http.RestMethods.PUT,
        url: `${endpoint}/quotes/${quoteId}`,
        data: JSON.stringify(originalQuoteResponse),
        headers: util.generateRequestHeaders(headers, this.envConfig.protocolVersions, true, RESOURCES.quotes, null)
      }
      if (span) {
        opts = span.injectContextToHttpRequest(opts)
        span.audit(opts, EventSdk.AuditEventAction.egress)
      }
      log.debug('Forwarding quote response...', { opts })

      await httpRequest(opts, fspiopSource)
      histTimer({ success: true, queryName: 'quote_forwardQuoteUpdate' })
      log.info('forwardQuoteUpdate is done')
    } catch (err) {
      log.error('error in forwardQuoteUpdate on forwarding quote response:', err)
      histTimer({ success: false, queryName: 'quote_forwardQuoteUpdate' })
      throw ErrorHandler.ReformatFSPIOPError(err)
    }
  }

  /**
   * Deals with resends of quote responses (PUT) under the API spec:
   * See section 3.2.5.1, 9.4 and 9.5 in "API Definition v1.0.docx" API specification document.
   */
  async handleQuoteUpdateResend (headers, quoteId, payload, span) {
    const histTimer = Metrics.getHistogram(
      'model_quote',
      'handleQuoteUpdateResend - Metrics for quote model',
      ['success', 'queryName', 'duplicateResult']
    ).startTimer()
    const log = this.log.child({ quoteId })

    try {
      const fspiopSource = headers[ENUM.Http.Headers.FSPIOP.SOURCE]
      const fspiopDest = headers[ENUM.Http.Headers.FSPIOP.DESTINATION]
      log.debug('handleQuoteUpdateResend...', { fspiopSource, fspiopDest, quoteUpdate: payload })

      // we are ok to assume the quoteUpdate object passed to us is the same as the original...
      // as it passed a hash duplicate check...so go ahead and use it to resend rather than
      // hit the db again

      // if we got here rules passed, so we can forward the quote on to the recipient dfsp
      const childSpan = span.getChild('qs_quote_forwardQuoteUpdateResend')
      try {
        await childSpan.audit({ headers, params: { quoteId }, payload }, EventSdk.AuditEventAction.start)
        await this.forwardQuoteUpdate(headers, quoteId, payload, childSpan)
        histTimer({ success: true, queryName: 'quote_handleQuoteUpdateResend' })
        log.info('handleQuoteUpdateResend is done')
      } catch (err) {
        // any-error
        // as we are on our own in this context, dont just rethrow the error, instead...
        // get the model to handle it
        log.warn('error in handleQuoteUpdateResend on forwardQuoteUpdate: ', err)
        await this.handleException(fspiopSource, quoteId, err, headers, childSpan)
        histTimer({ success: false, queryName: 'quote_handleQuoteUpdateResend' })
        log.info('handleQuoteUpdateResend handleException is done')
      } finally {
        if (!childSpan.isFinished) {
          await childSpan.finish()
        }
      }
    } catch (err) {
      log.error('Error in handleQuoteUpdateResend: ', err)
      histTimer({ success: false, queryName: 'quote_handleQuoteUpdateResend' })
      throw ErrorHandler.ReformatFSPIOPError(err)
    }
  }

  /**
   * Handles error reports from clients e.g. POST quotes/{id}/error
   *
   * @returns {undefined}
   */
  async handleQuoteError (headers, quoteId, error, span, originalPayload) {
    const histTimer = Metrics.getHistogram(
      'model_quote',
      'handleQuoteError - Metrics for quote model',
      ['success', 'queryName', 'duplicateResult']
    ).startTimer()
    let txn = null
    let newError
    const childSpan = span.getChild('qs_quote_handleQuoteError')

    try {
      if (!this.envConfig.simpleRoutingMode) {
        // do everything in a transaction so we can rollback multiple operations if something goes wrong
        txn = await this.db.newTransaction()

        // persist the error
        newError = await this.db.createQuoteError(txn, {
          quoteId,
          errorCode: Number(error.errorCode),
          errorDescription: error.errorDescription
        })

        // commit the txn to the db
        await txn.commit()
      }
      // create a new object to represent the error
      const fspiopError = ErrorHandler.CreateFSPIOPErrorFromErrorInformation(error)

      // Needed to add await here to prevent 'childSpan already finished' bug
      histTimer({ success: true, queryName: 'quote_handleQuoteError' })
      await this.sendErrorCallback(headers[ENUM.Http.Headers.FSPIOP.DESTINATION], fspiopError, quoteId, headers, childSpan, false, originalPayload)

      return newError
    } catch (err) {
      // internal-error
      this.log.error('error in handleQuoteError: ', err)
      if (txn) {
        await txn.rollback().catch(() => {})
      }
      const fspiopError = ErrorHandler.ReformatFSPIOPError(err)
      const state = new EventSdk.EventStateMetadata(EventSdk.EventStatusType.failed, fspiopError.apiErrorCode.code, fspiopError.apiErrorCode.message)
      if (childSpan) {
        await childSpan.error(fspiopError, state)
        await childSpan.finish(fspiopError.message, state)
      }
      histTimer({ success: false, queryName: 'quote_handleQuoteError' })
      throw fspiopError
    }
  }

  /**
   * Attempts to handle a quote GET request by forwarding it to the destination DFSP
   *
   * @returns {undefined}
   */
  async handleQuoteGet (headers, quoteId, span) {
    const histTimer = Metrics.getHistogram(
      'model_quote',
      'handleQuoteGet - Metrics for quote model',
      ['success', 'queryName', 'duplicateResult']
    ).startTimer()
    const fspiopSource = headers[ENUM.Http.Headers.FSPIOP.SOURCE]
    const log = this.log.child({ quoteId, fspiopSource })
    let childSpan
    try {
      childSpan = span.getChild('qs_quote_forwardQuoteGet')
      try {
        await childSpan.audit({ headers, params: { quoteId } }, EventSdk.AuditEventAction.start)
        histTimer({ success: false, queryName: 'quote_handleQuoteGet' })
        await this.forwardQuoteGet(headers, quoteId, childSpan)
      } catch (err) {
        // any-error
        // as we are on our own in this context, dont just rethrow the error, instead...
        // get the model to handle it
        log.warn('error forwarding quote get', err)
        histTimer({ success: false, queryName: 'quote_handleQuoteGet' })
        await this.handleException(fspiopSource, quoteId, err, headers, childSpan)
      } finally {
        if (!childSpan.isFinished) {
          await childSpan.finish()
        }
      }
    } catch (err) {
      log.error('error in handleQuoteGet:', err)
      histTimer({ success: false, queryName: 'quote_handleQuoteGet' })
      throw ErrorHandler.ReformatFSPIOPError(err)
    }
  }

  /**
   * Attempts to forward a quote GET request
   *
   * @returns {undefined}
   */
  async forwardQuoteGet (headers, quoteId, span) {
    const histTimer = Metrics.getHistogram(
      'model_quote',
      'forwardQuoteGet - Metrics for quote model',
      ['success', 'queryName', 'duplicateResult']
    ).startTimer()
    const log = this.log.child({ quoteId })
    let endpoint

    try {
      // we just need to forward this request on to the destination dfsp. they should response with a
      // quote update resend (PUT)

      // lookup payee dfsp callback endpoint
      // todo: for MVP we assume initiator is always payer dfsp! this may not always be the case if a xfer is requested by payee
      const fspiopSource = headers[ENUM.Http.Headers.FSPIOP.SOURCE]
      const fspiopDest = headers[ENUM.Http.Headers.FSPIOP.DESTINATION]

      endpoint = await this._getParticipantEndpoint(fspiopDest)
      log.debug('resolved FSPIOP_CALLBACK_URL_QUOTES endpoint for quote GET: ', { endpoint, fspiopDest })

      if (!endpoint) {
        // we didnt get an endpoint for the payee dfsp!
        // make an error callback to the initiator
        // internal-error
        throw ErrorHandler.CreateFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.DESTINATION_FSP_ERROR, `No FSPIOP_CALLBACK_URL_QUOTES found for quote GET ${quoteId}`, null, fspiopSource)
      }

      const fullCallbackUrl = `${endpoint}/quotes/${quoteId}`
      const newHeaders = util.generateRequestHeaders(headers, this.envConfig.protocolVersions, false, RESOURCES.quotes, null)

      let opts = {
        method: ENUM.Http.RestMethods.GET,
        url: fullCallbackUrl,
        headers: newHeaders
      }
      log.debug('Forwarding quote get request opts: ', { opts })

      if (span) {
        opts = span.injectContextToHttpRequest(opts)
        span.audit(opts, EventSdk.AuditEventAction.egress)
      }

      histTimer({ success: true, queryName: 'quote_forwardQuoteGet' })
      await httpRequest(opts, fspiopSource)
    } catch (err) {
      log.error('error in forwardQuoteGet:', err)
      histTimer({ success: false, queryName: 'quote_forwardQuoteGet' })
      throw ErrorHandler.ReformatFSPIOPError(err)
    }
  }

  /**
   * Attempts to handle an exception in a sensible manner by forwarding it on to the
   * source of the request that caused the error.
   */
  async handleException (fspiopSource, quoteId, error, headers, span) {
    const histTimer = Metrics.getHistogram(
      'model_quote',
      'handleException - Metrics for quote model',
      ['success', 'queryName', 'duplicateResult']
    ).startTimer()
    const log = this.log.child({ quoteId })
    const fspiopError = ErrorHandler.ReformatFSPIOPError(error)

    const childSpan = span.getChild('qs_quote_sendErrorCallback')
    try {
      await childSpan.audit({ headers, params: { quoteId } }, EventSdk.AuditEventAction.start)
      const result = await this.sendErrorCallback(fspiopSource, fspiopError, quoteId, headers, childSpan, true)
      histTimer({ success: true, queryName: 'quote_handleException' })
      log.info('handleException is done')
      return result
    } catch (err) {
      // any-error
      // not much we can do other than log the error
      log.error('Error occurred while handling error. Check service logs as this error may not have been propagated successfully to any other party', err)
      histTimer({ success: false, queryName: 'quote_handleException' })
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
  async sendErrorCallback (fspiopSource, fspiopError, quoteId, headers, span, modifyHeaders = true, originalPayload) {
    // todo: refactor to remove lots of code duplication from FxQuotesModel/BulkQuotesModel!!
    const histTimer = Metrics.getHistogram(
      'model_quote',
      'sendErrorCallback - Metrics for quote model',
      ['success', 'queryName', 'duplicateResult']
    ).startTimer()
    const { envConfig } = this
    const fspiopDest = headers[ENUM.Http.Headers.FSPIOP.DESTINATION]
    const log = this.log.child({ quoteId, fspiopDest })

    try {
      // look up the callback base url
      const endpoint = await this._getParticipantEndpoint(fspiopSource)
      log.debug('resolved participant FSPIOP_CALLBACK_URL_QUOTES: ', { endpoint, fspiopSource })

      if (!endpoint) {
        // oops, we cant make an error callback if we dont have an endpoint to call!
        // internal-error
        throw ErrorHandler.CreateFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.PARTY_NOT_FOUND, `No FSPIOP_CALLBACK_URL_QUOTES found for ${fspiopSource} unable to make error callback`, null, fspiopSource)
      }

      const fspiopUri = `/quotes/${quoteId}/error`
      const fullCallbackUrl = `${endpoint}${fspiopUri}`

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
        formattedHeaders = util.generateRequestHeadersForJWS(fromSwitchHeaders, envConfig.protocolVersions, true, RESOURCES.quotes)
      } else {
        formattedHeaders = util.generateRequestHeaders(fromSwitchHeaders, envConfig.protocolVersions, true, RESOURCES.quotes, null)
      }
      logger.warn(JSON.stringify(originalPayload))
      let opts = {
        method: ENUM.Http.RestMethods.PUT,
        url: fullCallbackUrl,
        data: originalPayload || await this.makeErrorPayload(fspiopError, headers),
        // use headers of the error object if they are there...
        // otherwise use sensible defaults
        headers: formattedHeaders
      }
      log.debug('sendErrorCallback quote http request opts:', { opts })

      if (span) {
        opts = span.injectContextToHttpRequest(opts)
        span.audit(opts, EventSdk.AuditEventAction.egress)
      }

      let res
      try {
        // If JWS is enabled and the 'fspiop-source' matches the configured jws header value(i.e the hub name)
        // that means it's a switch generated message and we need to sign it
        const needToSign = !opts.headers['fspiop-signature'] &&
          envConfig.jws?.jwsSign &&
          opts.headers['fspiop-source'] === envConfig.jws.fspiopSourceToSign

        if (needToSign) {
          log.verbose('Getting the JWS Signer to sign the switch generated message')
          const jwsSigner = new JwsSigner({
            logger: Logger,
            signingKey: envConfig.jws.jwsSigningKey
          })
          opts.headers['fspiop-signature'] = jwsSigner.getSignature(opts)
        }
        histTimer({ success: true, queryName: 'quote_sendErrorCallback' })
        res = await axios.request(opts)
        // todo: use wrapper on axios
      } catch (err) {
        // external-error
        throw ErrorHandler.CreateFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.DESTINATION_COMMUNICATION_ERROR, `network error in sendErrorCallback: ${err.message}`, {
          error: err,
          url: fullCallbackUrl,
          sourceFsp: fspiopSource,
          destinationFsp: fspiopDest,
          method: opts && opts.method,
          request: JSON.stringify(opts, LibUtil.getCircularReplacer())
        }, fspiopSource)
      }
      this.log.verbose(`callback got response: ${res.status} ${res.statusText}`)

      if (res.status !== ENUM.Http.ReturnCodes.OK.CODE) {
        // external-error
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
      log.error('error in sendErrorCallback:', err)
      const fspiopError = ErrorHandler.ReformatFSPIOPError(err)
      const state = new EventSdk.EventStateMetadata(EventSdk.EventStatusType.failed, fspiopError.apiErrorCode.code, fspiopError.apiErrorCode.message)
      if (span) {
        await span.error(fspiopError, state)
        await span.finish(fspiopError.message, state)
      }
      histTimer({ success: false, queryName: 'quote_sendErrorCallback' })
      throw fspiopError
    }
  }

  /**
   * Tests to see if this quote request is a RESEND of a previous request or an inadvertant duplicate quoteId.
   *
   * See section 3.2.5.1 in "API Definition v1.0.docx" API specification document.
   *
   * @returns {promise} - resolves to an object thus: { isResend: {boolean}, isDuplicateId: {boolean} }
   */
  async checkDuplicateQuoteRequest (quoteRequest) {
    const histTimer = Metrics.getHistogram(
      'model_quote',
      'checkDuplicateQuoteRequest - Metrics for quote model',
      ['success', 'queryName', 'duplicateResult']
    ).startTimer()
    const log = this.log.child({ quoteId: quoteRequest.quoteId })
    try {
      // calculate a SHA-256 of the request
      const hash = util.calculateRequestHash(quoteRequest)
      const dupchk = await this.db.getQuoteDuplicateCheck(quoteRequest.quoteId)
      log.debug('Calculated sha256 hash and duplicate check for quote:', { hash, dupchk })

      if (!dupchk) {
        // no existing record for this quoteId found
        histTimer({ success: true, queryName: 'quote_checkDuplicateQuoteRequest', duplicateResult: 'none' })
        return {
          isResend: false,
          isDuplicateId: false
        }
      }

      if (dupchk.hash === hash) {
        // hash matches, this is a resend
        histTimer({ success: true, queryName: 'quote_checkDuplicateQuoteRequest', duplicateResult: 'resend' })
        return {
          isResend: true,
          isDuplicateId: true
        }
      }

      histTimer({ success: true, queryName: 'quote_checkDuplicateQuoteRequest', duplicateResult: 'duplicate' })
      // if we get here then this is a duplicate id but not a resend e.g. hashes dont match.
      return {
        isResend: false,
        isDuplicateId: true
      }
    } catch (err) {
      log.error('error in checkDuplicateQuoteRequest: ', err)
      histTimer({ success: false, queryName: 'quote_checkDuplicateQuoteRequest', duplicateResult: 'error' })
      throw ErrorHandler.ReformatFSPIOPError(err)
    }
  }

  /**
   * Tests to see if this quote response is a RESEND of a previous response or an inadvertent duplicate quoteId.
   *
   * See section 3.2.5.1 in "API Definition v1.0.docx" API specification document.
   *
   * @returns {promise} - resolves to an object thus: { isResend: {boolean}, isDuplicateId: {boolean} }
   */
  async checkDuplicateQuoteResponse (quoteId, quoteResponse) {
    const histTimer = Metrics.getHistogram(
      'model_quote',
      'checkDuplicateQuoteResponse - Metrics for quote model',
      ['success', 'queryName', 'duplicateResult']
    ).startTimer()
    const log = this.log.child({ quoteId })
    try {
      // calculate a SHA-256 of the request
      const hash = util.calculateRequestHash(quoteResponse)
      const dupchk = await this.db.getQuoteResponseDuplicateCheck(quoteId)
      log.debug('Calculated sha256 hash and duplicate check for quote response:', { hash, dupchk })

      if (!dupchk) {
        // no existing record for this quoteId found
        histTimer({ success: true, queryName: 'quote_checkDuplicateQuoteResponse', duplicateResult: 'none' })
        return {
          isResend: false,
          isDuplicateId: false
        }
      }

      if (dupchk.hash === hash) {
        // hash matches, this is a resend
        histTimer({ success: true, queryName: 'quote_checkDuplicateQuoteResponse', duplicateResult: 'resend' })
        return {
          isResend: true,
          isDuplicateId: true
        }
      }

      // if we get here then this is a duplicate id but not a resend e.g. hashes dont match.
      histTimer({ success: true, queryName: 'quote_checkDuplicateQuoteResponse', duplicateResult: 'duplicate' })
      return {
        isResend: false,
        isDuplicateId: true
      }
    } catch (err) {
      log.error('error in checkDuplicateQuoteResponse: ', err)
      histTimer({ success: false, queryName: 'quote_checkDuplicateQuoteResponse', duplicateResult: 'error' })
      throw ErrorHandler.ReformatFSPIOPError(err)
    }
  }

  async makeErrorPayload (fspiopError, headers) {
    const errObject = fspiopError.toApiErrorObject(this.envConfig.errorHandling)
    return dto.makeErrorPayloadDto(errObject, headers, RESOURCES.quotes, this.log)
  }

  // wrapping this dependency here to allow for easier use and testing
  async _getParticipantEndpoint (fspId, endpointType = ENUM.EndPoints.FspEndpointTypes.FSPIOP_CALLBACK_URL_QUOTES) {
    return util.getParticipantEndpoint({ fspId, db: this.db, loggerFn: this.writeLog.bind(this), endpointType, proxyClient: this.proxyClient })
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

module.exports = QuotesModel
