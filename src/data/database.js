'use strict';

const util = require('util');
const Knex = require('knex');


/**
 * Abstracts operations against the database
 */
class Database {
    constructor(config) {
        this.config = config;
    }


    /**
     * Connects to the database and returns a self reference
     *
     * @returns {promise}
     */
    async connect() {
        this.queryBuilder = Knex(this.config);
        this.writeLog(`Connected to database with config: ${util.inspect(this.config)}`);
        return this;
    }


    /**
     * async utility for getting a transaction object from knex
     *
     * @returns {undefined}
     */
    async newTransaction() {
        return new Promise((resolve, reject) => {
            try {
                this.queryBuilder.transaction(txn => {
                    return resolve(txn);
                });
            }
            catch(err) {
                return reject(err);
            }
        });
    }

    /**
     * Gets the set of enabled transfer rules
     *
     * @returns {promise} - all enabled transfer rules
     */
    async getTransferRules(txn) {
        try {
            const rows = await this.queryBuilder('transferRules')
                .transacting(txn)
                .where('enabled', true)
                .select();
            return rows.map(r => JSON.parse(r.rule));
        }
        catch(err) {
            this.writeLog(`Error in getTransferRules: ${err.stack || util.inspect(err)}`);
            throw err;
        }
    }


    /**
     * Gets the id of the specified transaction initiator type
     *
     * @returns {promise} - id of the transactionInitiatorType
     */
    async getInitiatorType(txn, initiatorType) {
        try {
            const rows = await this.queryBuilder('transactionInitiatorType')
                .transacting(txn)
                .where('name', initiatorType)
                .select();

            if((!rows) || rows.length < 1) {
                //initiatorType does not exist, this is an error
                throw new Error(`Unsupported initiatorType \'${initiatorType}\'`);
            }
            return rows[0].transactionInitiatorTypeId;
        }
        catch(err) {
            this.writeLog(`Error in getInitiatorType: ${err.stack || util.inspect(err)}`);
            throw err;
        }
    }


    /**
     * Gets the id of the specified transaction initiator
     *
     * @returns {promise} - id of the transactionInitiator
     */
    async getInitiator(txn, initiator) {
        try {
            const rows = await this.queryBuilder('transactionInitiator')
                .transacting(txn)
                .where('name', initiator)
                .select();

            if((!rows) || rows.length < 1) {
                //initiator does not exist, this is an error
                throw new Error(`Unsupported initiator \'${initiator}\'`);
            }
            return rows[0].transactionInitiatorId;
        }
        catch(err) {
            this.writeLog(`Error in getInitiator: ${err.stack || util.inspect(err)}`);
            throw err;
        }
    }


    /**
     * Gets the id of the specified transaction scenario
     *
     * @returns {promise} - id of the transactionScenario
     */
    async getScenario(txn, scenario) {
        try {
            const rows = await this.queryBuilder('transactionScenario')
                .transacting(txn)
                .where('name', scenario)
                .select();

            if((!rows) || rows.length < 1) {
                //scenario does not exist, this is an error
                throw new Error(`Unsupported transaction scenario \'${scenario}\'`);
            }
            return rows[0].transactionScenarioId;
        }
        catch(err) {
            this.writeLog(`Error in getScenario: ${err.stack || util.inspect(err)}`);
            throw err;
        }
    }


    /**
     * Gets the id of the specified transaction sub-scenario
     *
     * @returns {promise} - id of the transactionSubScenario
     */
    async getSubScenario(txn, subScenario) {
        try {
            const rows = await this.queryBuilder('transactionSubScenario')
                .transacting(txn)
                .where('name', subScenario)
                .select();

            if((!rows) || rows.length < 1) {
                //sub-scenario does not exist, this is an error
                throw new Error(`Unsupported transaction sub-scenario \'${subScenario}\'`);
            }
            return rows[0].transactionSubScenarioId;
        }
        catch(err) {
            this.writeLog(`Error in getSubScenario: ${err.stack || util.inspect(err)}`);
            throw err;
        };
    }


