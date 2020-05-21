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
const Logger = require('@mojaloop/central-services-logger')
const ErrorHandler = require('@mojaloop/central-services-error-handling')
const MLNumber = require('@mojaloop/ml-number')

const LOCAL_ENUM = require('../lib/enum')
const { getStackOrInspect } = require('../lib/util')

/**
 * Abstracts operations against the database
 */
class Database {
  constructor (config) {
    this.config = config
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
     * Gets the set of enabled transfer rules
     *
     * @returns {promise} - all enabled transfer rules
     */
  async getTransferRules () {
    try {
      const rows = await this.queryBuilder('transferRules')
        .where('enabled', true)
        .select()
      return rows.map(r => JSON.parse(r.rule))
    } catch (err) {
      this.writeLog(`Error in getTransferRules: ${getStackOrInspect(err)}`)
      throw ErrorHandler.Factory.reformatFSPIOPError(err)
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
      this.writeLog(`Error in getInitiatorType: ${getStackOrInspect(err)}`)
      throw ErrorHandler.Factory.reformatFSPIOPError(err)
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
      this.writeLog(`Error in getInitiator: ${getStackOrInspect(err)}`)
      throw ErrorHandler.Factory.reformatFSPIOPError(err)
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
      this.writeLog(`Error in getScenario: ${getStackOrInspect(err)}`)
      throw ErrorHandler.Factory.reformatFSPIOPError(err)
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
      this.writeLog(`Error in getSubScenario: ${getStackOrInspect(err)}`)
      throw ErrorHandler.Factory.reformatFSPIOPError(err)
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
      this.writeLog(`Error in getAmountType: ${getStackOrInspect(err)}`)
      throw ErrorHandler.Factory.reformatFSPIOPError(err)
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
          quoteId: quoteId,
          transactionReferenceId: transactionReferenceId
        })

      this.writeLog(`inserted new transactionReference in db: ${transactionReferenceId}`)
      return transactionReferenceId
    } catch (err) {
      this.writeLog(`Error in createTransactionReference: ${getStackOrInspect(err)}`)
      throw ErrorHandler.Factory.reformatFSPIOPError(err)
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
          quoteId: quoteId,
          hash: hash
        })

      this.writeLog(`inserted new duplicate check in db for quoteId: ${quoteId}`)
      return quoteId
    } catch (err) {
      this.writeLog(`Error in createQuoteDuplicateCheck: ${getStackOrInspect(err)}`)
      throw ErrorHandler.Factory.reformatFSPIOPError(err)
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
          quoteResponseId: quoteResponseId,
          quoteId: quoteId,
          hash: hash
        })

      this.writeLog(`inserted new response duplicate check in db for quote ${quoteId}, quoteResponseId: ${quoteResponseId}`)
      return quoteId
    } catch (err) {
      this.writeLog(`Error in createQuoteUpdateDuplicateCheck: ${getStackOrInspect(err)}`)
      throw ErrorHandler.Factory.reformatFSPIOPError(err)
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
      this.writeLog(`Error in getPartyType: ${getStackOrInspect(err)}`)
      throw ErrorHandler.Factory.reformatFSPIOPError(err)
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
      this.writeLog(`Error in getPartyIdentifierType: ${getStackOrInspect(err)}`)
      throw ErrorHandler.Factory.reformatFSPIOPError(err)
    }
  }

  /**
     * Gets the id of the specified participant
     *
     * @returns {promise} - id of the participant
     */
  async getParticipant (participantName, participantType) {
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
      this.writeLog(`Error in getPartyIdentifierType: ${getStackOrInspect(err)}`)
      throw ErrorHandler.Factory.reformatFSPIOPError(err)
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
          name: name,
          isActive: 1
        })
        .select()

      if ((!rows) || rows.length < 1) {
        // active role type does not exist, this is an error
        throw ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.VALIDATION_ERROR, `Unsupported transfer participant role type '${name}'`)
      }

      return rows[0].transferParticipantRoleTypeId
    } catch (err) {
      this.writeLog(`Error in getTransferParticipantRoleType: ${getStackOrInspect(err)}`)
      throw ErrorHandler.Factory.reformatFSPIOPError(err)
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
          name: name,
          isActive: 1
        })
        .select()

      if ((!rows) || rows.length < 1) {
        // active ledger entry type does not exist, this is an error
        throw ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.VALIDATION_ERROR, `Unsupported ledger entry type '${name}'`)
      }

      return rows[0].ledgerEntryTypeId
    } catch (err) {
      this.writeLog(`Error in getLedgerEntryType: ${getStackOrInspect(err)}`)
      throw ErrorHandler.Factory.reformatFSPIOPError(err)
    }
  }

  /**
     * Creates a payer quote party
     *
     * @returns {promise}
     */
  async createPayerQuoteParty (txn, quoteId, party, amount, currency) {
    // note amount is negative for payee and positive for payer
    return this.createQuoteParty(txn, quoteId, LOCAL_ENUM.PAYER, LOCAL_ENUM.PAYER_DFSP, LOCAL_ENUM.PRINCIPLE_VALUE, party, amount, currency)
  }

  /**
     * Creates a payee quote party
     *
     * @returns {promise}
     */
  async createPayeeQuoteParty (txn, quoteId, party, amount, currency) {
    // note amount is negative for payee and positive for payer
    return this.createQuoteParty(txn, quoteId, LOCAL_ENUM.PAYEE, LOCAL_ENUM.PAYEE_DFSP, LOCAL_ENUM.PRINCIPLE_VALUE, party, -amount, currency)
  }

  /**
     * Creates a quote party
     *
     * @returns {integer} - id of created quoteParty
     */
  async createQuoteParty (txn, quoteId, partyType, participantType, ledgerEntryType, party, amount, currency) {
    try {
      const refs = {}

      // get various enum ids (async, as parallel as possible)
      const enumVals = await Promise.all([
        this.getPartyType(partyType),
        this.getPartyIdentifierType(party.partyIdInfo.partyIdType),
        this.getParticipant(party.partyIdInfo.fspId),
        this.getTransferParticipantRoleType(participantType),
        this.getLedgerEntryType(ledgerEntryType)
      ])

      refs.partyTypeId = enumVals[0]
      refs.partyIdentifierTypeId = enumVals[1]
      refs.participantId = enumVals[2]
      refs.transferParticipantRoleTypeId = enumVals[3]
      refs.ledgerEntryTypeId = enumVals[4]

      // todo: possibly push this subIdType lookup onto the array that gets awaited async...
      // otherwise requests that have a subIdType will be a little slower due to the extra wait time
      // TODO: this will not work as the partyIdentifierType table only caters for the 8 main partyTypes
      // discuss adding a partyIdSubType database table to perform this lookup against
      if (party.partyIdInfo.partySubIdOrType) {
        // TODO: review method signature
        refs.partySubIdOrTypeId = await this.getPartyIdentifierType(party.partyIdInfo.partySubIdOrType)
      }

      // insert a new quote party
      const newQuoteParty = {
        quoteId: quoteId,
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

      this.writeLog(`inserted new quoteParty in db: ${res[0]}`)

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
        this.writeLog(`inserted new party in db: ${util.inspect(createdParty)}`)
      }
      if (party.partyIdInfo.extensionList) {
        const extensions = party.partyIdInfo.extensionList.extension
        // we need to store personal info also
        const quoteParty = await this.getTxnQuoteParty(txn, quoteId, partyType)
        for (const extension of extensions) {
          const newExtensions = {
            key: extension.key,
            value: extension.value
          }
          const createQuotePartyIdInfoExtension = await this.createQuotePartyIdInfoExtension(txn, newExtensions, quoteParty)
          this.writeLog(`inserted new QuotePartyIdInfoExtension in db: ${util.inspect(createQuotePartyIdInfoExtension)}`)
        }
      }

      return quotePartyId
    } catch (err) {
      this.writeLog(`Error in createQuoteParty: ${getStackOrInspect(err)}`)
      throw ErrorHandler.Factory.reformatFSPIOPError(err)
    }
  }

  /**
     * Returns an array of quote parties associated with the specified quote
     * that have enum values resolved to their text identifiers
     *
     * @returns {object[]}
     */
  async getQuotePartyView (quoteId) {
    try {
      const rows = await this.queryBuilder('quotePartyView')
        .where({
          quoteId: quoteId
        })
        .select()

      return rows
    } catch (err) {
      this.writeLog(`Error in getQuotePartyView: ${getStackOrInspect(err)}`)
      throw ErrorHandler.Factory.reformatFSPIOPError(err)
    }
  }

  /**
     * Returns a quote that has enum values resolved to their text identifiers
     *
     * @returns {object}
     */
  async getQuoteView (quoteId) {
    try {
      const rows = await this.queryBuilder('quoteView')
        .where({
          quoteId: quoteId
        })
        .select()

      if ((!rows) || rows.length < 1) {
        return null
      }

      if (rows.length > 1) {
        throw ErrorHandler.Factory.createInternalServerFSPIOPError(`Expected 1 row for quoteId ${quoteId} but got: ${util.inspect(rows)}`)
      }

      return rows[0]
    } catch (err) {
      this.writeLog(`Error in getQuoteView: ${getStackOrInspect(err)}`)
      throw ErrorHandler.Factory.reformatFSPIOPError(err)
    }
  }

  /**
     * Returns a quote response that has enum values resolved to their text identifiers
     *
     * @returns {object}
     */
  async getQuoteResponseView (quoteId) {
    try {
      const rows = await this.queryBuilder('quoteResponseView')
        .where({
          quoteId
        })
        .select()

      if ((!rows) || rows.length < 1) {
        return null
      }

      if (rows.length > 1) {
        throw ErrorHandler.Factory.createInternalServerFSPIOPError(`Expected 1 row for quoteId ${quoteId} but got: ${util.inspect(rows)}`)
      }

      return rows[0]
    } catch (err) {
      this.writeLog(`Error in getQuoteResponseView: ${getStackOrInspect(err)}`)
      throw ErrorHandler.Factory.reformatFSPIOPError(err)
    }
  }

  /**
     * Creates the specifid party and returns its id
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
      this.writeLog(`Error in createParty: ${getStackOrInspect(err)}`)
      throw ErrorHandler.Factory.reformatFSPIOPError(err)
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

      this.writeLog(`inserted new quote in db: ${util.inspect(quote)}`)
      return quote.quoteId
    } catch (err) {
      this.writeLog(`Error in createQuote: ${getStackOrInspect(err)}`)
      throw ErrorHandler.Factory.reformatFSPIOPError(err)
    }
  }

  async createQuotePartyIdInfoExtension (txn, extensionList, quoteParty) {
    try {
      await this.queryBuilder('quotePartyIdInfoExtension')
        .transacting(txn)
        .insert({
          quotePartyId: quoteParty.quotePartyId,
          key: extensionList.key,
          value: extensionList.value
        })
      return true
    } catch (err) {
      this.writeLog(`Error in createQuotePartyIdInfoExtension: ${getStackOrInspect(err)}`)
      throw ErrorHandler.Factory.reformatFSPIOPError(err)
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
      this.writeLog(`Error in getQuoteParty: ${getStackOrInspect(err)}`)
      throw ErrorHandler.Factory.reformatFSPIOPError(err)
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
      this.writeLog(`Error in getQuoteParty: ${getStackOrInspect(err)}`)
      throw ErrorHandler.Factory.reformatFSPIOPError(err)
    }
  }
  /**
     * Gets the specified endpoint for the specified quote party
     *
     * @returns {promise} - resolves to the endpoint base url
     */

  async getQuotePartyEndpoint (quoteId, endpointType, partyType) {
    try {
      const rows = await this.queryBuilder('participantEndpoint')
        .innerJoin('endpointType', 'participantEndpoint.endpointTypeId', 'endpointType.endpointTypeId')
        .innerJoin('quoteParty', 'quoteParty.participantId', 'participantEndpoint.participantId')
        .innerJoin('partyType', 'partyType.partyTypeId', 'quoteParty.partyTypeId')
        .innerJoin('quote', 'quote.quoteId', 'quoteParty.quoteId')
        .where('endpointType.name', endpointType)
        .andWhere('partyType.name', partyType)
        .andWhere('quote.quoteId', quoteId)
        .andWhere('participantEndpoint.isActive', 1)
        .select('participantEndpoint.value')

      if ((!rows) || rows.length < 1) {
        return null
      }

      return rows[0].value
    } catch (err) {
      this.writeLog(`Error in getQuotePartyEndpoint: ${getStackOrInspect(err)}`)
      throw ErrorHandler.Factory.reformatFSPIOPError(err)
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
      this.writeLog(`Error in getParticipantEndpoint: ${getStackOrInspect(err)}`)
      throw ErrorHandler.Factory.reformatFSPIOPError(err)
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
          quoteId: quoteId
        })
        .select()

      if ((!rows) || rows.length < 1) {
        return null
      }

      return rows[0]
    } catch (err) {
      this.writeLog(`Error in getQuoteDuplicateCheck: ${getStackOrInspect(err)}`)
      throw ErrorHandler.Factory.reformatFSPIOPError(err)
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
          quoteId: quoteId
        })
        .select()

      if ((!rows) || rows.length < 1) {
        return null
      }

      return rows[0]
    } catch (err) {
      this.writeLog(`Error in getQuoteResponseDuplicateCheck: ${getStackOrInspect(err)}`)
      throw ErrorHandler.Factory.reformatFSPIOPError(err)
    }
  }

  /**
     * Gets any transactionReference for the specified quote from the database
     *
     * @returns {object} - transaction reference or null if none found
     */
  async getTransactionReference (quoteId) {
    try {
      const rows = await this.queryBuilder('transactionReference')
        .where({
          quoteId: quoteId
        })
        .select()

      if ((!rows) || rows.length < 1) {
        return null
      }

      return rows[0]
    } catch (err) {
      this.writeLog(`Error in getTransactionReference: ${getStackOrInspect(err)}`)
      throw ErrorHandler.Factory.reformatFSPIOPError(err)
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
        quoteId: quoteId,
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

      this.writeLog(`inserted new quoteResponse in db: ${util.inspect(newQuoteResponse)}`)
      return newQuoteResponse
    } catch (err) {
      this.writeLog(`Error in createQuoteResponse: ${getStackOrInspect(err)}`)
      throw ErrorHandler.Factory.reformatFSPIOPError(err)
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
        quoteResponseId: quoteResponseId,
        value: ilpPacket
      }

      const res = await this.queryBuilder('quoteResponseIlpPacket')
        .transacting(txn)
        .insert(newPacket)

      this.writeLog(`inserted new quoteResponseIlpPacket in db: ${util.inspect(res)}`)
      return res
    } catch (err) {
      this.writeLog(`Error in createIlpPacket: ${getStackOrInspect(err)}`)
      throw ErrorHandler.Factory.reformatFSPIOPError(err)
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

      this.writeLog(`inserted new geoCode in db: ${util.inspect(newGeoCode)}`)
      return res
    } catch (err) {
      this.writeLog(`Error in createGeoCode: ${getStackOrInspect(err)}`)
      throw ErrorHandler.Factory.reformatFSPIOPError(err)
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

      this.writeLog(`inserted new quoteError in db: ${util.inspect(newError)}`)
      return res
    } catch (err) {
      this.writeLog(`Error in createQuoteError: ${getStackOrInspect(err)}`)
      throw ErrorHandler.Factory.reformatFSPIOPError(err)
    }
  }

  /**
     * Creates quoteExtensions rows
     *
     * @returns {object}
     * @param   {Array[{object}]} extensions - array of extension objects with quoteId, key and value properties
     */
  async createQuoteExtensions (txn, extensions, quoteId, transactionId, quoteResponseId = undefined) {
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

      this.writeLog(`inserted new quoteExtensions in db: ${util.inspect(newExtensions)}`)
      return res
    } catch (err) {
      this.writeLog(`Error in createQuoteExtensions: ${getStackOrInspect(err)}`)
      throw ErrorHandler.Factory.reformatFSPIOPError(err)
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

  /**
     * Writes a formatted log message to the console
     */
  // eslint-disable-next-line no-unused-vars
  writeLog (message) {
    Logger.debug(`${new Date().toISOString()}, [quotesdatabase]: ${message}`)
  }
}

module.exports = Database
