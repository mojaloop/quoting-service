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
 * Steven Oderayi <steven.oderayi@modusbox.com>
 * Juan Correa <juan.correa@modusbox.com>
 --------------
 ******/

'use strict'

const Knex = require('knex')
const util = require('util')
const ErrorHandler = require('@mojaloop/central-services-error-handling')
const MLNumber = require('@mojaloop/ml-number')
const Enum = require('@mojaloop/central-services-shared').Enum
const libUtil = require('../lib/util')
const { logger } = require('../lib/')

const LOCAL_ENUM = require('../lib/enum')

/**
 * Abstracts operations against the database
 */
class Database {
  constructor (config, log) {
    this.config = config
    this.log = log || logger.child({
      context: this.constructor.name
    })
  }

  /**
     * Connects to the database and returns a self reference
     *
     * @returns {promise}
     */
  async connect () {
    this.queryBuilder = new Knex(this.config.database)

    return this
  }

  async disconnect () {
    return this.queryBuilder?.destroy()
  }

  /**
     * async utility for getting a transaction object from knex
     *
     * @returns {undefined}
     */
  async newTransaction () {
    return new Promise((resolve, reject) => {
      try {
        this.queryBuilder.transaction(txn => {
          return resolve(txn)
        })
      } catch (err) {
        return reject(err)
      }
    })
  }

  /**
     * Check whether the database connection has basic functionality
     *
     * @returns {boolean}
     */
  async isConnected () {
    try {
      const result = await this.queryBuilder.raw('SELECT 1 + 1 AS result')
      if (result) {
        return true
      }
      return false
    } catch (err) {
      return false
    }
  }