    /**
     * Gets the id of the specified amount type
     *
     * @returns {promise} - id of the amountType
     */
    async getAmountType(txn, amountType) {
        try {
            const rows = await this.queryBuilder('amountType')
                .transacting(txn)
                .where('name', amountType)
                .select();

            if((!rows) || rows.length < 1) {
                //amount type does not exist, this is an error
                throw new Error(`Unsupported amount type \'${amountType}\'`);
            }
            return rows[0].amountTypeId;
        }
        catch(err) {
            this.writeLog(`Error in getAmountType: ${err.stack || util.inspect(err)}`);
            throw err;
        }
    }


    /**
     * Creates a transaction reference in the database
     *
     * @returns {promise}
     */
    async createTransactionReference(txn, quoteId, transactionReferenceId) {
        try {
            const res = await this.queryBuilder('transactionReference')
                .transacting(txn)
                .insert({
                    quoteId: quoteId,
                    transactionReferenceId: transactionReferenceId
                });

            this.writeLog(`inserted new transactionReference in db: ${transactionReferenceId}`);
            return transactionReferenceId;
        }
        catch(err) {
            this.writeLog(`Error in createTransactionReference: ${err.stack || util.inspect(err)}`);
            throw err;
        }
    }


    /**
     * Creates an entry in quoteDuplicateCheck
     *
     * @returns {promise} - quoteId
     */
    async createQuoteDuplicateCheck(txn, quoteId, hash) {
        try {
            const res = await this.queryBuilder('quoteDuplicateCheck')
                .transacting(txn)
                .insert({
                    quoteId: quoteId,
                    hash: hash
                });

            this.writeLog(`inserted new duplicate check in db for quoteId: ${quoteId}`);
            return quoteId;
        }
        catch(err) {
            this.writeLog(`Error in createQuoteDuplicateCheck: ${err.stack || util.inspect(err)}`);
            throw err;
        }
    }


    /**
     * Gets the id of the specified party type
     *
     * @returns {promise} - id of the partyType
     */
    async getPartyType(txn, partyType) {
        try {
            const rows = await this.queryBuilder('partyType')
                .transacting(txn)
                .where('name', partyType)
                .select();

            if((!rows) || rows.length < 1) {
                //party type does not exist, this is an error
                throw new Error(`Unsupported party type \'${partyType}\'`);
            }

            return rows[0].partyTypeId;
        }
        catch(err) {
            this.writeLog(`Error in getPartyType: ${err.stack || util.inspect(err)}`);
            throw err;
        }
    }


    /**
     * Gets the id of the specified party identifier type
     *
     * @returns {promise} - id of the partyIdentifierType
     */
    async getPartyIdentifierType(txn, partyIdentifierType) {
        try {
            const rows = await this.queryBuilder('partyIdentifierType')
                .transacting(txn)
                .where('name', partyIdentifierType)
                .select();

            if((!rows) || rows.length < 1) {
                //identifier type does not exist, this is an error
                throw new Error(`Unsupported party identifier type \'${partyIdentifierType}\'`);
            }

            return rows[0].partyIdentifierTypeId;
        }
        catch(err) {
            this.writeLog(`Error in getPartyIdentifierType: ${err.stack || util.inspect(err)}`);
            throw err;
        }
    }


    /**
     * Gets the id of the specified participant
     *
     * @returns {promise} - id of the participant
     */
    async getParticipant(txn, participantName) {
        try {
            const rows = await this.queryBuilder('participant')
                .transacting(txn)
                .where({
                    name: participantName,
                    isActive: 1
                })
                .select();

            if((!rows) || rows.length < 1) {
                //active participant does not exist, this is an error
                throw new Error(`Unsupported participant \'${participantName}\'`);
            }

            return rows[0].participantId;
        }
        catch(err) {
            this.writeLog(`Error in getPartyIdentifierType: ${err.stack || util.inspect(err)}`);
            throw err;
        }
    }


