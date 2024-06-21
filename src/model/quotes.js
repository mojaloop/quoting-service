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
const util = require('util')

const ENUM = require('@mojaloop/central-services-shared').Enum
const ErrorHandler = require('@mojaloop/central-services-error-handling')
const EventSdk = require('@mojaloop/event-sdk')
const LibUtil = require('@mojaloop/central-services-shared').Util
const Logger = require('@mojaloop/central-services-logger')
const MLNumber = require('@mojaloop/ml-number')
const JwsSigner = require('@mojaloop/sdk-standard-components').Jws.signer
const Metrics = require('@mojaloop/central-services-metrics')

const Config = require('../lib/config')
const { httpRequest } = require('../lib/http')
const { getStackOrInspect, generateRequestHeadersForJWS, generateRequestHeaders, calculateRequestHash, fetchParticipantInfo } = require('../lib/util')
const LOCAL_ENUM = require('../lib/enum')
const rules = require('../../config/rules.json')
const RulesEngine = require('./rules.js')

delete axios.defaults.headers.common.Accept
delete axios.defaults.headers.common['Content-Type']

/**
 * Encapsulates operations on the quotes domain model
 *
 * @returns {undefined}
 */
class QuotesModel {
  constructor (config) {
    this.config = config
    this.db = config.db
    this.requestId = config.requestId
  }

  async executeRules (headers, quoteRequest, payer, payee) {
    if (rules.length === 0) {
      return []
    }

    const facts = {
      payer,
      payee,
      payload: quoteRequest,
      headers
    }

    const { events } = await RulesEngine.run(rules, facts)

    this.writeLog(`Rules engine returned events ${JSON.stringify(events)}`)

    return events
  }

  async handleRuleEvents (events, headers, quoteRequest) {
    // At the time of writing, all events cause the "normal" flow of execution to be interrupted.
    // So we'll return false when there have been no events whatsoever.
    if (events.length === 0) {
      return { terminate: false, quoteRequest, headers }
    }

    const { INVALID_QUOTE_REQUEST, INTERCEPT_QUOTE } = RulesEngine.events

    const unhandledEvents = events.filter(ev => !(ev.type in RulesEngine.events))

    if (unhandledEvents.length > 0) {
      // The rules configuration contains events not handled in the code
      // TODO: validate supplied rules at startup and fail if any invalid rules are discovered.
      throw new Error('Unhandled event returned by rules engine')
    }

    const invalidQuoteRequestEvents = events.filter(ev => ev.type === INVALID_QUOTE_REQUEST)
    if (invalidQuoteRequestEvents.length > 0) {
      // Use the first event, ignore the others for now. This is ergonomically worse for someone
      // developing against this service, as they can't see all reasons their quote was invalid at
      // once. But is a valid solution in the short-term.
      const { FSPIOPError: code, message } = invalidQuoteRequestEvents[0].params
      // Will throw an internal server error if property doesn't exist
      throw ErrorHandler.CreateFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes[code],
        message, null, headers['fspiop-source'])
    }