  /**
     * Gets the id of the specified transaction initiator type
     *
     * @returns {promise} - id of the transactionInitiatorType
     */
  async getInitiatorType (initiatorType) {
    try {
      const rows = await this.queryBuilder('transactionInitiatorType')
        .where('name', initiatorType)
        .select()

      if ((!rows) || rows.length < 1) {
        // initiatorType does not exist, this is an error
        throw ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.VALIDATION_ERROR, `Unsupported initiatorType '${initiatorType}'`)
      }
      return rows[0].transactionInitiatorTypeId
    } catch (err) {
      this.log.error('Error in getInitiatorType:', err)
      libUtil.rethrowDatabaseError(err)
    }
  }

  /**
     * Gets the id of the specified transaction initiator
     *
     * @returns {promise} - id of the transactionInitiator
     */
  async getInitiator (initiator) {
    try {
      const rows = await this.queryBuilder('transactionInitiator')
        .where('name', initiator)
        .select()

      if ((!rows) || rows.length < 1) {
        // initiator does not exist, this is an error
        throw ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.VALIDATION_ERROR, `Unsupported initiator '${initiator}'`)
      }
      return rows[0].transactionInitiatorId
    } catch (err) {
      this.log.error('Error in getInitiator:', err)
      libUtil.rethrowDatabaseError(err)
    }
  }

  /**
     * Gets the id of the specified transaction scenario
     *
     * @returns {promise} - id of the transactionScenario
     */
  async getScenario (scenario) {
    try {
      const rows = await this.queryBuilder('transactionScenario')
        .where('name', scenario)
        .select()

      if ((!rows) || rows.length < 1) {
        // scenario does not exist, this is an error
        throw new Error(`Unsupported transaction scenario '${scenario}'`)
      }
      return rows[0].transactionScenarioId
    } catch (err) {
      this.log.error('Error in getScenario:', err)
      libUtil.rethrowDatabaseError(err)
    }
  }

  /**
     * Gets the id of the specified transaction sub-scenario
     *
     * @returns {promise} - id of the transactionSubScenario
     */
  async getSubScenario (subScenario) {
    try {
      const rows = await this.queryBuilder('transactionSubScenario')
        .where('name', subScenario)
        .select()

      if ((!rows) || rows.length < 1) {
        // sub-scenario does not exist, this is an error
        throw ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.VALIDATION_ERROR, `Unsupported transaction sub-scenario '${subScenario}'`)
      }
      return rows[0].transactionSubScenarioId
    } catch (err) {
      this.log.error('Error in getSubScenario:', err)
      libUtil.rethrowDatabaseError(err)
    }
  }

  /**
     * Gets the id of the specified amount type
     *
     * @returns {promise} - id of the amountType
     */
  async getAmountType (amountType) {
    try {
      const rows = await this.queryBuilder('amountType')
        .where('name', amountType)
        .select()

      if ((!rows) || rows.length < 1) {
        // amount type does not exist, this is an error
        throw ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.VALIDATION_ERROR, `Unsupported amount type '${amountType}'`)
      }
      return rows[0].amountTypeId
    } catch (err) {
      this.log.error('Error in getAmountType:', err)
      libUtil.rethrowDatabaseError(err)
    }
  }

  /**
     * Creates a transaction reference in the database
     *
     * @returns {promise}
     */
  async createTransactionReference (txn, quoteId, transactionReferenceId) {
    try {
      await this.queryBuilder('transactionReference')
        .transacting(txn)
        .insert({
          quoteId,
          transactionReferenceId
        })

      this.log.debug('inserted new transactionReference in db: ', transactionReferenceId)
      return transactionReferenceId
    } catch (err) {
      this.log.error('Error in createTransactionReference:', err)
      libUtil.rethrowDatabaseError(err)
    }
  }

  /**
     * Creates an entry in quoteDuplicateCheck
     *
     * @returns {promise} - quoteId
     */
  async createQuoteDuplicateCheck (txn, quoteId, hash) {
    try {
      await this.queryBuilder('quoteDuplicateCheck')
        .transacting(txn)
        .insert({
          quoteId,
          hash
        })

      this.log.debug('inserted new duplicate check in db for quoteId: ', quoteId)
      return quoteId
    } catch (err) {
      this.log.error('Error in createQuoteDuplicateCheck:', err)
      libUtil.rethrowDatabaseError(err)
    }
  }

  /**
     * Creates an entry in quoteResponseDuplicateCheck
     *
     * @returns {promise} - quoteResponseId
     */
  async createQuoteUpdateDuplicateCheck (txn, quoteId, quoteResponseId, hash) {
    try {
      await this.queryBuilder('quoteResponseDuplicateCheck')
        .transacting(txn)
        .insert({
          quoteResponseId,
          quoteId,
          hash
        })

      this.log.debug('inserted new response duplicate check in db for quote: ', { quoteId, quoteResponseId })
      return quoteId
    } catch (err) {
      this.log.error('Error in createQuoteUpdateDuplicateCheck:', err)
      libUtil.rethrowDatabaseError(err)
    }
  }

  /**
     * Gets the id of the specified party type
     *
     * @returns {promise} - id of the partyType
     */
  async getPartyType (partyType) {
    try {
      const rows = await this.queryBuilder('partyType')
        .where('name', partyType)
        .select()

      if ((!rows) || rows.length < 1) {
        // party type does not exist, this is an error
        throw ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.VALIDATION_ERROR, `Unsupported party type '${partyType}'`)
      }

      return rows[0].partyTypeId
    } catch (err) {
      this.log.error('Error in getPartyType:', err)
      libUtil.rethrowDatabaseError(err)
    }
  }

  /**
     * Gets the id of the specified party identifier type
     *
     * @returns {promise} - id of the partyIdentifierType
     */
  async getPartyIdentifierType (partyIdentifierType) {
    try {
      const rows = await this.queryBuilder('partyIdentifierType')
        .where('name', partyIdentifierType)
        .select()

      if ((!rows) || rows.length < 1) {
        // identifier type does not exist, this is an error
        throw ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.VALIDATION_ERROR, `Unsupported party identifier type '${partyIdentifierType}'`)
      }

      return rows[0].partyIdentifierTypeId
    } catch (err) {
      this.log.error('Error in getPartyIdentifierType:', err)
      libUtil.rethrowDatabaseError(err)
    }
  }

  /**
     * Gets the id of the specified participant
     *
     * @returns {promise} - id of the participant
     */
  async getParticipant (participantName, participantType, currencyId, ledgerAccountTypeId = Enum.Accounts.LedgerAccountType.POSITION) {
    try {
      const rows = await this.queryBuilder('participant')
        .innerJoin('participantCurrency', 'participantCurrency.participantId', 'participant.participantId')
        .where({ 'participant.name': participantName })
        .andWhere({ 'participantCurrency.currencyId': currencyId })
        .andWhere({ 'participantCurrency.ledgerAccountTypeId': ledgerAccountTypeId })
        .andWhere({ 'participantCurrency.isActive': true })
        .andWhere({ 'participant.isActive': true })
        .select(
          'participant.*',
          'participantCurrency.participantCurrencyId',
          'participantCurrency.currencyId'
        )
      if ((!rows) || rows.length < 1) {
        // active participant does not exist, this is an error
        if (participantType && participantType === LOCAL_ENUM.PAYEE_DFSP) {
          throw ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.DESTINATION_FSP_ERROR, `Unsupported participant '${participantName}'`)
        } else if (participantType && participantType === LOCAL_ENUM.PAYER_DFSP) {
          throw ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.PAYER_FSP_ID_NOT_FOUND, `Unsupported participant '${participantName}'`)
        } else {
          throw ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.VALIDATION_ERROR, `Unsupported participant '${participantName}'`)
        }
      }

      return rows[0].participantId
    } catch (err) {
      this.log.error('Error in getParticipant:', err)
      libUtil.rethrowDatabaseError(err)
    }
  }

  /**
     * Gets the id of the specified participant name
     *
     * @returns {promise} - id of the participant
     */
  async getParticipantByName (participantName, participantType) {
    try {
      const rows = await this.queryBuilder('participant')
        .where({
          name: participantName,
          isActive: 1
        })
        .select()

      if ((!rows) || rows.length < 1) {
        // active participant does not exist, this is an error
        if (participantType && participantType === LOCAL_ENUM.PAYEE_DFSP) {
          throw ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.DESTINATION_FSP_ERROR, `Unsupported participant '${participantName}'`)
        } else if (participantType && participantType === LOCAL_ENUM.PAYER_DFSP) {
          throw ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.PAYER_FSP_ID_NOT_FOUND, `Unsupported participant '${participantName}'`)
        } else {
          throw ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.VALIDATION_ERROR, `Unsupported participant '${participantName}'`)
        }
      }

      return rows[0].participantId
    } catch (err) {
      this.log.error('Error in getParticipantByName:', err)
      libUtil.rethrowDatabaseError(err)
    }
  }

  /**
     * Gets the id of the specified transfer participant role type
     *
     * @returns {promise} - id of the transfer participant role type
     */
  async getTransferParticipantRoleType (name) {
    try {
      const rows = await this.queryBuilder('transferParticipantRoleType')
        .where({
          name,
          isActive: 1
        })
        .select()

      if ((!rows) || rows.length < 1) {
        // active role type does not exist, this is an error
        throw ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.VALIDATION_ERROR, `Unsupported transfer participant role type '${name}'`)
      }

      return rows[0].transferParticipantRoleTypeId
    } catch (err) {
      this.log.error('Error in getTransferParticipantRoleType:', err)
      libUtil.rethrowDatabaseError(err)
    }
  }

  /**
     * Gets the id of the specified ledger entry type
     *
     * @returns {promise} - id of the ledger entry type
     */
  async getLedgerEntryType (name) {
    try {
      const rows = await this.queryBuilder('ledgerEntryType')
        .where({
          name,
          isActive: 1
        })
        .select()

      if ((!rows) || rows.length < 1) {
        // active ledger entry type does not exist, this is an error
        throw ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.VALIDATION_ERROR, `Unsupported ledger entry type '${name}'`)
      }

      return rows[0].ledgerEntryTypeId
    } catch (err) {
      this.log.error('Error in getLedgerEntryType:', err)
      libUtil.rethrowDatabaseError(err)
    }
  }

  /**
     * Creates a payer quote party
     *
     * @returns {promise}
     */
  async createPayerQuoteParty (txn, quoteId, party, amount, currency, enumVals) {
    // note amount is negative for payee and positive for payer
    return this.createQuoteParty(txn, quoteId, LOCAL_ENUM.PAYER, party, amount, currency, enumVals)
  }

  /**
     * Creates a payee quote party
     *
     * @returns {promise}
     */
  async createPayeeQuoteParty (txn, quoteId, party, amount, currency, enumVals) {
    // note amount is negative for payee and positive for payer
    return this.createQuoteParty(txn, quoteId, LOCAL_ENUM.PAYEE, party, -amount, currency, enumVals)
  }

  /**
     * Creates a quote party
     *
     * @returns {integer} - id of created quoteParty
     */
  async createQuoteParty (txn, quoteId, partyType, party, amount, currency, enumVals) {
    try {
      const refs = {}

      refs.partyTypeId = enumVals[0]
      refs.partyIdentifierTypeId = enumVals[1]
      refs.participantId = enumVals[2]
      refs.transferParticipantRoleTypeId = enumVals[3]
      refs.ledgerEntryTypeId = enumVals[4]

      if (party.partyIdInfo.partySubIdOrType) {
        // subIdOrTypeId value need not be one in the partyIdentifierType list as per the specification.
        refs.partySubIdOrTypeId = party.partyIdInfo.partySubIdOrType
      }

      // insert a new quote party
      const newQuoteParty = {
        quoteId,
        partyTypeId: refs.partyTypeId,
        partyIdentifierTypeId: refs.partyIdentifierTypeId,
        partyIdentifierValue: party.partyIdInfo.partyIdentifier,
        partySubIdOrTypeId: refs.partySubIdOrTypeId,
        fspId: party.partyIdInfo.fspId,
        participantId: refs.participantId,
        merchantClassificationCode: party.merchantClassificationCode,
        partyName: party.partyName,
        transferParticipantRoleTypeId: refs.transferParticipantRoleTypeId,
        ledgerEntryTypeId: refs.ledgerEntryTypeId,
        amount: new MLNumber(amount).toFixed(this.config.amount.scale),
        currencyId: currency
      }

      const res = await this.queryBuilder('quoteParty')
        .transacting(txn)
        .insert(newQuoteParty)

      this.log.debug('inserted new quoteParty in db: ', res[0])

      // hold on to the created quotePartyId so we can return it when we are done
      const quotePartyId = res[0]

      if (party.personalInfo) {
        // we need to store personal info also
        const newParty = {
          firstName: party.personalInfo.complexName.firstName,
          middleName: party.personalInfo.complexName.middleName,
          lastName: party.personalInfo.complexName.lastName,
          dateOfBirth: party.personalInfo.dateOfBirth
        }

        const createdParty = await this.createParty(txn, quotePartyId, newParty)
        this.log.debug('inserted new party in db: ', createdParty)
      }
      if (party.partyIdInfo.extensionList) {
        const extensions = party.partyIdInfo.extensionList.extension
        // we need to store personal info also
        const quoteParty = await this.getTxnQuoteParty(txn, quoteId, partyType)
        await this.createQuotePartyIdInfoExtensions(txn, extensions, quoteParty)
      }

      return quotePartyId
    } catch (err) {
      this.log.error('Error in createQuoteParty:', err)
      libUtil.rethrowDatabaseError(err)
    }
  }

  /**
     * Creates the specific party and returns its id
     *
     * @returns {promise} - id of party
     */
  async createParty (txn, quotePartyId, party) {
    try {
      const newParty = {
        ...party,
        quotePartyId
      }

      const res = await this.queryBuilder('party')
        .transacting(txn)
        .insert(newParty)

      newParty.partyId = res[0]
      return newParty
    } catch (err) {
      this.log.error('Error in createParty:', err)
      libUtil.rethrowDatabaseError(err)
    }
  }

  /**
     * Creates a quote in the database
     *
     * @returns {promise}
     */
  async createQuote (txn, quote) {
    try {
      await this.queryBuilder('quote')
        .transacting(txn)
        .insert({
          quoteId: quote.quoteId,
          transactionReferenceId: quote.transactionReferenceId,
          transactionRequestId: quote.transactionRequestId,
          note: quote.note,
          expirationDate: quote.expirationDate,
          transactionInitiatorId: quote.transactionInitiatorId,
          transactionInitiatorTypeId: quote.transactionInitiatorTypeId,
          transactionScenarioId: quote.transactionScenarioId,
          balanceOfPaymentsId: quote.balanceOfPaymentsId,
          transactionSubScenarioId: quote.transactionSubScenarioId,
          amountTypeId: quote.amountTypeId,
          amount: new MLNumber(quote.amount).toFixed(this.config.amount.scale),
          currencyId: quote.currencyId
        })

      this.log.debug('inserted new quote in db: ', quote)
      return quote.quoteId
    } catch (err) {
      this.log.error('Error in createQuote:', err)
      libUtil.rethrowDatabaseError(err)
    }
  }

  async createQuotePartyIdInfoExtensions (txn, extensions, quoteParty) {
    try {
      const newExtensions = extensions.map(({ key, value }) => ({
        quotePartyId: quoteParty.quotePartyId,
        key,
        value
      }))

      await this.queryBuilder('quotePartyIdInfoExtension')
        .transacting(txn)
        .insert(newExtensions)
      return true
    } catch (err) {
      this.log.error('Error in createQuotePartyIdInfoExtensions:', err)
      libUtil.rethrowDatabaseError(err)
    }
  }

  /**
     * Gets the specified party for the specified quote
     *
     * @returns {object}
     */
  async getQuoteParty (quoteId, partyType) {
    try {
      const rows = await this.queryBuilder('quoteParty')
        .innerJoin('partyType', 'partyType.partyTypeId', 'quoteParty.partyTypeId')
        .where('quoteParty.quoteId', quoteId)
        .andWhere('partyType.name', partyType)
        .select('quoteParty.*')

      if ((!rows) || rows.length < 1) {
        return null
      }

      if (rows.length > 1) {
        throw ErrorHandler.Factory.createInternalServerFSPIOPError(`Expected 1 quoteParty row for quoteId ${quoteId} and partyType ${partyType} but got: ${util.inspect(rows)}`)
      }

      return rows[0]
    } catch (err) {
      this.log.error('Error in getQuoteParty:', err)
      libUtil.rethrowDatabaseError(err)
    }
  }

  async getTxnQuoteParty (txn, quoteId, partyType) {
    try {
      const rows = await this.queryBuilder('quoteParty')
        .transacting(txn)
        .innerJoin('partyType', 'partyType.partyTypeId', 'quoteParty.partyTypeId')
        .where('quoteParty.quoteId', quoteId)
        .andWhere('partyType.name', partyType)
        .select('quoteParty.*')

      if ((!rows) || rows.length < 1) {
        return null
      }

      if (rows.length > 1) {
        throw ErrorHandler.Factory.createInternalServerFSPIOPError(`Expected 1 quoteParty row for quoteId ${quoteId} and partyType ${partyType} but got: ${util.inspect(rows)}`)
      }

      return rows[0]
    } catch (err) {
      this.log.error('Error in getQuoteParty:', err)
      libUtil.rethrowDatabaseError(err)
    }
  }

  /**
     * Gets the specified endpoint of the specified type for the specified participant
     *
     * @returns {promise} - resolves to the endpoint base url
     */
  async getParticipantEndpoint (participantName, endpointType) {
    try {
      const rows = await this.queryBuilder('participantEndpoint')
        .innerJoin('participant', 'participant.participantId', 'participantEndpoint.participantId')
        .innerJoin('endpointType', 'endpointType.endpointTypeId', 'participantEndpoint.endpointTypeId')
        .where('participant.name', participantName)
        .andWhere('endpointType.name', endpointType)
        .andWhere('participantEndpoint.isActive', 1)
        .select('participantEndpoint.value')

      if ((!rows) || rows.length < 1) {
        return null
      }

      return rows[0].value
    } catch (err) {
      this.log.error('Error in getParticipantEndpoint:', err)
      libUtil.rethrowDatabaseError(err)
    }
  }

  /**
     * Gets a quote duplicate check row
     *
     * @returns {object} - quote duplicate check or null if none found
     */
  async getQuoteDuplicateCheck (quoteId) {
    try {
      const rows = await this.queryBuilder('quoteDuplicateCheck')
        .where({
          quoteId
        })
        .select()

      if ((!rows) || rows.length < 1) {
        return null
      }

      return rows[0]
    } catch (err) {
      this.log.error('Error in getQuoteDuplicateCheck:', err)
      libUtil.rethrowDatabaseError(err)
    }
  }

  /**
     * Gets a quote response duplicate check row
     *
     * @returns {object} - quote duplicate check or null if none found
     */
  async getQuoteResponseDuplicateCheck (quoteId) {
    try {
      const rows = await this.queryBuilder('quoteResponseDuplicateCheck')
        .where({
          quoteId
        })
        .select()

      if ((!rows) || rows.length < 1) {
        return null
      }

      return rows[0]
    } catch (err) {
      this.log.error('Error in getQuoteResponseDuplicateCheck:', err)
      libUtil.rethrowDatabaseError(err)
    }
  }

  /**
     * Creates a quoteResponse object in the database
     *
     * @returns {object} - created object
     */
  async createQuoteResponse (txn, quoteId, quoteResponse) {
    try {
      const newQuoteResponse = {
        quoteId,
        transferAmountCurrencyId: quoteResponse.transferAmount.currency,
        transferAmount: new MLNumber(quoteResponse.transferAmount.amount).toFixed(this.config.amount.scale),
        payeeReceiveAmountCurrencyId: quoteResponse.payeeReceiveAmount ? quoteResponse.payeeReceiveAmount.currency : null,
        payeeReceiveAmount: quoteResponse.payeeReceiveAmount ? new MLNumber(quoteResponse.payeeReceiveAmount.amount).toFixed(this.config.amount.scale) : null,
        payeeFspFeeCurrencyId: quoteResponse.payeeFspFee ? quoteResponse.payeeFspFee.currency : null,
        payeeFspFeeAmount: quoteResponse.payeeFspFee ? new MLNumber(quoteResponse.payeeFspFee.amount).toFixed(this.config.amount.scale) : null,
        payeeFspCommissionCurrencyId: quoteResponse.payeeFspCommission ? quoteResponse.payeeFspCommission.currency : null,
        payeeFspCommissionAmount: quoteResponse.payeeFspCommission ? new MLNumber(quoteResponse.payeeFspCommission.amount).toFixed(this.config.amount.scale) : null,
        ilpCondition: quoteResponse.condition,
        responseExpirationDate: quoteResponse.expiration,
        isValid: quoteResponse.isValid
      }

      const res = await this.queryBuilder('quoteResponse')
        .transacting(txn)
        .insert(newQuoteResponse)

      newQuoteResponse.quoteResponseId = res[0]

      this.log.debug('inserted new quoteResponse in db: ', newQuoteResponse)
      return newQuoteResponse
    } catch (err) {
      this.log.error('Error in createQuoteResponse:', err)
      libUtil.rethrowDatabaseError(err)
    }
  }

  /**
     * Creates a new quote response ILP packet row
     *
     * @returns {object}
     */
  async createQuoteResponseIlpPacket (txn, quoteResponseId, ilpPacket) {
    try {
      const newPacket = {
        quoteResponseId,
        value: ilpPacket
      }

      const res = await this.queryBuilder('quoteResponseIlpPacket')
        .transacting(txn)
        .insert(newPacket)

      this.log.debug('inserted new quoteResponseIlpPacket in db: ', res)
      return res
    } catch (err) {
      this.log.error('Error in createIlpPacket:', err)
      libUtil.rethrowDatabaseError(err)
    }
  }

  /**
     * Creates a new geoCode row
     *
     * @returns {object}
     */
  async createGeoCode (txn, geoCode) {
    try {
      const newGeoCode = {
        quotePartyId: geoCode.quotePartyId,
        latitude: geoCode.latitude,
        longitude: geoCode.longitude
      }

      const res = await this.queryBuilder('geoCode')
        .transacting(txn)
        .insert(newGeoCode)

      newGeoCode.geoCodeId = res[0]

      this.log.debug('inserted new geoCode in db: ', newGeoCode)
      return res
    } catch (err) {
      this.log.error('Error in createGeoCode:', err)
      libUtil.rethrowDatabaseError(err)
    }
  }

  /**
     * Creates a new quoteError row
     *
     * @returns {object}
     */
  async createQuoteError (txn, error) {
    try {
      const newError = {
        quoteId: error.quoteId,
        errorCode: error.errorCode,
        errorDescription: error.errorDescription
      }

      const res = await this.queryBuilder('quoteError')
        .transacting(txn)
        .insert(newError)

      newError.quoteErrorId = res[0]

      this.log.debug('inserted new quoteError in db: ', newError)
      return res
    } catch (err) {
      this.log.error('Error in createQuoteError:', err)
      libUtil.rethrowDatabaseError(err)
    }
  }

  /**
     * Creates quoteExtensions rows
     *
     * @returns {object}
     * @param   {Array[{object}]} extensions - array of extension objects with quoteId, key and value properties
     */
  async createQuoteExtensions (txn, extensions, quoteId, transactionId = undefined, quoteResponseId = undefined) {
    try {
      const newExtensions = extensions.map(({ key, value }) => ({
        quoteId,
        quoteResponseId,
        transactionId,
        key,
        value
      }))

      const res = await this.queryBuilder('quoteExtension')
        .transacting(txn)
        .insert(newExtensions)

      this.log.debug('inserted new quoteExtensions in db: ', newExtensions)
      return res
    } catch (err) {
      this.log.error('Error in createQuoteExtensions:', err)
      libUtil.rethrowDatabaseError(err)
    }
  }

  async createFxQuote (txn, conversionRequestId) {
    try {
      const newFxQuote = {
        conversionRequestId
      }

      const res = await this.queryBuilder('fxQuote')
        .transacting(txn)
        .insert(newFxQuote)

      newFxQuote.fxQuoteId = res[0]

      this.log.debug('inserted new fxQuote in db: ', newFxQuote)
      return newFxQuote
    } catch (err) {
      this.log.error('Error in createFxQuote:', err)
      libUtil.rethrowDatabaseError(err)
    }
  }

  async createFxQuoteResponse (txn, conversionRequestId, fxQuoteResponse) {
    try {
      const newFxQuoteResponse = {
        conversionRequestId,
        ilpCondition: fxQuoteResponse.condition
      }

      const res = await this.queryBuilder('fxQuoteResponse')
        .transacting(txn)
        .insert(newFxQuoteResponse)

      newFxQuoteResponse.fxQuoteResponseId = res[0]

      this.log.debug('inserted new fxQuoteResponse in db: ', newFxQuoteResponse)
      return newFxQuoteResponse
    } catch (err) {
      this.log.error('Error in createFxQuoteResponse:', err)
      libUtil.rethrowDatabaseError(err)
    }
  }

  async createFxQuoteError (txn, conversionRequestId, error) {
    try {
      const newFxQuoteError = {
        conversionRequestId,
        errorCode: error.errorCode,
        errorDescription: error.errorDescription
      }

      const res = await this.queryBuilder('fxQuoteError')
        .transacting(txn)
        .insert(newFxQuoteError)

      newFxQuoteError.fxQuoteErrorId = res[0]

      this.log.debug('inserted new fxQuoteError in db: ', newFxQuoteError)
      return newFxQuoteError
    } catch (err) {
      this.log.error('Error in createFxQuoteError:', err)
      libUtil.rethrowDatabaseError(err)
    }
  }

  async createFxQuoteDuplicateCheck (txn, conversionRequestId, hash) {
    try {
      const newFxQuoteDuplicateCheck = {
        conversionRequestId,
        hash
      }

      const res = await this.queryBuilder('fxQuoteDuplicateCheck')
        .transacting(txn)
        .insert(newFxQuoteDuplicateCheck)

      newFxQuoteDuplicateCheck.fxQuoteDuplicateCheckId = res[0]

      this.log.debug('inserted new fxQuoteDuplicateCheck in db: ', newFxQuoteDuplicateCheck)
      return newFxQuoteDuplicateCheck
    } catch (err) {
      this.log.error('Error in createFxQuoteDuplicateCheck:', err)
      libUtil.rethrowDatabaseError(err)
    }
  }

  async createFxQuoteResponseDuplicateCheck (txn, fxQuoteResponseId, conversionRequestId, hash) {
    try {
      const newFxQuoteResponseDuplicateCheck = {
        fxQuoteResponseId,
        conversionRequestId,
        hash
      }

      const res = await this.queryBuilder('fxQuoteResponseDuplicateCheck')
        .transacting(txn)
        .insert(newFxQuoteResponseDuplicateCheck)

      newFxQuoteResponseDuplicateCheck.fxQuoteResponseDuplicateCheckId = res[0]

      this.log.debug('inserted new fxQuoteResponseDuplicateCheck in db: ', newFxQuoteResponseDuplicateCheck)
      return newFxQuoteResponseDuplicateCheck
    } catch (err) {
      this.log.error('Error in createFxQuoteResponseDuplicateCheck:', err)
      libUtil.rethrowDatabaseError(err)
    }
  }

  async createFxQuoteConversionTerms (txn, conversionRequestId, conversionTerms) {
    try {
      const amountTypeId = await this.getAmountType(conversionTerms.amountType)
      const newFxQuoteConversionTerms = {
        conversionRequestId,
        conversionId: conversionTerms.conversionId,
        determiningTransferId: conversionTerms.determiningTransferId,
        initiatingFsp: conversionTerms.initiatingFsp,
        counterPartyFsp: conversionTerms.counterPartyFsp,
        amountTypeId,
        sourceAmount: conversionTerms.sourceAmount.amount,
        sourceCurrency: conversionTerms.sourceAmount.currency,
        targetAmount: conversionTerms.targetAmount.amount,
        targetCurrency: conversionTerms.targetAmount.currency,
        expirationDate: new Date(conversionTerms.expiration)
      }

      const res = await this.queryBuilder('fxQuoteConversionTerms')
        .transacting(txn)
        .insert(newFxQuoteConversionTerms)

      newFxQuoteConversionTerms.conversionId = res[0]
      this.log.debug('inserted new fxQuoteConversionTerms in db: ', newFxQuoteConversionTerms)
      return newFxQuoteConversionTerms
    } catch (err) {
      this.log.error('Error in createFxQuoteConversionTerms:', err)
      libUtil.rethrowDatabaseError(err)
    }
  }

  async createFxQuoteResponseFxCharge (txn, conversionId, charges) {
    try {
      const newFxQuoteResponseFxCharges = charges.map(charge => ({
        conversionId,
        chargeType: charge.chargeType,
        sourceAmount: charge.sourceAmount.amount,
        sourceCurrency: charge.sourceAmount.currency,
        targetAmount: charge.targetAmount.amount,
        targetCurrency: charge.targetAmount.currency
      }))

      const res = await this.queryBuilder('fxCharge')
        .transacting(txn)
        .insert(newFxQuoteResponseFxCharges)

      this.log.debug('inserted new fxCharge in db: ', newFxQuoteResponseFxCharges)
      return res
    } catch (err) {
      this.log.error('Error in fxCharge:', err)
      libUtil.rethrowDatabaseError(err)
    }
  }

  async createFxQuoteConversionTermsExtension (txn, conversionId, conversionTermsExtension) {
    try {
      const newFxQuoteConversionTermsExtension = conversionTermsExtension.map(({ key, value }) => ({
        conversionId,
        key,
        value
      }))

      const res = await this.queryBuilder('fxQuoteConversionTermsExtension')
        .transacting(txn)
        .insert(newFxQuoteConversionTermsExtension)

      this.log.debug('inserted new fxQuoteConversionTermsExtension in db: ', newFxQuoteConversionTermsExtension)
      return res
    } catch (err) {
      this.log.error('Error in createFxQuoteConversionTermsExtension:', err)
      libUtil.rethrowDatabaseError(err)
    }
  }

  async createFxQuoteResponseConversionTerms (txn, conversionRequestId, fxQuoteResponseId, conversionTerms) {
    try {
      const amountTypeId = await this.getAmountType(conversionTerms.amountType)

      const newFxQuoteResponseConversionTerms = {
        conversionId: conversionTerms.conversionId,
        conversionRequestId,
        fxQuoteResponseId,
        determiningTransferId: conversionTerms.determiningTransferId,
        initiatingFsp: conversionTerms.initiatingFsp,
        counterPartyFsp: conversionTerms.counterPartyFsp,
        amountTypeId,
        sourceAmount: conversionTerms.sourceAmount.amount,
        sourceCurrency: conversionTerms.sourceAmount.currency,
        targetAmount: conversionTerms.targetAmount.amount,
        targetCurrency: conversionTerms.targetAmount.currency,
        expirationDate: new Date(conversionTerms.expiration)
      }

      const res = await this.queryBuilder('fxQuoteResponseConversionTerms')
        .transacting(txn)
        .insert(newFxQuoteResponseConversionTerms)

      newFxQuoteResponseConversionTerms.fxQuoteResponseConversionTermsId = res[0]

      this.log.debug('inserted new fxQuoteResponseConversionTerms in db: ', newFxQuoteResponseConversionTerms)
      return newFxQuoteResponseConversionTerms
    } catch (err) {
      this.log.error('Error in createFxQuoteResponseConversionTerms:', err)
      libUtil.rethrowDatabaseError(err)
    }
  }

  async createFxQuoteResponseConversionTermsExtension (txn, conversionId, conversionTermsExtension) {
    try {
      const newFxQuoteResponseConversionTermsExtension = conversionTermsExtension.map(({ key, value }) => ({
        conversionId,
        key,
        value
      }))

      const res = await this.queryBuilder('fxQuoteResponseConversionTermsExtension')
        .transacting(txn)
        .insert(newFxQuoteResponseConversionTermsExtension)

      this.log.debug('inserted new fxQuoteResponseConversionTermsExtension in db: ', newFxQuoteResponseConversionTermsExtension)
      return res
    } catch (err) {
      this.log.error('Error in createFxQuoteResponseConversionTermsExtension:', err)
      libUtil.rethrowDatabaseError(err)
    }
  }

  async getFxQuoteDuplicateCheck (conversionRequestId) {
    try {
      const result = await this.queryBuilder('fxQuoteDuplicateCheck')
        .where('conversionRequestId', conversionRequestId)
        .first()
      return result
    } catch (err) {
      this.log.error('Error in getFxQuoteDuplicateCheck:', err)
      libUtil.rethrowDatabaseError(err)
    }
  }

  async getFxQuoteResponseDuplicateCheck (conversionRequestId) {
    try {
      const result = await this.queryBuilder('fxQuoteResponseDuplicateCheck')
        .where('conversionRequestId', conversionRequestId)
        .first()
      return result
    } catch (err) {
      this.log.error('Error in getFxQuoteResponseDuplicateCheck:', err)
      libUtil.rethrowDatabaseError(err)
    }
  }

  async _getFxQuoteDetails (conversionRequestId) {
    try {
      const result = await this.queryBuilder('fxQuote')
        .join('fxQuoteConversionTerms', 'fxQuote.conversionRequestId', 'fxQuoteConversionTerms.conversionRequestId')
        .where('fxQuote.conversionRequestId', conversionRequestId)
        .select([
          'fxQuote.*',
          'fxQuoteConversionTerms.*',
          // eslint-disable-next-line no-multi-str
          this.queryBuilder.raw('(SELECT JSON_ARRAYAGG(\
            JSON_OBJECT(\
              "key", fxQuoteConversionTermsExtension.key, \
              "value", fxQuoteConversionTermsExtension.value\
            )) \
            FROM fxQuoteConversionTermsExtension \
            WHERE fxQuoteConversionTermsExtension.conversionId=fxQuoteConversionTerms.conversionId) AS extensions')
        ])
        .first()
      return result
    } catch (err) {
      this.log.error('Error in _getFxQuoteDetails:', err)
      libUtil.rethrowDatabaseError(err)
    }
  }

  async _getFxQuoteResponseDetails (conversionRequestId) {
    try {
      const result = await this.queryBuilder('fxQuoteResponse')
        .join('fxQuoteResponseConversionTerms', 'fxQuoteResponse.conversionRequestId', 'fxQuoteResponseConversionTerms.conversionRequestId')
        .where('fxQuoteResponse.conversionRequestId', conversionRequestId)
        .select([
          'fxQuoteResponse.*',
          'fxQuoteResponseConversionTerms.*',
          this.queryBuilder.raw('(SELECT JSON_ARRAYAGG(JSON_OBJECT("key", fxQuoteResponseConversionTermsExtension.key, "value", fxQuoteResponseConversionTermsExtension.value)) FROM fxQuoteResponseConversionTermsExtension WHERE fxQuoteResponseConversionTermsExtension.conversionId=fxQuoteResponseConversionTerms.conversionId) AS extensions'),
          // eslint-disable-next-line no-multi-str
          this.queryBuilder.raw('(SELECT JSON_ARRAYAGG(\
            JSON_OBJECT(\
              "chargeType", fxCharge.chargeType, \
              "sourceAmount", fxCharge.sourceAmount, \
              "sourceCurrency", fxCharge.sourceCurrency, \
              "targetAmount", fxCharge.targetAmount, \
              "targetCurrency", fxCharge.targetCurrency \
            )) \
            FROM fxCharge \
            WHERE fxCharge.conversionId=fxQuoteResponseConversionTerms.conversionId) AS charges')
        ])
        .first()
      return result
    } catch (err) {
      this.log.error('Error in _getFxQuoteDetails:', err)
      libUtil.rethrowDatabaseError(err)
    }
  }

  async _getFxQuoteErrorDetails (conversionRequestId) {
    try {
      const result = await this.queryBuilder('fxQuoteError')
        .where('conversionRequestId', conversionRequestId)
        .first()
      return result
    } catch (err) {
      this.log.error('Error in _getFxQuoteErrorDetails:', err)
      libUtil.rethrowDatabaseError(err)
    }
  }

  /**
   * @function getIsMigrationLocked
   *
   * @description Gets whether or not the database is locked based on the migration_lock
   * @returns {Promise<boolean>} - true if locked, false if not. Rejects if an error occours
   */
  async getIsMigrationLocked () {
    const result = await this.queryBuilder('migration_lock')
      .orderBy('index', 'desc')
      .first()
      .select('is_locked AS isLocked')
    return result.isLocked
  }
}

module.exports = Database