    /**
     * Gets the id of the specified transfer participant role type
     *
     * @returns {promise} - id of the transfer participant role type
     */
    async getTransferParticipantRoleType(txn, name) {
        try {
            const rows = await this.queryBuilder('transferParticipantRoleType')
                .transacting(txn)
                .where({
                    name: name,
                    isActive: 1
                })
                .select();

            if((!rows) || rows.length < 1) {
                //active role type does not exist, this is an error
                throw new Error(`Unsupported transfer participant role type \'${name}\'`);
            }

            return rows[0].transferParticipantRoleTypeId;
        }
        catch(err) {
            this.writeLog(`Error in getTransferParticipantRoleType: ${err.stack || util.inspect(err)}`);
            throw err;
        }
    }


    /**
     * Gets the id of the specified ledger entry type
     *
     * @returns {promise} - id of the ledger entry type
     */
    async getLedgerEntryType(txn, name) {
        try {
            const rows = await this.queryBuilder('ledgerEntryType')
                .transacting(txn)
                .where({
                    name: name,
                    isActive: 1
                })
                .select();

            if((!rows) || rows.length < 1) {
                //active ledger entry type does not exist, this is an error
                throw new Error(`Unsupported ledger entry type \'${name}\'`);
            }

            return rows[0].ledgerEntryTypeId;
        }
        catch(err) {
            this.writeLog(`Error in getLedgerEntryType: ${err.stack || util.inspect(err)}`);
            throw err;
        }
    }


    /**
     * Creates a payer quote party
     *
     * @returns {promise}
     */
    async createPayerQuoteParty(txn, quoteId, party, amount, currency) {
        //note amount is negative for payer and positive for payee
        return this.createQuoteParty(txn, quoteId, 'PAYER', 'PAYER_DFSP', 'PRINCIPLE_VALUE', party, -amount, currency);   
    }


    /**
     * Creates a payee quote party
     *
     * @returns {promise}
     */
    async createPayeeQuoteParty(txn, quoteId, party, amount, currency) {
        //note amount is negative for payer and positive for payee
        return this.createQuoteParty(txn, quoteId, 'PAYEE', 'PAYEE_DFSP', 'PRINCIPLE_VALUE', party, amount, currency);
    }


    /**
     * Creates the quote parties for a payee dfsp for a quote response that includes fees
     *
     * @returns {promise}
     */
    async createPayeeDfspQuoteParties(txn, quoteId, feeAmount, commissionAmount) {
        throw new Error(`createPayeeDfspQuoteParties method not implemented`);
    }


    /**
     * Creates a quote party 
     *
     * @returns {integer} - id of created quoteParty
     */
    async createQuoteParty(txn, quoteId, partyType, participantType, ledgerEntryType, party, amount, currency) {
        try {
            let refs = {};

            //get various enum ids
            refs.partyTypeId = await this.getPartyType(txn, partyType);
            refs.partyIdentifierTypeId = await this.getPartyIdentifierType(txn, party.partyIdInfo.partyIdType);
            refs.participantId = await this.getParticipant(txn, party.partyIdInfo.fspId);
            refs.transferParticipantRoleTypeId = await this.getTransferParticipantRoleType(txn, participantType);
            refs.ledgerEntryTypeId = await this.getLedgerEntryType(txn, ledgerEntryType);

            if(party.partyIdInfo.partySubIdOrType) {
                refs.partySubIdOrTypeId = await this.getPartyIdentifierType(txn, party.partyIdInfo.partySubIdOrType);
            }

            //insert a new quote party
            let newQuoteParty = {
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
            };

            const res = await this.queryBuilder('quoteParty')
                .transacting(txn)
                .insert(newQuoteParty);

            this.writeLog(`inserted new quoteParty in db: ${res[0]}`);

            //hold on to the created quotePartyId so we can return it when we are done
            const quotePartyId = res[0];

            if(party.personalInfo) {
                //we need to store personal info also
                let newParty = {
                    firstName: party.personalInfo.complexName.firstName,
                    middleName : party.personalInfo.complexName.middleName,
                    lastName: party.personalInfo.complexName.lastName,
                    dateOfBirth: party.personalInfo.dateOfBirth
                };

                const createdParty = await this.createParty(txn, quotePartyId, newParty);
                this.writeLog(`inserted new party in db: ${util.inspect(createdParty)}`);
            }

            return quotePartyId;
        }
        catch(err) {
            this.writeLog(`Error in createQuoteParty: ${err.stack || util.inspect(err)}`);
            throw err;
        }
    }


