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
 --------------
 ******/

const axios = require('axios')
const crypto = require('crypto')
const util = require('util')

const ENUM = require('@mojaloop/central-services-shared').Enum
const ErrorHandler = require('@mojaloop/central-services-error-handling')
const EventSdk = require('@mojaloop/event-sdk')
const LibUtil = require('@mojaloop/central-services-shared').Util
const Logger = require('@mojaloop/central-services-logger')
const MLNumber = require('@mojaloop/ml-number')
const JwsSigner = require('@mojaloop/sdk-standard-components').Jws.signer

const Config = require('../lib/config')
const { httpRequest } = require('../lib/http')
const { getStackOrInspect } = require('../lib/util')
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

  async executeRules (headers, quoteRequest) {
    if (rules.length === 0) {
      return []
    }

    // Collect facts to supply to the rule engine
    // Get quote participants from central ledger admin
    const { switchEndpoint } = new Config()
    const url = `${switchEndpoint}/participants`
    const [payer, payee] = await Promise.all([
      axios.request({ url: `${url}/${headers['fspiop-source']}` }),
      axios.request({ url: `${url}/${headers['fspiop-destination']}` })
    ])

    this.writeLog(`Got rules engine facts payer ${payer} and payee ${payee}`)

    const facts = {
      payer,
      payee,
      payload: quoteRequest,
      headers
    }

    const { events } = await RulesEngine.run(rules, facts)

    this.writeLog(`Rules engine returned events ${events}`)

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
      return {
        terminate: false,
        quoteRequest,
        headers: {
          ...headers,
          'fspiop-destination': interceptQuoteEvents[0].params.rerouteToFsp
        }
      }
    }
  }

  /**
   * Validates the quote request object
   *
   * @returns {promise} - promise will reject if request is not valid
   */
  async validateQuoteRequest (fspiopSource, fspiopDestination, quoteRequest) {
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
      throw ErrorHandler.CreateInternalServerFSPIOPError('Missing quoteRequest', null, fspiopSource)
    }

    await this.db.getParticipant(fspiopSource, LOCAL_ENUM.PAYER_DFSP)
    await this.db.getParticipant(fspiopDestination, LOCAL_ENUM.PAYEE_DFSP)
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
  async handleQuoteRequest (headers, quoteRequest, span) {
    const envConfig = new Config()
    // accumulate enum ids
    const refs = {}

    let txn
    let handledRuleEvents
    let fspiopSource
    let childSpan

    try {
      fspiopSource = headers[ENUM.Http.Headers.FSPIOP.SOURCE]
      const fspiopDestination = headers[ENUM.Http.Headers.FSPIOP.DESTINATION]

      // Run the rules engine. If the user does not want to run the rules engine, they need only to
      // supply a rules file containing an empty array.
      const events = await this.executeRules(headers, quoteRequest)

      handledRuleEvents = await this.handleRuleEvents(events, headers, quoteRequest)

      if (handledRuleEvents.terminate) {
        return
      }

      // validate - this will throw if the request is invalid
      await this.validateQuoteRequest(fspiopSource, fspiopDestination, quoteRequest)

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
            handledRuleEvents.quoteRequest, span)
        }

        // do everything in a db txn so we can rollback multiple operations if something goes wrong
        txn = await this.db.newTransaction()

        // todo: validation

        // if we get here we need to create a duplicate check row
        const hash = this.calculateRequestHash(quoteRequest)
        await this.db.createQuoteDuplicateCheck(txn, quoteRequest.quoteId, hash)

        // create a txn reference
        refs.transactionReferenceId = await this.db.createTransactionReference(txn,
          quoteRequest.quoteId, quoteRequest.transactionId)

        // get the initiator type
        refs.transactionInitiatorTypeId = await this.db.getInitiatorType(quoteRequest.transactionType.initiatorType)

        // get the initiator
        refs.transactionInitiatorId = await this.db.getInitiator(quoteRequest.transactionType.initiator)

        // get the txn scenario id
        refs.transactionScenarioId = await this.db.getScenario(quoteRequest.transactionType.scenario)

        if (quoteRequest.transactionType.subScenario) {
          // a sub scenario is specified, we need to look it up
          refs.transactionSubScenarioId = await this.db.getSubScenario(quoteRequest.transactionType.subScenario)
        }

        // get amount type
        refs.amountTypeId = await this.db.getAmountType(quoteRequest.amountType)

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

        // eslint-disable-next-line require-atomic-updates
        refs.payerId = await this.db.createPayerQuoteParty(txn, refs.quoteId, quoteRequest.payer,
          quoteRequest.amount.amount, quoteRequest.amount.currency)

        // eslint-disable-next-line require-atomic-updates
        refs.payeeId = await this.db.createPayeeQuoteParty(txn, refs.quoteId, quoteRequest.payee,
          quoteRequest.amount.amount, quoteRequest.amount.currency)

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
      childSpan = span.getChild('qs_quote_forwardQuoteRequest')
    } catch (err) {
      // internal-error
      this.writeLog(`Error in handleQuoteRequest for quoteId ${quoteRequest.quoteId}: ${getStackOrInspect(err)}`)
      if (txn) {
        txn.rollback(err)
      }

      const fspiopError = ErrorHandler.ReformatFSPIOPError(err)
      const state = new EventSdk.EventStateMetadata(EventSdk.EventStatusType.failed, fspiopError.apiErrorCode.code, fspiopError.apiErrorCode.message)
      if (span) {
        await span.error(fspiopError, state)
        await span.finish(fspiopError.message, state)
      }

      throw fspiopError
    }

    try {
      if (envConfig.simpleRoutingMode) {
        await childSpan.audit({ headers, payload: quoteRequest }, EventSdk.AuditEventAction.start)
        await this.forwardQuoteRequest(handledRuleEvents.headers, quoteRequest.quoteId, handledRuleEvents.quoteRequest, childSpan)
      } else {
        await childSpan.audit({ headers, payload: refs }, EventSdk.AuditEventAction.start)
        await this.forwardQuoteRequest(handledRuleEvents.headers, refs.quoteId, handledRuleEvents.quoteRequest, childSpan)
      }
    } catch (err) {
      // any-error
      // as we are on our own in this context, dont just rethrow the error, instead...
      // get the model to handle it
      this.writeLog(`Error forwarding quote request: ${getStackOrInspect(err)}. Attempting to send error callback to ${fspiopSource}`)
      if (envConfig.simpleRoutingMode) {
        await this.handleException(fspiopSource, quoteRequest.quoteId, err, headers, childSpan)
      } else {
        await this.handleException(fspiopSource, refs.quoteId, err, headers, childSpan)
      }
    } finally {
      if (!childSpan.isFinished) {
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
  async forwardQuoteRequest (headers, quoteId, originalQuoteRequest, span) {
    let endpoint
    const fspiopSource = headers[ENUM.Http.Headers.FSPIOP.SOURCE]
    const fspiopDest = headers[ENUM.Http.Headers.FSPIOP.DESTINATION]
    const envConfig = new Config()

    try {
      if (!originalQuoteRequest) {
        // internal-error
        throw ErrorHandler.CreateInternalServerFSPIOPError('No quote request to forward', null, fspiopSource)
      }

      // lookup payee dfsp callback endpoint
      // TODO: for MVP we assume initiator is always payer dfsp! this may not always be the
      // case if a xfer is requested by payee
      if (envConfig.simpleRoutingMode) {
        endpoint = await this.db.getParticipantEndpoint(fspiopDest, 'FSPIOP_CALLBACK_URL_QUOTES')
      } else {
        endpoint = await this.db.getQuotePartyEndpoint(quoteId, 'FSPIOP_CALLBACK_URL_QUOTES', 'PAYEE')
      }

      this.writeLog(`Resolved PAYEE party FSPIOP_CALLBACK_URL_QUOTES endpoint for quote ${quoteId} to: ${util.inspect(endpoint)}`)

      if (!endpoint) {
        // internal-error
        // we didnt get an endpoint for the payee dfsp!
        // make an error callback to the initiator
        throw ErrorHandler.CreateFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.DESTINATION_FSP_ERROR, `No FSPIOP_CALLBACK_URL_QUOTES found for quote ${quoteId} PAYEE party`, null, fspiopSource)
      }

      const fullCallbackUrl = `${endpoint}/quotes`
      const newHeaders = this.generateRequestHeaders(headers)

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
      await httpRequest(opts, fspiopSource)
    } catch (err) {
      // any-error
      this.writeLog(`Error forwarding quote request to endpoint ${endpoint}: ${getStackOrInspect(err)}`)
      throw ErrorHandler.ReformatFSPIOPError(err)
    }
  }

  /**
   * Deals with resends of quote requests (POST) under the API spec:
   * See section 3.2.5.1, 9.4 and 9.5 in "API Definition v1.0.docx" API specification document.
   */
  async handleQuoteRequestResend (headers, quoteRequest, span) {
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
        await this.forwardQuoteRequest(headers, quoteRequest.quoteId, quoteRequest, childSpan)
      } catch (err) {
        // any-error
        // as we are on our own in this context, dont just rethrow the error, instead...
        // get the model to handle it
        this.writeLog(`Error forwarding quote request: ${getStackOrInspect(err)}. Attempting to send error callback to ${fspiopSource}`)
        const fspiopError = ErrorHandler.ReformatFSPIOPError(err)
        await this.handleException(fspiopSource, quoteRequest.quoteId, fspiopError, headers, childSpan)
      } finally {
        if (!childSpan.isFinished) {
          await childSpan.finish()
        }
      }
    } catch (err) {
      // internal-error
      this.writeLog(`Error in handleQuoteRequestResend: ${getStackOrInspect(err)}`)
      throw ErrorHandler.ReformatFSPIOPError(err)
    }
  }

  /**
   * Logic for handling quote update requests e.g. PUT /quotes/{id} requests
   *
   * @returns {object} - object containing updated entities
   */
  async handleQuoteUpdate (headers, quoteId, quoteUpdateRequest, span) {
    let txn = null
    const fspiopSource = headers[ENUM.Http.Headers.FSPIOP.SOURCE]
    const envConfig = new Config()
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
          return this.handleQuoteUpdateResend(headers, quoteId, quoteUpdateRequest, span)
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
        const hash = this.calculateRequestHash(quoteUpdateRequest)
        await this.db.createQuoteUpdateDuplicateCheck(txn, quoteId, refs.quoteResponseId, hash)

        // create ilp packet in the db
        await this.db.createQuoteResponseIlpPacket(txn, refs.quoteResponseId,
          quoteUpdateRequest.ilpPacket)

        // did we get a geoCode for the payee?
        if (quoteUpdateRequest.geoCode) {
          const payeeParty = await this.db.getQuoteParty(quoteId, 'PAYEE')

          if (!payeeParty) {
            // internal-error
            throw ErrorHandler.CreateFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.PARTY_NOT_FOUND, `Unable to find payee party for quote ${quoteId}`, null, fspiopSource)
          }

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
      const childSpan = span.getChild('qs_quote_forwardQuoteUpdate')
      try {
        await childSpan.audit({ headers, params: { quoteId }, payload: quoteUpdateRequest }, EventSdk.AuditEventAction.start)
        await this.forwardQuoteUpdate(headers, quoteId, quoteUpdateRequest, childSpan)
      } catch (err) {
        // any-error
        // as we are on our own in this context, dont just rethrow the error, instead...
        // get the model to handle it
        const fspiopSource = headers[ENUM.Http.Headers.FSPIOP.SOURCE]
        this.writeLog(`Error forwarding quote update: ${getStackOrInspect(err)}. Attempting to send error callback to ${fspiopSource}`)
        await this.handleException(fspiopSource, quoteId, err, headers, childSpan)
      } finally {
        if (!childSpan.isFinished) {
          await childSpan.finish()
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
      if (span) {
        await span.error(fspiopError, state)
        await span.finish(fspiopError.message, state)
      }
      throw fspiopError
    }
  }

  /**
   * Forwards a quote response to a payer DFSP for processing
   *
   * @returns {undefined}
   */
  async forwardQuoteUpdate (headers, quoteId, originalQuoteResponse, span) {
    let endpoint = null
    const envConfig = new Config()
    const fspiopSource = headers[ENUM.Http.Headers.FSPIOP.SOURCE]
    const fspiopDest = headers[ENUM.Http.Headers.FSPIOP.DESTINATION]

    try {
      if (!originalQuoteResponse) {
        // we need to recreate the quote response
        // internal-error
        throw ErrorHandler.CreateInternalServerFSPIOPError('No quote response to forward', null, fspiopSource)
      }

      // lookup payer dfsp callback endpoint
      if (envConfig.simpleRoutingMode) {
        endpoint = await this.db.getParticipantEndpoint(fspiopDest, 'FSPIOP_CALLBACK_URL_QUOTES')
      } else {
        // todo: for MVP we assume initiator is always payer dfsp! this may not always be the case if a xfer is requested by payee
        endpoint = await this.db.getQuotePartyEndpoint(quoteId, 'FSPIOP_CALLBACK_URL_QUOTES', 'PAYER')
      }

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
      // https://github.com/mojaloop/mojaloop-specification/blob/master/API%20Definition%20v1.0.pdf
      const newHeaders = this.generateRequestHeaders(headers, true)

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

      await httpRequest(opts, fspiopSource)
    } catch (err) {
      // any-error
      this.writeLog(`Error forwarding quote response to endpoint ${endpoint}: ${getStackOrInspect(err)}`)
      throw ErrorHandler.ReformatFSPIOPError(err)
    }
  }

  /**
   * Deals with resends of quote responses (PUT) under the API spec:
   * See section 3.2.5.1, 9.4 and 9.5 in "API Definition v1.0.docx" API specification document.
   */
  async handleQuoteUpdateResend (headers, quoteId, quoteUpdate, span) {
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
        await this.forwardQuoteUpdate(headers, quoteId, quoteUpdate, childSpan)
      } catch (err) {
        // any-error
        // as we are on our own in this context, dont just rethrow the error, instead...
        // get the model to handle it
        this.writeLog(`Error forwarding quote response: ${getStackOrInspect(err)}. Attempting to send error callback to ${fspiopSource}`)
        await this.handleException(fspiopSource, quoteId, err, headers, childSpan)
      } finally {
        if (!childSpan.isFinished) {
          await childSpan.finish()
        }
      }
    } catch (err) {
      // internal-error
      this.writeLog(`Error in handleQuoteUpdateResend: ${getStackOrInspect(err)}`)
      throw ErrorHandler.ReformatFSPIOPError(err)
    }
  }

  /**
   * Handles error reports from clients e.g. POST quotes/{id}/error
   *
   * @returns {undefined}
   */
  async handleQuoteError (headers, quoteId, error, span) {
    let txn = null
    const envConfig = new Config()
    let newError
    try {
      if (!envConfig.simpleRoutingMode) {
        // do everything in a transaction so we can rollback multiple operations if something goes wrong
        txn = await this.db.newTransaction()

        // persist the error
        newError = await this.db.createQuoteError(txn, {
          quoteId: quoteId,
          errorCode: Number(error.errorCode),
          errorDescription: error.errorDescription
        })

        // commit the txn to the db
        txn.commit()
      }
      // create a new object to represent the error
      const fspiopError = ErrorHandler.CreateFSPIOPErrorFromErrorInformation(error)

      // Needed to add await here to prevent 'span already finished' bug
      await this.sendErrorCallback(headers[ENUM.Http.Headers.FSPIOP.DESTINATION], fspiopError, quoteId, headers, span, false)

      return newError
    } catch (err) {
      // internal-error
      this.writeLog(`Error in handleQuoteError: ${getStackOrInspect(err)}`)
      if (txn) {
        txn.rollback(err)
      }
      const fspiopError = ErrorHandler.ReformatFSPIOPError(err)
      const state = new EventSdk.EventStateMetadata(EventSdk.EventStatusType.failed, fspiopError.apiErrorCode.code, fspiopError.apiErrorCode.message)
      if (span) {
        await span.error(fspiopError, state)
        await span.finish(fspiopError.message, state)
      }
      throw fspiopError
    }
  }

  /**
   * Attempts to handle a quote GET request by forwarding it to the destination DFSP
   *
   * @returns {undefined}
   */
  async handleQuoteGet (headers, quoteId, span) {
    const fspiopSource = headers[ENUM.Http.Headers.FSPIOP.SOURCE]
    try {
      const childSpan = span.getChild('qs_quote_forwardQuoteGet')
      try {
        await childSpan.audit({ headers, params: { quoteId } }, EventSdk.AuditEventAction.start)
        await this.forwardQuoteGet(headers, quoteId, childSpan)
      } catch (err) {
        // any-error
        // as we are on our own in this context, dont just rethrow the error, instead...
        // get the model to handle it
        this.writeLog(`Error forwarding quote get: ${getStackOrInspect(err)}. Attempting to send error callback to ${fspiopSource}`)
        await this.handleException(fspiopSource, quoteId, err, headers, childSpan)
      } finally {
        if (!childSpan.isFinished) {
          await childSpan.finish()
        }
      }
    } catch (err) {
      // internal-error
      this.writeLog(`Error in handleQuoteGet: ${getStackOrInspect(err)}`)
      const fspiopError = ErrorHandler.ReformatFSPIOPError(err)
      const state = new EventSdk.EventStateMetadata(EventSdk.EventStatusType.failed, fspiopError.apiErrorCode.code, fspiopError.apiErrorCode.message)
      if (span) {
        await span.error(fspiopError, state)
        await span.finish(fspiopError.message, state)
      }
      throw fspiopError
    }
  }

  /**
   * Attempts to forward a quote GET request
   *
   * @returns {undefined}
   */
  async forwardQuoteGet (headers, quoteId, span) {
    let endpoint

    try {
      // we just need to forward this request on to the destinatin dfsp. they should response with a
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
      const newHeaders = this.generateRequestHeaders(headers)

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
      throw ErrorHandler.ReformatFSPIOPError(err)
    }
  }

  /**
   * Attempts to handle an exception in a sensible manner by forwarding it on to the
   * source of the request that caused the error.
   */
  async handleException (fspiopSource, quoteId, error, headers, span) {
    // is this exception already wrapped as an API spec compatible type?
    const fspiopError = ErrorHandler.ReformatFSPIOPError(error)

    const childSpan = span.getChild('qs_quote_sendErrorCallback')
    try {
      await childSpan.audit({ headers, params: { quoteId } }, EventSdk.AuditEventAction.start)
      return await this.sendErrorCallback(fspiopSource, fspiopError, quoteId, headers, childSpan, true)
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
  async sendErrorCallback (fspiopSource, fspiopError, quoteId, headers, span, modifyHeaders = true) {
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
          'fspiop-source': ENUM.Http.Headers.FSPIOP.SWITCH.value,
          'fspiop-http-method': ENUM.Http.RestMethods.PUT,
          'fspiop-uri': fspiopUri
        })
      } else {
        fromSwitchHeaders = Object.assign({}, headers)
      }

      // JWS Signer expects headers in lowercase
      if (envConfig.jws && envConfig.jws.jwsSign && fromSwitchHeaders['fspiop-source'] === envConfig.jws.fspiopSourceToSign) {
        formattedHeaders = this.generateRequestHeadersForJWS(fromSwitchHeaders, true)
      } else {
        formattedHeaders = this.generateRequestHeaders(fromSwitchHeaders, true)
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
        // If JWS is enabled and the 'fspiop-source' matches the configured jws header value('switch')
        // that means it's a switch generated message and we need to sign it
        if (envConfig.jws && envConfig.jws.jwsSign && opts.headers['fspiop-source'] === envConfig.jws.fspiopSourceToSign) {
          const logger = Logger
          logger.log = logger.info
          this.writeLog('Getting the JWS Signer to sign the switch generated message')
          const jwsSigner = new JwsSigner({
            logger,
            signingKey: envConfig.jws.jwsSigningKey
          })
          opts.headers['fspiop-signature'] = jwsSigner.getSignature(opts)
        }

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
    try {
      // calculate a SHA-256 of the request
      const hash = this.calculateRequestHash(quoteRequest)
      this.writeLog(`Calculated sha256 hash of quote request with id ${quoteRequest.quoteId} as: ${hash}`)

      const dupchk = await this.db.getQuoteDuplicateCheck(quoteRequest.quoteId)
      this.writeLog(`DB query for quote duplicate check with id ${quoteRequest.quoteId} returned: ${util.inspect(dupchk)}`)

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
      this.writeLog(`Error in checkDuplicateQuoteRequest: ${getStackOrInspect(err)}`)
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
    try {
      // calculate a SHA-256 of the request
      const hash = this.calculateRequestHash(quoteResponse)
      this.writeLog(`Calculated sha256 hash of quote response with id ${quoteId} as: ${hash}`)

      const dupchk = await this.db.getQuoteResponseDuplicateCheck(quoteId)
      this.writeLog(`DB query for quote response duplicate check with id ${quoteId} returned: ${util.inspect(dupchk)}`)

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
      this.writeLog(`Error in checkDuplicateQuoteResponse: ${getStackOrInspect(err)}`)
      throw ErrorHandler.ReformatFSPIOPError(err)
    }
  }

  /**
   * Utility function to remove null and undefined keys from an object.
   * This is useful for removing "nulls" that come back from database queries
   * when projecting into API spec objects
   *
   * @returns {object}
   */
  removeEmptyKeys (originalObject) {
    const obj = { ...originalObject }
    Object.keys(obj).forEach(key => {
      if (obj[key] && typeof obj[key] === 'object') {
        if (Object.keys(obj[key]).length < 1) {
          // remove empty object
          delete obj[key]
        } else {
          // recurse
          obj[key] = this.removeEmptyKeys(obj[key])
        }
      } else if (obj[key] == null) {
        // null or undefined, remove it
        delete obj[key]
      }
    })
    return obj
  }

  /**
   * Returns the SHA-256 hash of the supplied request object
   *
   * @returns {undefined}
   */
  calculateRequestHash (request) {
    // calculate a SHA-256 of the request
    const requestStr = JSON.stringify(request)
    return crypto.createHash('sha256').update(requestStr).digest('hex')
  }

  /**
   * Generates and returns an object containing API spec compliant HTTP request headers
   *
   * @returns {object}
   */
  generateRequestHeaders (headers, noAccept) {
    const ret = {
      'Content-Type': 'application/vnd.interoperability.quotes+json;version=1.0',
      Date: headers.date,
      'FSPIOP-Source': headers['fspiop-source'],
      'FSPIOP-Destination': headers['fspiop-destination'],
      'FSPIOP-HTTP-Method': headers['fspiop-http-method'],
      'FSPIOP-Signature': headers['fspiop-signature'],
      'FSPIOP-URI': headers['fspiop-uri'],
      Accept: null
    }

    if (!noAccept) {
      ret.Accept = 'application/vnd.interoperability.quotes+json;version=1'
    }

    return this.removeEmptyKeys(ret)
  }

  /**
   * Generates and returns an object containing API spec compliant lowercase HTTP request headers for JWS Signing
   *
   * @returns {object}
   */
  generateRequestHeadersForJWS (headers, noAccept) {
    const ret = {
      'Content-Type': 'application/vnd.interoperability.quotes+json;version=1.0',
      date: headers.date,
      'fspiop-source': headers['fspiop-source'],
      'fspiop-destination': headers['fspiop-destination'],
      'fspiop-http-method': headers['fspiop-http-method'],
      'fspiop-signature': headers['fspiop-signature'],
      'fspiop-uri': headers['fspiop-uri'],
      Accept: null
    }

    if (!noAccept) {
      ret.Accept = 'application/vnd.interoperability.quotes+json;version=1'
    }

    return this.removeEmptyKeys(ret)
  }

  /**
   * Writes a formatted message to the console
   *
   * @returns {undefined}
   */
  // eslint-disable-next-line no-unused-vars
  writeLog (message) {
    Logger.info(`${new Date().toISOString()}, (${this.requestId}) [quotesmodel]: ${message}`)
  }
}

module.exports = QuotesModel