    const interceptQuoteEvents = events.filter(ev => ev.type === INTERCEPT_QUOTE)
    if (interceptQuoteEvents.length > 1) {
      // TODO: handle priority. Can we stream events?
      throw new Error('Multiple intercept quote events received')
    }
    if (interceptQuoteEvents.length > 0) {
      // send the quote request to the recipient in the event
      const result = {
        terminate: false,
        quoteRequest,
        headers: {
          ...headers,
          'fspiop-destination': interceptQuoteEvents[0].params.rerouteToFsp
        }
      }
      // if additionalHeaders are present then add the additional non-standard headers (e.g. used by forex)
      // Note these headers are not part of the mojaloop specification
      if (interceptQuoteEvents[0].params.additionalHeaders) {
        result.headers = { ...result.headers, ...interceptQuoteEvents[0].params.additionalHeaders }
        result.additionalHeaders = interceptQuoteEvents[0].params.additionalHeaders
      }
      return result
    }
  }

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
    const envConfig = new Config()
    // note that the framework should validate the form of the request
    // here we can do some hard-coded rule validations to ensure requests
    // do not lead to unsupported scenarios or use-cases.

    // This validation is being removed because it prevents the switch from supporting PAYEE initiated use cases
    // if (quoteRequest.transactionType.initiator !== 'PAYER') {
    //   throw ErrorHandler.CreateFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.NOT_IMPLEMENTED, 'Only PAYER initiated transactions are supported', null, fspiopSource)
    // }

    // Any quoteRequest specific validations to be added here
    if (!quoteRequest) {
      // internal-error
      histTimer({ success: false, queryName: 'quote_validateQuoteRequest' })
      throw ErrorHandler.CreateInternalServerFSPIOPError('Missing quoteRequest', null, fspiopSource)
    }

    await this.db.getParticipant(fspiopSource, LOCAL_ENUM.PAYER_DFSP, quoteRequest.amount.currency, ENUM.Accounts.LedgerAccountType.POSITION)
    await this.db.getParticipant(fspiopDestination, LOCAL_ENUM.PAYEE_DFSP, quoteRequest.amount.currency, ENUM.Accounts.LedgerAccountType.POSITION)
    histTimer({ success: true, queryName: 'quote_validateQuoteRequest' })

    // Following is the validation to make sure valid fsp's are used in the payload for simple routing mode
    if (envConfig.simpleRoutingMode) {
      // Lets make sure the optional fspId exists in the payer's partyIdInfo before we validate it
      if (
        quoteRequest.payer &&
        quoteRequest.payer.partyIdInfo &&
        quoteRequest.payer.partyIdInfo.fspId &&
        quoteRequest.payer.partyIdInfo.fspId !== fspiopSource
      ) {
        await this.db.getParticipant(quoteRequest.payer.partyIdInfo.fspId, LOCAL_ENUM.PAYER_DFSP, quoteRequest.amount.currency, ENUM.Accounts.LedgerAccountType.POSITION)
      }
      // Lets make sure the optional fspId exists in the payee's partyIdInfo before we validate it
      if (
        quoteRequest.payee &&
        quoteRequest.payee.partyIdInfo &&
        quoteRequest.payee.partyIdInfo.fspId &&
        quoteRequest.payee.partyIdInfo.fspId !== fspiopDestination
      ) {
        await this.db.getParticipant(quoteRequest.payee.partyIdInfo.fspId, LOCAL_ENUM.PAYEE_DFSP, quoteRequest.amount.currency, ENUM.Accounts.LedgerAccountType.POSITION)
      }
    }
  }

  /**
   * Validates the form of a quote update object
   *
   * @returns {promise} - promise will reject if request is not valid
   */
  async validateQuoteUpdate () {
    // todo: actually do the validation (use joi as per mojaloop)
    return Promise.resolve(null)
  }

  /**
   * Logic for creating and handling quote requests
   *
   * @returns {object} - returns object containing keys for created database entities
   */
  async handleQuoteRequest (headers, quoteRequest, span, cache) {
    const histTimer = Metrics.getHistogram(
      'model_quote',
      'handleQuoteRequest - Metrics for quote model',
      ['success', 'queryName', 'duplicateResult']
    ).startTimer()
    const envConfig = new Config()
    // accumulate enum ids
    const refs = {}

    let txn
    let handledRuleEvents
    let fspiopSource
    const handleQuoteRequestSpan = span.getChild('qs_quote_handleQuoteRequest')
    try {
      fspiopSource = headers[ENUM.Http.Headers.FSPIOP.SOURCE]
      const fspiopDestination = headers[ENUM.Http.Headers.FSPIOP.DESTINATION]

      // validate - this will throw if the request is invalid
      await this.validateQuoteRequest(fspiopSource, fspiopDestination, quoteRequest)

      const { payer, payee } = await fetchParticipantInfo(fspiopSource, fspiopDestination, cache)
      this.writeLog(`Got payer ${payer} and payee ${payee}`)

      // Run the rules engine. If the user does not want to run the rules engine, they need only to
      // supply a rules file containing an empty array.
      const events = await this.executeRules(headers, quoteRequest, payer, payee)

      handledRuleEvents = await this.handleRuleEvents(events, headers, quoteRequest)

      if (handledRuleEvents.terminate) {
        return
      }

      if (!envConfig.simpleRoutingMode) {
        // check if this is a resend or an erroneous duplicate
        const dupe = await this.checkDuplicateQuoteRequest(quoteRequest)

        this.writeLog(`Check duplicate for quoteId ${quoteRequest.quoteId} returned: ${util.inspect(dupe)}`)

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
          return this.handleQuoteRequestResend(handledRuleEvents.headers,
            handledRuleEvents.quoteRequest, handleQuoteRequestSpan, handledRuleEvents.additionalHeaders)
        }

        // todo: validation

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
          this.db.getParticipantByName(quoteRequest.payer.partyIdInfo.fspId),
          this.db.getTransferParticipantRoleType(LOCAL_ENUM.PAYER_DFSP),
          this.db.getLedgerEntryType(LOCAL_ENUM.PRINCIPLE_VALUE),
          this.db.getPartyType(LOCAL_ENUM.PAYEE),
          this.db.getPartyIdentifierType(quoteRequest.payee.partyIdInfo.partyIdType),
          this.db.getParticipantByName(quoteRequest.payee.partyIdInfo.fspId),
          this.db.getTransferParticipantRoleType(LOCAL_ENUM.PAYEE_DFSP),
          this.db.getLedgerEntryType(LOCAL_ENUM.PRINCIPLE_VALUE)
        ])

        if (quoteRequest.transactionType.subScenario) {
          // a sub scenario is specified, we need to look it up
          refs.transactionSubScenarioId = await this.db.getSubScenario(quoteRequest.transactionType.subScenario)
        }

        // if we get here we need to create a duplicate check row
        const hash = calculateRequestHash(quoteRequest)

        // do everything in a db txn so we can rollback multiple operations if something goes wrong
        txn = await this.db.newTransaction()
        await this.db.createQuoteDuplicateCheck(txn, quoteRequest.quoteId, hash)

        // create a txn reference
        this.writeLog(`Creating transactionReference for quoteId: ${quoteRequest.quoteId} and transactionId: ${quoteRequest.transactionId}`)
        refs.transactionReferenceId = await this.db.createTransactionReference(txn,
          quoteRequest.quoteId, quoteRequest.transactionId)
        this.writeLog(`transactionReference created transactionReferenceId: ${refs.transactionReferenceId}`)

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
        if (quoteRequest.extensionList &&
          Array.isArray(quoteRequest.extensionList.extension)) {
          refs.extensions = await this.db.createQuoteExtensions(
            txn, quoteRequest.extensionList.extension, quoteRequest.quoteId, quoteRequest.transactionId)
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
        this.writeLog(`create quote transaction committed to db: ${util.inspect(refs)}`)
      }

      // if we got here rules passed, so we can forward the quote on to the recipient dfsp
    } catch (err) {
      // internal-error
      this.writeLog(`Error in handleQuoteRequest for quoteId ${quoteRequest.quoteId}: ${getStackOrInspect(err)}`)
      if (txn) {
        txn.rollback(err)
      }

      const fspiopError = ErrorHandler.ReformatFSPIOPError(err)
      const state = new EventSdk.EventStateMetadata(EventSdk.EventStatusType.failed, fspiopError.apiErrorCode.code, fspiopError.apiErrorCode.message)
      await this.handleException(fspiopSource, quoteRequest.quoteId, fspiopError, headers, handleQuoteRequestSpan)
      if (handleQuoteRequestSpan) {
        await handleQuoteRequestSpan.error(fspiopError, state)
        await handleQuoteRequestSpan.finish(fspiopError.message, state)
      }
      histTimer({ success: false, queryName: 'quote_handleQuoteRequest' })
      throw fspiopError // think, if we need to throw error here?
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
      this.writeLog(`Error forwarding quote request: ${getStackOrInspect(err)}. Attempting to send error callback to ${fspiopSource}`)
      histTimer({ success: false, queryName: 'quote_handleQuoteRequest' })
      if (envConfig.simpleRoutingMode) {
        await this.handleException(fspiopSource, quoteRequest.quoteId, err, headers, forwardQuoteRequestSpan)
      } else {
        await this.handleException(fspiopSource, refs.quoteId, err, headers, forwardQuoteRequestSpan)
      }
    } finally {
      if (!forwardQuoteRequestSpan.isFinished) {
        await forwardQuoteRequestSpan.finish()
      }
      if (!handleQuoteRequestSpan.isFinished) {
        await handleQuoteRequestSpan.finish()
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
  async forwardQuoteRequest (headers, quoteId, originalQuoteRequest, span, additionalHeaders) {
    const histTimer = Metrics.getHistogram(
      'model_quote',
      'forwardQuoteRequest - Metrics for quote model',
      ['success', 'queryName', 'duplicateResult']
    ).startTimer()
    let endpoint
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
      endpoint = await this.db.getParticipantEndpoint(fspiopDest, 'FSPIOP_CALLBACK_URL_QUOTES')

      this.writeLog(`Resolved PAYEE party FSPIOP_CALLBACK_URL_QUOTES endpoint for quote ${quoteId} to: ${endpoint}, destination: ${fspiopDest}`)

      if (!endpoint) {
        // internal-error
        // we didnt get an endpoint for the payee dfsp!
        // make an error callback to the initiator
        throw ErrorHandler.CreateFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.DESTINATION_FSP_ERROR, `No FSPIOP_CALLBACK_URL_QUOTES found for quote ${quoteId} PAYEE party`, null, fspiopSource)
      }

      const fullCallbackUrl = `${endpoint}/quotes`
      const newHeaders = generateRequestHeaders(headers, this.db.config.protocolVersions, false, additionalHeaders)

      this.writeLog(`Forwarding quote request to endpoint: ${fullCallbackUrl}`)
      this.writeLog(`Forwarding quote request headers: ${JSON.stringify(newHeaders)}`)
      this.writeLog(`Forwarding quote request body: ${JSON.stringify(originalQuoteRequest)}`)

      let opts = {
        method: ENUM.Http.RestMethods.POST,
        url: fullCallbackUrl,
        data: JSON.stringify(originalQuoteRequest),
        headers: newHeaders
      }

      if (span) {
        opts = span.injectContextToHttpRequest(opts)
        span.audit(opts, EventSdk.AuditEventAction.egress)
      }

      this.writeLog(`Forwarding request : ${util.inspect(opts)}`)
      histTimer({ success: true, queryName: 'quote_forwardQuoteRequest' })
      await httpRequest(opts, fspiopSource)
    } catch (err) {
      // any-error
      this.writeLog(`Error forwarding quote request to endpoint ${endpoint}: ${getStackOrInspect(err)}`)
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
    try {
      const fspiopSource = headers[ENUM.Http.Headers.FSPIOP.SOURCE]
      this.writeLog(`Handling resend of quoteRequest: ${util.inspect(quoteRequest)} from ${fspiopSource} to ${headers[ENUM.Http.Headers.FSPIOP.DESTINATION]}`)

      // we are ok to assume the quoteRequest object passed to us is the same as the original...
      // as it passed a hash duplicate check...so go ahead and use it to resend rather than
      // hit the db again

      // if we got here rules passed, so we can forward the quote on to the recipient dfsp
      const childSpan = span.getChild('qs_quote_forwardQuoteRequestResend')
      try {
        await childSpan.audit({ headers, payload: quoteRequest }, EventSdk.AuditEventAction.start)
        histTimer({ success: true, queryName: 'quote_handleQuoteRequestResend' })
        await this.forwardQuoteRequest(headers, quoteRequest.quoteId, quoteRequest, childSpan, additionalHeaders)
      } catch (err) {
        // any-error
        // as we are on our own in this context, dont just rethrow the error, instead...
        // get the model to handle it
        this.writeLog(`Error forwarding quote request: ${getStackOrInspect(err)}. Attempting to send error callback to ${fspiopSource}`)
        const fspiopError = ErrorHandler.ReformatFSPIOPError(err)
        histTimer({ success: false, queryName: 'quote_handleQuoteRequestResend' })
        await this.handleException(fspiopSource, quoteRequest.quoteId, fspiopError, headers, childSpan)
      } finally {
        if (!childSpan.isFinished) {
          await childSpan.finish()
        }
      }
    } catch (err) {
      // internal-error
      this.writeLog(`Error in handleQuoteRequestResend: ${getStackOrInspect(err)}`)
      histTimer({ success: false, queryName: 'quote_handleQuoteRequestResend' })
      throw ErrorHandler.ReformatFSPIOPError(err)
    }
  }

  /**
   * Logic for handling quote update requests e.g. PUT /quotes/{id} requests
   *
   * @returns {object} - object containing updated entities
   */
  async handleQuoteUpdate (headers, quoteId, quoteUpdateRequest, span) {
    const histTimer = Metrics.getHistogram(
      'model_quote',
      'handleQuoteUpdate - Metrics for quote model',
      ['success', 'queryName', 'duplicateResult']
    ).startTimer()
    let txn = null
    let payeeParty = null
    const fspiopSource = headers[ENUM.Http.Headers.FSPIOP.SOURCE]
    const envConfig = new Config()
    const handleQuoteUpdateSpan = span.getChild('qs_quote_handleQuoteUpdate')
    try {
      // ensure no 'accept' header is present in the request headers.
      if ('accept' in headers) {
        // internal-error
        throw ErrorHandler.CreateFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.VALIDATION_ERROR,
          `Update for quote ${quoteId} failed: "accept" header should not be sent in callbacks.`, null, headers['fspiop-source'])
      }

      // accumulate enum ids
      const refs = {}
      if (!envConfig.simpleRoutingMode) {
        // check if this is a resend or an erroneous duplicate
        const dupe = await this.checkDuplicateQuoteResponse(quoteId, quoteUpdateRequest)
        this.writeLog(`Check duplicate for quoteId ${quoteId} update returned: ${util.inspect(dupe)}`)

        // fail fast on duplicate
        if (dupe.isDuplicateId && (!dupe.isResend)) {
          // internal-error
          // same quoteId but a different request, this is an error!
          throw ErrorHandler.CreateFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.MODIFIED_REQUEST, `Update for quote ${quoteUpdateRequest.quoteId} is a duplicate but hashes dont match`, null, fspiopSource)
        }

        if (dupe.isResend && dupe.isDuplicateId) {
          // this is a resend
          // See section 3.2.5.1 in "API Definition v1.0.docx" API specification document.
          histTimer({ success: true, queryName: 'quote_handleQuoteUpdate' })
          return this.handleQuoteUpdateResend(headers, quoteId, quoteUpdateRequest, handleQuoteUpdateSpan)
        }

        if (quoteUpdateRequest.geoCode) {
          payeeParty = await this.db.getQuoteParty(quoteId, 'PAYEE')

          if (!payeeParty) {
            // internal-error
            throw ErrorHandler.CreateFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.PARTY_NOT_FOUND, `Unable to find payee party for quote ${quoteId}`, null, fspiopSource)
          }
        }

        // do everything in a transaction so we can rollback multiple operations if something goes wrong
        txn = await this.db.newTransaction()

        // todo: validation

        // create the quote response row in the db
        const newQuoteResponse = await this.db.createQuoteResponse(txn, quoteId, {
          transferAmount: quoteUpdateRequest.transferAmount,
          payeeReceiveAmount: quoteUpdateRequest.payeeReceiveAmount,
          payeeFspFee: quoteUpdateRequest.payeeFspFee,
          payeeFspCommission: quoteUpdateRequest.payeeFspCommission,
          condition: quoteUpdateRequest.condition,
          expiration: quoteUpdateRequest.expiration ? new Date(quoteUpdateRequest.expiration) : null,
          isValid: 1 // assume the request is valid if we passed validation and duplicate checks etc...
        })

        refs.quoteResponseId = newQuoteResponse.quoteResponseId

        // if we get here we need to create a duplicate check row
        const hash = calculateRequestHash(quoteUpdateRequest)
        await this.db.createQuoteUpdateDuplicateCheck(txn, quoteId, refs.quoteResponseId, hash)

        // create ilp packet in the db
        await this.db.createQuoteResponseIlpPacket(txn, refs.quoteResponseId,
          quoteUpdateRequest.ilpPacket)

        // did we get a geoCode for the payee?
        if (quoteUpdateRequest.geoCode) {
          refs.geoCodeId = await this.db.createGeoCode(txn, {
            quotePartyId: payeeParty.quotePartyId,
            latitude: quoteUpdateRequest.geoCode.latitude,
            longitude: quoteUpdateRequest.geoCode.longitude
          })
        }

        // store any extension list items
        if (quoteUpdateRequest.extensionList &&
             Array.isArray(quoteUpdateRequest.extensionList.extension)) {
          refs.extensions = await this.db.createQuoteExtensions(
            txn, quoteUpdateRequest.extensionList.extension, quoteId, null, refs.quoteResponseId)
        }

        // todo: create any additional quoteParties e.g. for fees, comission etc...

        await txn.commit()
        this.writeLog(`create quote update transaction committed to db: ${util.inspect(refs)}`)

        /// if we got here, all entities have been created in db correctly to record the quote request

        // check quote response rules
        // let test = { ...quoteUpdateRequest };

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
        await childSpan.audit({ headers, params: { quoteId }, payload: quoteUpdateRequest }, EventSdk.AuditEventAction.start)
        histTimer({ success: true, queryName: 'quote_handleQuoteUpdate' })
        await this.forwardQuoteUpdate(headers, quoteId, quoteUpdateRequest, childSpan)
      } catch (err) {
        // any-error
        // as we are on our own in this context, dont just rethrow the error, instead...
        // get the model to handle it
        const fspiopSource = headers[ENUM.Http.Headers.FSPIOP.SOURCE]
        this.writeLog(`Error forwarding quote update: ${getStackOrInspect(err)}. Attempting to send error callback to ${fspiopSource}`)
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
      this.writeLog(`Error in handleQuoteUpdate: ${getStackOrInspect(err)}`)
      if (txn) {
        txn.rollback(err)
      }
      const fspiopError = ErrorHandler.ReformatFSPIOPError(err)
      const state = new EventSdk.EventStateMetadata(EventSdk.EventStatusType.failed, fspiopError.apiErrorCode.code, fspiopError.apiErrorCode.message)
      await this.handleException(fspiopSource, quoteId, err, headers, handleQuoteUpdateSpan)
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
    let endpoint = null
    const fspiopSource = headers[ENUM.Http.Headers.FSPIOP.SOURCE]
    const fspiopDest = headers[ENUM.Http.Headers.FSPIOP.DESTINATION]

    try {
      if (!originalQuoteResponse) {
        // we need to recreate the quote response
        // internal-error
        throw ErrorHandler.CreateInternalServerFSPIOPError('No quote response to forward', null, fspiopSource)
      }

      // lookup payer dfsp callback endpoint
      endpoint = await this.db.getParticipantEndpoint(fspiopDest, 'FSPIOP_CALLBACK_URL_QUOTES')

      this.writeLog(`Resolved PAYER party FSPIOP_CALLBACK_URL_QUOTES endpoint for quote ${quoteId} to: ${util.inspect(endpoint)}`)

      if (!endpoint) {
        // we didnt get an endpoint for the payee dfsp!
        // make an error callback to the initiator
        const fspiopError = ErrorHandler.CreateFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.DESTINATION_FSP_ERROR, `No FSPIOP_CALLBACK_URL_QUOTES found for quote ${quoteId} PAYER party`, null, fspiopSource)
        return this.sendErrorCallback(fspiopSource, fspiopError, quoteId, headers, true)
      }

      const fullCallbackUrl = `${endpoint}/quotes/${quoteId}`
      // we need to strip off the 'accept' header
      // for all PUT requests as per the API Specification Document
      // https://github.com/mojaloop/mojaloop-specification/blob/main/documents/v1.1-document-set/fspiop-v1.1-openapi2.yaml
      const newHeaders = generateRequestHeaders(headers, this.db.config.protocolVersions, true)

      this.writeLog(`Forwarding quote response to endpoint: ${fullCallbackUrl}`)
      this.writeLog(`Forwarding quote response headers: ${JSON.stringify(newHeaders)}`)
      this.writeLog(`Forwarding quote response body: ${JSON.stringify(originalQuoteResponse)}`)

      let opts = {
        method: ENUM.Http.RestMethods.PUT,
        url: fullCallbackUrl,
        data: JSON.stringify(originalQuoteResponse),
        headers: newHeaders
      }

      if (span) {
        opts = span.injectContextToHttpRequest(opts)
        span.audit(opts, EventSdk.AuditEventAction.egress)
      }
      histTimer({ success: true, queryName: 'quote_forwardQuoteUpdate' })
      await httpRequest(opts, fspiopSource)
    } catch (err) {
      // any-error
      this.writeLog(`Error forwarding quote response to endpoint ${endpoint}: ${getStackOrInspect(err)}`)
      histTimer({ success: false, queryName: 'quote_forwardQuoteUpdate' })
      throw ErrorHandler.ReformatFSPIOPError(err)
    }
  }

  /**
   * Deals with resends of quote responses (PUT) under the API spec:
   * See section 3.2.5.1, 9.4 and 9.5 in "API Definition v1.0.docx" API specification document.
   */
  async handleQuoteUpdateResend (headers, quoteId, quoteUpdate, span) {
    const histTimer = Metrics.getHistogram(
      'model_quote',
      'handleQuoteUpdateResend - Metrics for quote model',
      ['success', 'queryName', 'duplicateResult']
    ).startTimer()
    try {
      const fspiopSource = headers[ENUM.Http.Headers.FSPIOP.SOURCE]
      const fspiopDest = headers[ENUM.Http.Headers.FSPIOP.DESTINATION]
      this.writeLog(`Handling resend of quoteUpdate: ${util.inspect(quoteUpdate)} from ${fspiopSource} to ${fspiopDest}`)

      // we are ok to assume the quoteUpdate object passed to us is the same as the original...
      // as it passed a hash duplicate check...so go ahead and use it to resend rather than
      // hit the db again

      // if we got here rules passed, so we can forward the quote on to the recipient dfsp
      const childSpan = span.getChild('qs_quote_forwardQuoteUpdateResend')
      try {
        await childSpan.audit({ headers, params: { quoteId }, payload: quoteUpdate }, EventSdk.AuditEventAction.start)
        histTimer({ success: true, queryName: 'quote_handleQuoteUpdateResend' })
        await this.forwardQuoteUpdate(headers, quoteId, quoteUpdate, childSpan)
      } catch (err) {
        // any-error
        // as we are on our own in this context, dont just rethrow the error, instead...
        // get the model to handle it
        this.writeLog(`Error forwarding quote response: ${getStackOrInspect(err)}. Attempting to send error callback to ${fspiopSource}`)
        histTimer({ success: false, queryName: 'quote_handleQuoteUpdateResend' })
        await this.handleException(fspiopSource, quoteId, err, headers, childSpan)
      } finally {
        if (!childSpan.isFinished) {
          await childSpan.finish()
        }
      }
    } catch (err) {
      // internal-error
      this.writeLog(`Error in handleQuoteUpdateResend: ${getStackOrInspect(err)}`)
      histTimer({ success: false, queryName: 'quote_handleQuoteUpdateResend' })
      throw ErrorHandler.ReformatFSPIOPError(err)
    }
  }

  /**
   * Handles error reports from clients e.g. POST quotes/{id}/error
   *
   * @returns {undefined}
   */
  async handleQuoteError (headers, quoteId, error, span) {
    const histTimer = Metrics.getHistogram(
      'model_quote',
      'handleQuoteError - Metrics for quote model',
      ['success', 'queryName', 'duplicateResult']
    ).startTimer()
    let txn = null
    const envConfig = new Config()
    let newError
    const childSpan = span.getChild('qs_quote_handleQuoteError')
    try {
      if (!envConfig.simpleRoutingMode) {
        // do everything in a transaction so we can rollback multiple operations if something goes wrong
        txn = await this.db.newTransaction()

        // persist the error
        newError = await this.db.createQuoteError(txn, {
          quoteId,
          errorCode: Number(error.errorCode),
          errorDescription: error.errorDescription
        })

        // commit the txn to the db
        txn.commit()
      }
      // create a new object to represent the error
      const fspiopError = ErrorHandler.CreateFSPIOPErrorFromErrorInformation(error)

      // Needed to add await here to prevent 'childSpan already finished' bug
      histTimer({ success: true, queryName: 'quote_handleQuoteError' })
      await this.sendErrorCallback(headers[ENUM.Http.Headers.FSPIOP.DESTINATION], fspiopError, quoteId, headers, childSpan, false)

      return newError
    } catch (err) {
      // internal-error
      this.writeLog(`Error in handleQuoteError: ${getStackOrInspect(err)}`)
      if (txn) {
        txn.rollback(err)
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
        this.writeLog(`Error forwarding quote get: ${getStackOrInspect(err)}. Attempting to send error callback to ${fspiopSource}`)
        histTimer({ success: false, queryName: 'quote_handleQuoteGet' })
        await this.handleException(fspiopSource, quoteId, err, headers, childSpan)
      } finally {
        if (!childSpan.isFinished) {
          await childSpan.finish()
        }
      }
    } catch (err) {
      // internal-error
      this.writeLog(`Error in handleQuoteGet: ${getStackOrInspect(err)}`)
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
    let endpoint

    try {
      // we just need to forward this request on to the destination dfsp. they should response with a
      // quote update resend (PUT)

      // lookup payee dfsp callback endpoint
      // todo: for MVP we assume initiator is always payer dfsp! this may not always be the case if a xfer is requested by payee
      const fspiopSource = headers[ENUM.Http.Headers.FSPIOP.SOURCE]
      const fspiopDest = headers[ENUM.Http.Headers.FSPIOP.DESTINATION]
      endpoint = await this.db.getParticipantEndpoint(fspiopDest, 'FSPIOP_CALLBACK_URL_QUOTES')

      this.writeLog(`Resolved ${fspiopDest} FSPIOP_CALLBACK_URL_QUOTES endpoint for quote GET ${quoteId} to: ${util.inspect(endpoint)}`)

      if (!endpoint) {
        // we didnt get an endpoint for the payee dfsp!
        // make an error callback to the initiator
        // internal-error
        throw ErrorHandler.CreateFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.DESTINATION_FSP_ERROR, `No FSPIOP_CALLBACK_URL_QUOTES found for quote GET ${quoteId}`, null, fspiopSource)
      }

      const fullCallbackUrl = `${endpoint}/quotes/${quoteId}`
      const newHeaders = generateRequestHeaders(headers, this.db.config.protocolVersions)

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

      histTimer({ success: true, queryName: 'quote_forwardQuoteGet' })
      await httpRequest(opts, fspiopSource)
    } catch (err) {
      // any-error
      this.writeLog(`Error forwarding quote get request: ${getStackOrInspect(err)}`)
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
    // is this exception already wrapped as an API spec compatible type?
    const fspiopError = ErrorHandler.ReformatFSPIOPError(error)

    const childSpan = span.getChild('qs_quote_sendErrorCallback')
    try {
      await childSpan.audit({ headers, params: { quoteId } }, EventSdk.AuditEventAction.start)
      histTimer({ success: true, queryName: 'quote_handleException' })
      return await this.sendErrorCallback(fspiopSource, fspiopError, quoteId, headers, childSpan, true)
    } catch (err) {
      // any-error
      // not much we can do other than log the error
      this.writeLog(`Error occurred while handling error. Check service logs as this error may not have been propagated successfully to any other party: ${getStackOrInspect(err)}`)
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
  async sendErrorCallback (fspiopSource, fspiopError, quoteId, headers, span, modifyHeaders = true) {
    const histTimer = Metrics.getHistogram(
      'model_quote',
      'sendErrorCallback - Metrics for quote model',
      ['success', 'queryName', 'duplicateResult']
    ).startTimer()
    const envConfig = new Config()
    const fspiopDest = headers[ENUM.Http.Headers.FSPIOP.DESTINATION]
    try {
      // look up the callback base url
      const endpoint = await this.db.getParticipantEndpoint(fspiopSource, 'FSPIOP_CALLBACK_URL_QUOTES')

      this.writeLog(`Resolved participant '${fspiopSource}' FSPIOP_CALLBACK_URL_QUOTES to: '${endpoint}'`)

      if (!endpoint) {
        // oops, we cant make an error callback if we dont have an endpoint to call!
        // internal-error
        throw ErrorHandler.CreateFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.PARTY_NOT_FOUND, `No FSPIOP_CALLBACK_URL_QUOTES found for ${fspiopSource} unable to make error callback`, null, fspiopSource)
      }

      const fspiopUri = `/quotes/${quoteId}/error`
      const fullCallbackUrl = `${endpoint}${fspiopUri}`

      // log the original error
      this.writeLog(`Making error callback to participant '${fspiopSource}' for quoteId '${quoteId}' to ${fullCallbackUrl} for error: ${util.inspect(fspiopError.toFullErrorObject())}`)

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
        formattedHeaders = generateRequestHeadersForJWS(fromSwitchHeaders, this.db.config.protocolVersions, true)
      } else {
        formattedHeaders = generateRequestHeaders(fromSwitchHeaders, this.db.config.protocolVersions, true)
      }

      let opts = {
        method: ENUM.Http.RestMethods.PUT,
        url: fullCallbackUrl,
        data: JSON.stringify(fspiopError.toApiErrorObject(envConfig.errorHandling), LibUtil.getCircularReplacer()),
        // use headers of the error object if they are there...
        // otherwise use sensible defaults
        headers: formattedHeaders
      }

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
          this.writeLog('Getting the JWS Signer to sign the switch generated message')
          const jwsSigner = new JwsSigner({
            logger: Logger,
            signingKey: envConfig.jws.jwsSigningKey
          })
          opts.headers['fspiop-signature'] = jwsSigner.getSignature(opts)
        }
        histTimer({ success: true, queryName: 'quote_sendErrorCallback' })
        res = await axios.request(opts)
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
      this.writeLog(`Error callback got response ${res.status} ${res.statusText}`)

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
      // any-error
      this.writeLog(`Error in sendErrorCallback: ${getStackOrInspect(err)}`)
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
    try {
      // calculate a SHA-256 of the request
      const hash = calculateRequestHash(quoteRequest)
      this.writeLog(`Calculated sha256 hash of quote request with id ${quoteRequest.quoteId} as: ${hash}`)

      const dupchk = await this.db.getQuoteDuplicateCheck(quoteRequest.quoteId)
      this.writeLog(`DB query for quote duplicate check with id ${quoteRequest.quoteId} returned: ${util.inspect(dupchk)}`)

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
      // internal-error
      this.writeLog(`Error in checkDuplicateQuoteRequest: ${getStackOrInspect(err)}`)
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
    try {
      // calculate a SHA-256 of the request
      const hash = calculateRequestHash(quoteResponse)
      this.writeLog(`Calculated sha256 hash of quote response with id ${quoteId} as: ${hash}`)

      const dupchk = await this.db.getQuoteResponseDuplicateCheck(quoteId)
      this.writeLog(`DB query for quote response duplicate check with id ${quoteId} returned: ${util.inspect(dupchk)}`)

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
      // internal-error
      this.writeLog(`Error in checkDuplicateQuoteResponse: ${getStackOrInspect(err)}`)
      histTimer({ success: false, queryName: 'quote_checkDuplicateQuoteResponse', duplicateResult: 'error' })
      throw ErrorHandler.ReformatFSPIOPError(err)
    }
  }

  /**
   * Writes a formatted message to the console
   *
   * @returns {undefined}
   */
  // eslint-disable-next-line no-unused-vars
  writeLog (message) {
    Logger.isDebugEnabled && Logger.debug(`${new Date().toISOString()}, (${this.requestId}) [quotesmodel]: ${message}`)
  }
}

module.exports = QuotesModel