    /**
     * Creates the specifid party and returns its id
     *
     * @returns {promise} - id of party
     */
    async createParty(txn, quotePartyId, party) {
        try {
            let newParty = {
                ...party,
                quotePartyId: quotePartyId
            };

            const res = await this.queryBuilder('party')
                .transacting(txn)
                .insert(newParty);

            newParty.partyId = res[0];
            return newParty;
        }
        catch(err) {
            this.writeLog(`Error in createParty: ${err.stack || util.inspect(err)}`);
            throw err;
        };
    }


    /**
     * Creates a quote in the database
     *
     * @returns {promise}
     */
    async createQuote(txn, quote) {
        try {
            const res = await this.queryBuilder('quote')
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
                });

            this.writeLog(`inserted new quote in db: ${util.inspect(quote)}`);
            return quote.quoteId;
        }
        catch(err) {
            this.writeLog(`Error in createQuote: ${err.stack || util.inspect(err)}`);
            throw err;
        }
    }


    /**
     * Gets the specified endpoint for the specified quote party
     *
     * @returns {promise} - resolves to the endpoint base url
     */
    async getQuotePartyEndpoint(txn, quoteId, endpointType, partyType) {
        try {
            const rows = await this.queryBuilder('participantEndpoint')
                .transacting(txn)
                .innerJoin('endpointType', 'participantEndpoint.endpointTypeId', 'endpointType.endpointTypeId')
                .innerJoin('quoteParty', 'quoteParty.participantId', 'participantEndpoint.participantId')
                .innerJoin('partyType', 'partyType.partyTypeId', 'quoteParty.partyTypeId')
                .innerJoin('quote', 'quote.quoteId', 'quoteParty.quoteId')
                .where('endpointType.name', endpointType)
                .andWhere('partyType.name', partyType)
                .andWhere('quote.quoteId', quoteId)
                .select('participantEndpoint.value');

            if((!rows) || rows.length < 1) {
                return null;
            }

            return rows[0].value;
        }
        catch(err) {
            this.writeLog(`Error in getQuotePartyEndpoint: ${err.stack || util.inspect(err)}`);
            throw err;
        }
    }


    /**
     * Gets the specified endpoint of the specified type for the specified participant
     *
     * @returns {promise} - resolves to the endpoint base url
     */
    async getParticipantEndpoint(txn, participantName, endpointType) {
        try {
            const rows = await this.queryBuilder('participantEndpoint')
                .transacting(txn)
                .innerJoin('participant', 'participant.participantId', 'participantEndpoint.participantId')
                .innerJoin('endpointType', 'endpointType.endpointTypeId', 'participantEndpoint.endpointTypeId')
                .where('participant.name', participantName)
                .select('participantEndpoint.value');

            if((!rows) || rows.length < 1) {
                return null;
            }

            return rows[0].value;
        }
        catch(err) {
            this.writeLog(`Error in getParticipantEndpoint: ${err.stack || util.inspect(err)}`);
            throw err;
        }
    }


    /**
     * Gets a quote duplicate check row 
     *
     * @returns {object} - quote duplicate check on null if none found
     */
    async getQuoteDuplicateCheck(txn, quoteId) {
        try {
            const rows = await this.queryBuilder('quoteDuplicateCheck')
                .transacting(txn)
                .where({
                    quoteId: quoteId
                })
                .select();

            if((!rows) || rows.length < 1) {
                return null;
            }

            return rows[0];
        }
        catch(err) {
            this.writeLog(`Error in getQuoteDuplicateCheck: ${err.stack || util.inspect(err)}`);
            throw err;
        }
    }


    /**
     * Writes a formatted log message to the console
     */
    writeLog(message) {
        console.log(`${new Date().toISOString()}, [quotesdatabase]: ${message}`);
    }
}


module.exports = Database;
