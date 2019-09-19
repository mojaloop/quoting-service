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

'use strict'

const util = require('util')
const Knex = require('knex')

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
    this.queryBuilder = Knex(this.config)

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
      this.writeLog(`Error in getTransferRules: ${err.stack || util.inspect(err)}`)
      throw err
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
        throw new Error(`Unsupported initiatorType '${initiatorType}'`)
      }
      return rows[0].transactionInitiatorTypeId
    } catch (err) {
      this.writeLog(`Error in getInitiatorType: ${err.stack || util.inspect(err)}`)
      throw err
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
        throw new Error(`Unsupported initiator '${initiator}'`)
      }
      return rows[0].transactionInitiatorId
    } catch (err) {
      this.writeLog(`Error in getInitiator: ${err.stack || util.inspect(err)}`)
      throw err
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
      this.writeLog(`Error in getScenario: ${err.stack || util.inspect(err)}`)
      throw err
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
        throw new Error(`Unsupported transaction sub-scenario '${subScenario}'`)
      }
      return rows[0].transactionSubScenarioId
    } catch (err) {
      this.writeLog(`Error in getSubScenario: ${err.stack || util.inspect(err)}`)
      throw err
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
        throw new Error(`Unsupported amount type '${amountType}'`)
      }
      return rows[0].amountTypeId
    } catch (err) {
      this.writeLog(`Error in getAmountType: ${err.stack || util.inspect(err)}`)
      throw err
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
      this.writeLog(`Error in createTransactionReference: ${err.stack || util.inspect(err)}`)
      throw err
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
      this.writeLog(`Error in createQuoteDuplicateCheck: ${err.stack || util.inspect(err)}`)
      throw err
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
      this.writeLog(`Error in createQuoteUpdateDuplicateCheck: ${err.stack || util.inspect(err)}`)
      throw err
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
        throw new Error(`Unsupported party type '${partyType}'`)
      }

      return rows[0].partyTypeId
    } catch (err) {
      this.writeLog(`Error in getPartyType: ${err.stack || util.inspect(err)}`)
      throw err
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
        throw new Error(`Unsupported party identifier type '${partyIdentifierType}'`)
      }

      return rows[0].partyIdentifierTypeId
    } catch (err) {
      this.writeLog(`Error in getPartyIdentifierType: ${err.stack || util.inspect(err)}`)
      throw err
    }
  }

  /**
     * Gets the id of the specified participant
     *
     * @returns {promise} - id of the participant
     */
  async getParticipant (participantName) {
    try {
      const rows = await this.queryBuilder('participant')
        .where({
          name: participantName,
          isActive: 1
        })
        .select()

      if ((!rows) || rows.length < 1) {
        // active participant does not exist, this is an error
        throw new Error(`Unsupported participant '${participantName}'`)
      }

      return rows[0].participantId
    } catch (err) {
      this.writeLog(`Error in getPartyIdentifierType: ${err.stack || util.inspect(err)}`)
      throw err
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
        throw new Error(`Unsupported transfer participant role type '${name}'`)
      }

      return rows[0].transferParticipantRoleTypeId
    } catch (err) {
      this.writeLog(`Error in getTransferParticipantRoleType: ${err.stack || util.inspect(err)}`)
      throw err
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
        throw new Error(`Unsupported ledger entry type '${name}'`)
      }

      return rows[0].ledgerEntryTypeId
    } catch (err) {
      this.writeLog(`Error in getLedgerEntryType: ${err.stack || util.inspect(err)}`)
      throw err
    }
  }

  /**
     * Creates a payer quote party
     *
     * @returns {promise}
     */
  async createPayerQuoteParty (txn, quoteId, party, amount, currency) {
    // note amount is negative for payee and positive for payer
    return this.createQuoteParty(txn, quoteId, 'PAYER', 'PAYER_DFSP', 'PRINCIPLE_VALUE', party, amount, currency)
  }

  /**
     * Creates a payee quote party
     *
     * @returns {promise}
     */
  async createPayeeQuoteParty (txn, quoteId, party, amount, currency) {
    // note amount is negative for payee and positive for payer
    return this.createQuoteParty(txn, quoteId, 'PAYEE', 'PAYEE_DFSP', 'PRINCIPLE_VALUE', party, -amount, currency)
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
      if (party.partyIdInfo.partySubIdOrType) {
        refs.partySubIdOrTypeId = await this.getPartyIdentifierType(txn, party.partyIdInfo.partySubIdOrType)
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
        amount: amount,
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

      return quotePartyId
    } catch (err) {
      this.writeLog(`Error in createQuoteParty: ${err.stack || util.inspect(err)}`)
      throw err
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
      this.writeLog(`Error in getQuotePartyView: ${err.stack || util.inspect(err)}`)
      throw err
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
        throw new Error(`Expected 1 row for quoteId ${quoteId} but got: ${util.inspect(rows)}`)
      }

      return rows[0]
    } catch (err) {
      this.writeLog(`Error in getQuoteView: ${err.stack || util.inspect(err)}`)
      throw err
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
          quoteId: quoteId
        })
        .select()

      if ((!rows) || rows.length < 1) {
        return null
      }

      if (rows.length > 1) {
        throw new Error(`Expected 1 row for quoteId ${quoteId} but got: ${util.inspect(rows)}`)
      }

      return rows[0]
    } catch (err) {
      this.writeLog(`Error in getQuoteResponseView: ${err.stack || util.inspect(err)}`)
      throw err
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
        quotePartyId: quotePartyId
      }

      const res = await this.queryBuilder('party')
        .transacting(txn)
        .insert(newParty)

      newParty.partyId = res[0]
      return newParty
    } catch (err) {
      this.writeLog(`Error in createParty: ${err.stack || util.inspect(err)}`)
      throw err
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
          amount: quote.amount,
          currencyId: quote.currencyId
        })

      this.writeLog(`inserted new quote in db: ${util.inspect(quote)}`)
      return quote.quoteId
    } catch (err) {
      this.writeLog(`Error in createQuote: ${err.stack || util.inspect(err)}`)
      throw err
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
        throw new Error(`Expected 1 quoteParty row for quoteId ${quoteId} and partyType ${partyType} but got: ${util.inspect(rows)}`)
      }

      return rows[0]
    } catch (err) {
      this.writeLog(`Error in getQuoteParty: ${err.stack || util.inspect(err)}`)
      throw err
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
        .select('participantEndpoint.value')

      if ((!rows) || rows.length < 1) {
        return null
      }

      return rows[0].value
    } catch (err) {
      this.writeLog(`Error in getQuotePartyEndpoint: ${err.stack || util.inspect(err)}`)
      throw err
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
        .select('participantEndpoint.value')

      if ((!rows) || rows.length < 1) {
        return null
      }

      return rows[0].value
    } catch (err) {
      this.writeLog(`Error in getParticipantEndpoint: ${err.stack || util.inspect(err)}`)
      throw err
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
      this.writeLog(`Error in getQuoteDuplicateCheck: ${err.stack || util.inspect(err)}`)
      throw err
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
      this.writeLog(`Error in getQuoteResponseDuplicateCheck: ${err.stack || util.inspect(err)}`)
      throw err
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
      this.writeLog(`Error in getTransactionReference: ${err.stack || util.inspect(err)}`)
      throw err
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
        transferAmount: quoteResponse.transferAmount.amount,
        payeeReceiveAmountCurrencyId: quoteResponse.payeeReceiveAmount ? quoteResponse.payeeReceiveAmount.currency : null,
        payeeReceiveAmount: quoteResponse.payeeReceiveAmount ? quoteResponse.payeeReceiveAmount.amount : null,
        payeeFspFeeCurrencyId: quoteResponse.payeeFspFee ? quoteResponse.payeeFspFee.currency : null,
        payeeFspFeeAmount: quoteResponse.payeeFspFee ? quoteResponse.payeeFspFee.amount : null,
        payeeFspCommissionCurrencyId: quoteResponse.payeeFspCommission ? quoteResponse.payeeFspCommission.currency : null,
        payeeFspCommissionAmount: quoteResponse.payeeFspCommission ? quoteResponse.payeeFspCommission.amount : null,
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
      this.writeLog(`Error in createQuoteResponse: ${err.stack || util.inspect(err)}`)
      throw err
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
      this.writeLog(`Error in createIlpPacket: ${err.stack || util.inspect(err)}`)
      throw err
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
      this.writeLog(`Error in createGeoCode: ${err.stack || util.inspect(err)}`)
      throw err
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
      this.writeLog(`Error in createQuoteError: ${err.stack || util.inspect(err)}`)
      throw err
    }
  }

  /**
     * Writes a formatted log message to the console
     */
  // eslint-disable-next-line no-unused-vars
  writeLog (message) {
    // eslint-disable-next-line no-console
    // console.log(`${new Date().toISOString()}, [quotesdatabase]: ${message}`)
  }
}

module.exports = Database
