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

 * Henk Kodde <henk.kodde@modusbox.com>
 * Georgi Georgiev <georgi.georgiev@modusbox.com>
 --------------
 ******/

const request = require('@mojaloop/central-services-shared').Util.Request
const CSutil = require('@mojaloop/central-services-shared').Util
const Enum = require('@mojaloop/central-services-shared').Enum
const ErrorHandler = require('@mojaloop/central-services-error-handling')
const Logger = require('@mojaloop/central-services-logger')
const util = require('util')
const crypto = require('crypto')
const Config = require('../lib/config')

const fetch = require('node-fetch')
const axios = require('axios')
const quoteRules = require('./rules.js')

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
      throw ErrorHandler.CreateInternalServerFSPIOPError('Missing quoteRequest', null, fspiopSource)
    }

    await this.db.getParticipant(fspiopSource)
    await this.db.getParticipant(fspiopDestination)
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
  async handleQuoteRequest (headers, quoteRequest) {
    const envConfig = new Config()
    let txn = null

    try {
      const fspiopSource = headers[Enum.Http.Headers.FSPIOP.SOURCE]
      const fspiopDestination = headers[Enum.Http.Headers.FSPIOP.DESTINATION]
      // accumulate enum ids
      const refs = {}

      // validate - this will throw if the request is invalid
      await this.validateQuoteRequest(fspiopSource, fspiopDestination, quoteRequest)

      if (!envConfig.simpleRoutingMode) {
        // do everything in a db txn so we can rollback multiple operations if something goes wrong
        txn = await this.db.newTransaction()

        // check if this is a resend or an erroneous duplicate
        const dupe = await this.checkDuplicateQuoteRequest(quoteRequest)

        this.writeLog(`Check duplicate for quoteId ${quoteRequest.quoteId} returned: ${util.inspect(dupe)}`)

        // fail fast on duplicate
        if (dupe.isDuplicateId && (!dupe.isResend)) {
          // same quoteId but a different request, this is an error!
          throw ErrorHandler.CreateFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.MODIFIED_REQUEST, `Quote ${quoteRequest.quoteId} is a duplicate but hashes dont match`, null, fspiopSource)
        }

        if (dupe.isResend && dupe.isDuplicateId) {
          // this is a resend
          // See section 3.2.5.1 in "API Definition v1.0.docx" API specification document.
          return this.handleQuoteRequestResend(headers, quoteRequest)
        }

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
          amount: quoteRequest.amount.amount,
          currencyId: quoteRequest.amount.currency
        })

        // eslint-disable-next-line require-atomic-updates
        refs.payerId = await this.db.createPayerQuoteParty(txn, refs.quoteId, quoteRequest.payer,
          quoteRequest.amount.amount, quoteRequest.amount.currency)

        // eslint-disable-next-line require-atomic-updates
        refs.payeeId = await this.db.createPayeeQuoteParty(txn, refs.quoteId, quoteRequest.payee,
          quoteRequest.amount.amount, quoteRequest.amount.currency)

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

        // if we got here, all entities have been created in db correctly to record the quote request

        // check quote rules
        const test = { ...quoteRequest }

        const failures = await quoteRules.getFailures(test)
        if (failures && failures.length > 0) {
          // quote broke business rules, queue up an error callback to the caller
          this.writeLog(`Rules failed for quoteId ${refs.quoteId}: ${util.inspect(failures)}`)
          // todo: make error callback
        }
      }
      // make call to payee dfsp in a setImmediate;
      // attempting to give fair execution of async events...
      // see https://rclayton.silvrback.com/scheduling-execution-in-node-js etc...
      setImmediate(async () => {
        // if we got here rules passed, so we can forward the quote on to the recipient dfsp
        try {
          if (envConfig.simpleRoutingMode) {
            await this.forwardQuoteRequest(headers, quoteRequest.quoteId, quoteRequest)
          } else {
            await this.forwardQuoteRequest(headers, refs.quoteId, quoteRequest)
          }
        } catch (err) {
          // as we are on our own in this context, dont just rethrow the error, instead...
          // get the model to handle it
          this.writeLog(`Error forwarding quote request: ${err.stack || util.inspect(err)}. Attempting to send error callback to ${fspiopSource}`)
          if (envConfig.simpleRoutingMode) {
            await this.handleException(fspiopSource, quoteRequest.quoteId, err, headers)
          } else {
            await this.handleException(fspiopSource, refs.quoteId, err, headers)
          }
        }
      })

      // all ok, return refs
      return refs
    } catch (err) {
      this.writeLog(`Error in handleQuoteRequest for quoteId ${quoteRequest.quoteId}: ${err.stack || util.inspect(err)}`)
      if (txn) {
        txn.rollback(err)
      }
      throw ErrorHandler.ReformatFSPIOPError(err)
    }
  }

  /**
     * Forwards a quote request to a payee DFSP for processing
     *
     * @returns {undefined}
     */
  async forwardQuoteRequest (headers, quoteId, originalQuoteRequest) {
    let endpoint
    const fspiopSource = headers[Enum.Http.Headers.FSPIOP.SOURCE]
    const fspiopDest = headers[Enum.Http.Headers.FSPIOP.DESTINATION]
    const envConfig = new Config()
    try {
      if (!originalQuoteRequest) {
        throw ErrorHandler.CreateInternalServerFSPIOPError('No quote request to forward', null, fspiopSource)
      }

      // lookup payee dfsp callback endpoint
      // todo: for MVP we assume initiator is always payer dfsp! this may not always be the case if a xfer is requested by payee
      if (envConfig.simpleRoutingMode) {
        endpoint = await this.db.getParticipantEndpoint(fspiopDest, 'FSPIOP_CALLBACK_URL_QUOTES')
      } else {
        endpoint = await this.db.getQuotePartyEndpoint(quoteId, 'FSPIOP_CALLBACK_URL_QUOTES', 'PAYEE')
      }
      this.writeLog(`Resolved PAYEE party FSPIOP_CALLBACK_URL_QUOTES endpoint for quote ${quoteId} to: ${util.inspect(endpoint)}`)

      if (!endpoint) {
        // we didnt get an endpoint for the payee dfsp!
        // make an error callback to the initiator
        throw ErrorHandler.CreateFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.DESTINATION_FSP_ERROR, `No FSPIOP_CALLBACK_URL_QUOTES found for quote ${quoteId} PAYEE party`, null, fspiopSource)
      }

      const fullUrl = `${endpoint}/quotes`

      this.writeLog(`Forwarding quote request to endpoint: ${fullUrl}`)

      const opts = {
        method: Enum.Http.RestMethods.POST,
        body: JSON.stringify(originalQuoteRequest),
        headers: headers
      }

      // Network errors lob an exception. Bare in mind 3xx 4xx and 5xx are not network errors
      // so we need to wrap the request below in a `try catch` to handle network errors
      let res
      try {
        res = await fetch(fullUrl, opts)
      } catch (err) {
        throw ErrorHandler.CreateFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.DESTINATION_COMMUNICATION_ERROR, `Network error forwarding quote request to ${fspiopDest}`, err, fspiopSource, [
          { key: 'url', value: fullUrl },
          { key: 'sourceFsp', value: fspiopSource },
          { key: 'destinationFsp', value: fspiopDest },
          { key: 'method', value: opts.method },
          { key: 'request', value: JSON.stringify(opts) }
        ])
      }
      this.writeLog(`forwarding quote request ${quoteId} from ${fspiopSource} to ${fspiopDest} got response ${res.status} ${res.statusText}`)

      // handle non network related errors below
      if (!res.ok) {
        throw ErrorHandler.CreateFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.DESTINATION_COMMUNICATION_ERROR, 'Got non-success response forwarding quote request', null, fspiopSource, [
          { key: 'url', value: fullUrl },
          { key: 'sourceFsp', value: fspiopSource },
          { key: 'destinationFsp', value: fspiopDest },
          { key: 'method', value: opts.method },
          { key: 'request', value: JSON.stringify(opts) },
          { key: 'response', value: JSON.stringify(res) }
        ])
      }
    } catch (err) {
      this.writeLog(`Error forwarding quote request to endpoint ${endpoint}: ${err.stack || util.inspect(err)}`)
      throw ErrorHandler.ReformatFSPIOPError(err)
    }
  }

  /**
     * Deals with resends of quote requests (POST) under the API spec:
     * See section 3.2.5.1, 9.4 and 9.5 in "API Definition v1.0.docx" API specification document.
     */
  async handleQuoteRequestResend (headers, quoteRequest) {
    try {
      const fspiopSource = headers[Enum.Http.Headers.FSPIOP.SOURCE]
      this.writeLog(`Handling resend of quoteRequest: ${util.inspect(quoteRequest)} from ${fspiopSource} to ${headers[Enum.Http.Headers.FSPIOP.DESTINATION]}`)

      // we are ok to assume the quoteRequest object passed to us is the same as the original...
      // as it passed a hash duplicate check...so go ahead and use it to resend rather than
      // hit the db again

      // make call to payee dfsp in a setImmediate;
      // attempting to give fair execution of async events...
      // see https://rclayton.silvrback.com/scheduling-execution-in-node-js etc...
      setImmediate(async () => {
        // if we got here rules passed, so we can forward the quote on to the recipient dfsp
        try {
          await this.forwardQuoteRequest(headers, quoteRequest.quoteId, quoteRequest)
        } catch (err) {
          // as we are on our own in this context, dont just rethrow the error, instead...
          // get the model to handle it
          this.writeLog(`Error forwarding quote request: ${err.stack || util.inspect(err)}. Attempting to send error callback to ${fspiopSource}`)
          const fspiopError = ErrorHandler.ReformatFSPIOPError(err)
          await this.handleException(fspiopSource, quoteRequest.quoteId, fspiopError, headers)
        }
      })
    } catch (err) {
      this.writeLog(`Error in handleQuoteRequestResend: ${err.stack || util.inspect(err)}`)
      throw ErrorHandler.ReformatFSPIOPError(err)
    }
  }

  /**
     * Logic for handling quote update requests e.g. PUT /quotes/{id} requests
     *
     * @returns {object} - object containing updated entities
     */
  async handleQuoteUpdate (headers, quoteId, quoteUpdateRequest) {
    let txn = null
    const fspiopSource = headers[Enum.Http.Headers.FSPIOP.SOURCE]
    const envConfig = new Config()
    try {
      // ensure no 'accept' header is present in the request headers.
      if ('accept' in headers) {
        throw ErrorHandler.CreateFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.VALIDATION_ERROR,
          `Update for quote ${quoteId} failed: "accept" header should not be sent in callbacks.`, null, headers['fspiop-source'])
      }

      // accumulate enum ids
      const refs = {}
      if (!envConfig.simpleRoutingMode) {
        // do everything in a transaction so we can rollback multiple operations if something goes wrong
        txn = await this.db.newTransaction()

        // check if this is a resend or an erroneous duplicate
        const dupe = await this.checkDuplicateQuoteResponse(quoteId, quoteUpdateRequest)
        this.writeLog(`Check duplicate for quoteId ${quoteId} update returned: ${util.inspect(dupe)}`)

        // fail fast on duplicate
        if (dupe.isDuplicateId && (!dupe.isResend)) {
          // same quoteId but a different request, this is an error!
          throw ErrorHandler.CreateFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.MODIFIED_REQUEST, `Update for quote ${quoteUpdateRequest.quoteId} is a duplicate but hashes dont match`, null, fspiopSource)
        }

        if (dupe.isResend && dupe.isDuplicateId) {
          // this is a resend
          // See section 3.2.5.1 in "API Definition v1.0.docx" API specification document.
          return this.handleQuoteUpdateResend(headers, quoteId, quoteUpdateRequest)
        }

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
            throw ErrorHandler.CreateFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.PARTY_NOT_FOUND, `Unable to find payee party for quote ${quoteId}`, null, fspiopSource)
          }

          refs.geoCodeId = await this.db.createGeoCode(txn, {
            quotePartyId: payeeParty.quotePartyId,
            latitude: quoteUpdateRequest.geoCode.latitude,
            longitude: quoteUpdateRequest.geoCode.longitude
          })
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
      // make call to payee dfsp in a setImmediate;
      // attempting to give fair execution of async events...
      // see https://rclayton.silvrback.com/scheduling-execution-in-node-js etc...
      setImmediate(async () => {
        // if we got here rules passed, so we can forward the quote on to the recipient dfsp
        try {
          await this.forwardQuoteUpdate(headers, quoteId, quoteUpdateRequest)
        } catch (err) {
          // as we are on our own in this context, dont just rethrow the error, instead...
          // get the model to handle it
          const fspiopSource = headers[Enum.Http.Headers.FSPIOP.SOURCE]
          this.writeLog(`Error forwarding quote update: ${err.stack || util.inspect(err)}. Attempting to send error callback to ${fspiopSource}`)
          await this.handleException(fspiopSource, quoteId, err, headers)
        }
      })

      // all ok, return refs
      return refs
    } catch (err) {
      this.writeLog(`Error in handleQuoteUpdate: ${err.stack || util.inspect(err)}`)
      if (txn) {
        txn.rollback(err)
      }
      throw ErrorHandler.ReformatFSPIOPError(err)
    }
  }

  /**
     * Forwards a quote response to a payer DFSP for processing
     *
     * @returns {undefined}
     */
  async forwardQuoteUpdate (headers, quoteId, originalQuoteResponse) {
    let endpoint = null
    const envConfig = new Config()
    const fspiopSource = headers[Enum.Http.Headers.FSPIOP.SOURCE]
    const fspiopDestination = headers[Enum.Http.Headers.FSPIOP.DESTINATION]
    try {
      if (!originalQuoteResponse) {
        // we need to recreate the quote response
        throw ErrorHandler.CreateInternalServerFSPIOPError('No quote response to forward', null, fspiopSource)
      }

      // lookup payer dfsp callback endpoint
      if (envConfig.simpleRoutingMode) {
        endpoint = await this.db.getParticipantEndpoint(fspiopDestination, 'FSPIOP_CALLBACK_URL_QUOTES')
      } else {
        // todo: for MVP we assume initiator is always payer dfsp! this may not always be the case if a xfer is requested by payee
        endpoint = await this.db.getQuotePartyEndpoint(quoteId, 'FSPIOP_CALLBACK_URL_QUOTES', 'PAYER')
      }

      this.writeLog(`Resolved PAYER party FSPIOP_CALLBACK_URL_QUOTES endpoint for quote ${quoteId} to: ${util.inspect(endpoint)}`)

      if (!endpoint) {
        // we didnt get an endpoint for the payee dfsp!
        // make an error callback to the initiator
        const fspiopError = ErrorHandler.CreateFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.DESTINATION_FSP_ERROR, `No FSPIOP_CALLBACK_URL_QUOTES found for quote ${quoteId} PAYER party`, null, fspiopSource)
        return this.sendErrorCallback(fspiopSource, fspiopError, quoteId, headers)
      }

      const fullUrl = `${endpoint}/quotes/${quoteId}`

      this.writeLog(`Forwarding quote response to endpoint: ${fullUrl}`)

      const opts = {
        method: Enum.Http.RestMethods.PUT,
        body: JSON.stringify(originalQuoteResponse),
        headers: headers || CSutil.Http.SwitchDefaultHeaders(fspiopDestination, Enum.Http.HeaderResources.QUOTES, Enum.Http.Headers.FSPIOP.SWITCH.value)
      }

      // Network errors lob an exception. Bare in mind 3xx 4xx and 5xx are not network errors
      // so we need to wrap the request below in a `try catch` to handle network errors
      let res
      try {
        res = await request.sendRequest(fullUrl, opts.headers, fspiopSource, fspiopDestination, opts.method, opts.body, Enum.Http.ResponseTypes.JSON)
      } catch (err) {
        throw ErrorHandler.CreateFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.DESTINATION_COMMUNICATION_ERROR, 'Network error forwarding quote response', err, fspiopSource, [
          { key: 'url', value: fullUrl },
          { key: 'sourceFsp', value: fspiopSource },
          { key: 'destinationFsp', value: fspiopDestination },
          { key: 'method', value: opts.method },
          { key: 'request', value: JSON.stringify(opts) }
        ])
      }
      this.writeLog(`forwarding quote response got response ${res.status} ${res.statusText}`)

      if (res.status !== Enum.Http.ReturnCodes.OK.CODE) {
        throw ErrorHandler.CreateFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.DESTINATION_COMMUNICATION_ERROR, 'Got non-success response forwarding quote response', null, fspiopSource, [
          { key: 'url', value: fullUrl },
          { key: 'sourceFsp', value: fspiopSource },
          { key: 'destinationFsp', value: fspiopDestination },
          { key: 'method', value: opts.method },
          { key: 'request', value: JSON.stringify(opts) },
          { key: 'response', value: JSON.stringify(res) }
        ])
      }
    } catch (err) {
      this.writeLog(`Error forwarding quote response to endpoint ${endpoint}: ${err.stack || util.inspect(err)}`)
      throw ErrorHandler.ReformatFSPIOPError(err)
    }
  }

  /**
     * Deals with resends of quote responses (PUT) under the API spec:
     * See section 3.2.5.1, 9.4 and 9.5 in "API Definition v1.0.docx" API specification document.
     */
  async handleQuoteUpdateResend (headers, quoteId, quoteUpdate) {
    try {
      const fspiopSource = headers[Enum.Http.Headers.FSPIOP.SOURCE]
      const fspiopDest = headers[Enum.Http.Headers.FSPIOP.DESTINATION]
      this.writeLog(`Handling resend of quoteUpdate: ${util.inspect(quoteUpdate)} from ${fspiopSource} to ${fspiopDest}`)

      // we are ok to assume the quoteUpdate object passed to us is the same as the original...
      // as it passed a hash duplicate check...so go ahead and use it to resend rather than
      // hit the db again

      // make call to payee dfsp in a setImmediate;
      // attempting to give fair execution of async events...
      // see https://rclayton.silvrback.com/scheduling-execution-in-node-js etc...
      setImmediate(async () => {
        // if we got here rules passed, so we can forward the quote on to the recipient dfsp
        try {
          await this.forwardQuoteUpdate(headers, quoteId, quoteUpdate)
        } catch (err) {
          // as we are on our own in this context, dont just rethrow the error, instead...
          // get the model to handle it
          this.writeLog(`Error forwarding quote response: ${err.stack || util.inspect(err)}. Attempting to send error callback to ${fspiopSource}`)
          await this.handleException(fspiopSource, quoteId, err, headers)
        }
      })
    } catch (err) {
      this.writeLog(`Error in handleQuoteUpdateResend: ${err.stack || util.inspect(err)}`)
      throw ErrorHandler.ReformatFSPIOPError(err)
    }
  }

  /**
     * Handles error reports from clients e.g. POST quotes/{ID}/error
     *
     * @returns {undefined}
     */
  async handleQuoteError (headers, quoteId, error) {
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

      // send the callback in a future event loop step
      // attempting to give fair execution of async events...
      // see https://rclayton.silvrback.com/scheduling-execution-in-node-js etc...
      setImmediate(() => {
        this.sendErrorCallback(headers[Enum.Http.Headers.FSPIOP.SOURCE], fspiopError, quoteId, headers)
      })

      return newError
    } catch (err) {
      this.writeLog(`Error in handleQuoteError: ${err.stack || util.inspect(err)}`)
      txn.rollback(err)
      throw ErrorHandler.ReformatFSPIOPError(err)
    }
  }

  /**
     * Attempts to handle a quote GET request by forwarding it to the destination DFSP
     *
     * @returns {undefined}
     */
  async handleQuoteGet (headers, quoteId) {
    const fspiopSource = headers[Enum.Http.Headers.FSPIOP.SOURCE]
    try {
      // make call to destination dfsp in a setImmediate;
      // attempting to give fair execution of async events...
      // see https://rclayton.silvrback.com/scheduling-execution-in-node-js etc...
      setImmediate(async () => {
        try {
          await this.forwardQuoteGet(headers, quoteId)
        } catch (err) {
          // as we are on our own in this context, dont just rethrow the error, instead...
          // get the model to handle it
          this.writeLog(`Error forwarding quote get: ${err.stack || util.inspect(err)}. Attempting to send error callback to ${fspiopSource}`)
          await this.handleException(fspiopSource, quoteId, err, headers)
        }
      })
    } catch (err) {
      this.writeLog(`Error in handleQuoteGet: ${err.stack || util.inspect(err)}`)
      throw ErrorHandler.ReformatFSPIOPError(err)
    }
  }

  /**
     * Attempts to forward a quote GET request
     *
     * @returns {undefined}
     */
  async forwardQuoteGet (headers, quoteId) {
    let endpoint

    try {
      // we just need to forward this request on to the destinatin dfsp. they should response with a
      // quote update resend (PUT)

      // lookup payee dfsp callback endpoint
      // todo: for MVP we assume initiator is always payer dfsp! this may not always be the case if a xfer is requested by payee
      const fspiopSource = headers[Enum.Http.Headers.FSPIOP.SOURCE]
      const fspiopDest = headers[Enum.Http.Headers.FSPIOP.DESTINATION]
      endpoint = await this.db.getParticipantEndpoint(fspiopDest, 'FSPIOP_CALLBACK_URL_QUOTES')

      this.writeLog(`Resolved ${fspiopDest} FSPIOP_CALLBACK_URL_QUOTES endpoint for quote GET ${quoteId} to: ${util.inspect(endpoint)}`)

      if (!endpoint) {
        // we didnt get an endpoint for the payee dfsp!
        // make an error callback to the initiator
        throw ErrorHandler.CreateFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.DESTINATION_FSP_ERROR, `No FSPIOP_CALLBACK_URL_QUOTES found for quote GET ${quoteId}`, null, fspiopSource)
      }

      const fullUrl = `${endpoint}/quotes/${quoteId}`

      this.writeLog(`Forwarding quote get request to endpoint: ${fullUrl}`)

      const opts = {
        method: Enum.Http.RestMethods.GET,
        headers: headers
      }

      // Network errors lob an exception. Bare in mind 3xx 4xx and 5xx are not network errors
      // so we need to wrap the request below in a `try catch` to handle network errors
      let res
      try {
        res = await fetch(fullUrl, opts)
      } catch (err) {
        throw ErrorHandler.CreateFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.DESTINATION_COMMUNICATION_ERROR, 'Network error forwarding quote get request', err, fspiopSource, [
          { key: 'url', value: fullUrl },
          { key: 'sourceFsp', value: fspiopSource },
          { key: 'destinationFsp', value: fspiopDest },
          { key: 'method', value: opts.method },
          { key: 'request', value: JSON.stringify(opts) }
        ])
      }
      this.writeLog(`forwarding quote get request ${quoteId} from ${fspiopSource} to ${fspiopDest} got response ${res.status} ${res.statusText}`)

      // handle non network related errors below
      if (!res.ok) {
        throw ErrorHandler.CreateFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.DESTINATION_COMMUNICATION_ERROR, 'Got non-success response forwarding quote get request', null, fspiopSource, [
          { key: 'url', value: fullUrl },
          { key: 'sourceFsp', value: fspiopSource },
          { key: 'destinationFsp', value: fspiopDest },
          { key: 'method', value: opts.method },
          { key: 'request', value: JSON.stringify(opts) },
          { key: 'response', value: JSON.stringify(res) }
        ])
      }
    } catch (err) {
      this.writeLog(`Error forwarding quote get request: ${err.stack || util.inspect(err)}`)
      throw ErrorHandler.ReformatFSPIOPError(err)
    }
  }

  /**
     * Attempts to handle an exception in a sensible manner by forwarding it on to the
     * source of the request that caused the error.
     */
  async handleException (fspiopSource, quoteId, error, headers) {
    // is this exception already wrapped as an API spec compatible type?
    const fspiopError = ErrorHandler.ReformatFSPIOPError(error)

    // do the error callback in a future event loop iteration
    // to play nicely with other events
    setImmediate(async () => {
      try {
        return await this.sendErrorCallback(fspiopSource, fspiopError, quoteId, headers)
      } catch (err) {
        // not much we can do other than log the error
        this.writeLog(`Error occured handling error. check service logs as this error may not have been propogated successfully to any other party: ${err.stack || util.inspect(err)}`)
      }
    })
  }

  /**
     * Makes an error callback. Callback is sent to the FSPIOP_CALLBACK_URL_QUOTES endpoint of the replyTo participant in the
     * supplied fspiopErr object. This should be the participantId for the error callback recipient e.g. value from the
     * FSPIOP-Source header of the original request that caused the error.
     *
     * @returns {promise}
     */
  async sendErrorCallback (fspiopSource, fspiopError, quoteId, headers) {
    const fspiopDest = headers[Enum.Http.Headers.FSPIOP.DESTINATION]
    try {
      // look up the callback base url
      const endpoint = await this.db.getParticipantEndpoint(fspiopSource, 'FSPIOP_CALLBACK_URL_QUOTES')

      this.writeLog(`Resolved participant '${fspiopSource}' FSPIOP_CALLBACK_URL_QUOTES to: '${endpoint}'`)

      if (!endpoint) {
        // oops, we cant make an error callback if we dont have an endpoint to call!
        throw ErrorHandler.CreateFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.PARTY_NOT_FOUND, `No FSPIOP_CALLBACK_URL_QUOTES found for ${fspiopSource} unable to make error callback`, null, fspiopSource)
      }

      const fullCallbackUrl = `${endpoint}/quotes/${quoteId}/error`

      // log the original error
      this.writeLog(`Making error callback to participant '${fspiopSource}' for quoteId '${quoteId}' to ${fullCallbackUrl} for error: ${util.inspect(fspiopError.toFullErrorObject())}`)

      // make an error callback
      const opts = {
        method: Enum.Http.RestMethods.PUT,
        url: fullCallbackUrl,
        data: JSON.stringify(fspiopError.toApiErrorObject()),
        // use headers of the error object if they are there...
        // otherwise use sensible defaults
        headers: headers || CSutil.Http.SwitchDefaultHeaders(fspiopSource, Enum.Http.HeaderResources.QUOTES, Enum.Http.Headers.FSPIOP.SWITCH.value)
      }
      let res
      try {
        res = await request.sendRequest(opts.url, opts.headers, fspiopSource, fspiopDest, opts.method, opts.data, Enum.Http.ResponseTypes.JSON)
      } catch (err) {
        throw ErrorHandler.CreateFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.DESTINATION_COMMUNICATION_ERROR, `network error in sendErrorCallback: ${err.message}`, err, fspiopSource, [
          { key: 'url', value: fullCallbackUrl },
          { key: 'sourceFsp', value: fspiopSource },
          { key: 'destinationFsp', value: fspiopDest },
          { key: 'method', value: opts.method },
          { key: 'request', value: JSON.stringify(opts) }
        ])
      }
      this.writeLog(`Error callback got response ${res.status} ${res.statusText}`)

      if (res.status !== Enum.Http.ReturnCodes.OK.CODE) {
        throw ErrorHandler.CreateFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.DESTINATION_COMMUNICATION_ERROR, 'Got non-success response sending error callback', null, fspiopSource, [
          { key: 'url', value: fullCallbackUrl },
          { key: 'sourceFsp', value: fspiopSource },
          { key: 'destinationFsp', value: fspiopDest },
          { key: 'method', value: opts.method },
          { key: 'request', value: JSON.stringify(opts) },
          { key: 'response', value: JSON.stringify(res) }
        ])
      }
    } catch (err) {
      this.writeLog(`Error in sendErrorCallback: ${err.stack || util.inspect(err)}`)
      throw ErrorHandler.ReformatFSPIOPError(err)
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
      this.writeLog(`Error in checkDuplicateQuoteRequest: ${err.stack || util.inspect(err)}`)
      throw ErrorHandler.ReformatFSPIOPError(err)
    }
  }

  /**
     * Tests to see if this quote reqponse is a RESEND of a previous response or an inadvertant duplicate quoteId.
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
      this.writeLog(`Error in checkDuplicateQuoteResponse: ${err.stack || util.inspect(err)}`)
      throw ErrorHandler.ReformatFSPIOPError(err)
    }
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
