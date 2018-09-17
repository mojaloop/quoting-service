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
    connect() {
        return new Promise((resolve, reject) => {
            this.queryBuilder = Knex(this.config);
            console.log(`Connected to database with config: ${util.inspect(this.config)}`);
            resolve(this);
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
            console.log(`Error in getTransferRules: ${err.stack || util.inspect(err)}`);
            throw err;
        }
    }


    /**
     * Gets the id of the specified transaction initiator type
     *
     * @returns {promise} - id of the transactionInitiatorType
     */
    getInitiatorType(txn, initiatorType) {
        return new Promise((resolve, reject) => {
            return this.queryBuilder('transactionInitiatorType')
                .transacting(txn)
                .where('name', initiatorType)
                .select()
                .then(rows => {
                    if((!rows) || rows.length < 1) {
                        //initiatorType does not exist, this is an error
                        return reject(new Error(`Unsupported initiatorType \'${initiatorType}\'`));
                    }
                    return resolve(rows[0].transactionInitiatorTypeId);
                })
                .catch(err => {
                    console.log(`Error in getInitiatorType: ${err.stack || util.inspect(err)}`);
                    return reject(err);
                });
        });
    }


    /**
     * Gets the id of the specified transaction initiator
     *
     * @returns {promise} - id of the transactionInitiator
     */
    getInitiator(txn, initiator) {
        return new Promise((resolve, reject) => {
            return this.queryBuilder('transactionInitiator')
                .transacting(txn)
                .where('name', initiator)
                .select()
                .then(rows => {
                    if((!rows) || rows.length < 1) {
                        //initiator does not exist, this is an error
                        return reject(new Error(`Unsupported initiator \'${initiator}\'`));
                    }
                    resolve(rows[0].transactionInitiatorId);
                })
                .catch(err => {
                    console.log(`Error in getInitiator: ${err.stack || util.inspect(err)}`);
                    reject(err);
                });
        });
    }


    /**
     * Gets the id of the specified transaction scenario
     *
     * @returns {promise} - id of the transactionScenario
     */
    getScenario(txn, scenario) {
        return new Promise((resolve, reject) => {
            return this.queryBuilder('transactionScenario')
                .transacting(txn)
                .where('name', scenario)
                .select()
                .then(rows => {
                    if((!rows) || rows.length < 1) {
                        //scenario does not exist, this is an error
                        return reject(new Error(`Unsupported transaction scenario \'${scenario}\'`));
                    }
                    resolve(rows[0].transactionScenarioId);
                })
                .catch(err => {
                    console.log(`Error in getScenario: ${err.stack || util.inspect(err)}`);
                    reject(err);
                });
        });
    }


    /**
     * Gets the id of the specified transaction sub-scenario
     *
     * @returns {promise} - id of the transactionSubScenario
     */
    getSubScenario(txn, subScenario) {
        return new Promise((resolve, reject) => {
            return this.queryBuilder('transactionSubScenario')
                .transacting(txn)
                .where('name', subScenario)
                .select()
                .then(rows => {
                    if((!rows) || rows.length < 1) {
                        //sub-scenario does not exist, this is an error
                        return reject(new Error(`Unsupported transaction sub-scenario \'${subScenario}\'`));
                    }
                    resolve(rows[0].transactionSubScenarioId);
                })
                .catch(err => {
                    console.log(`Error in getSubScenario: ${err.stack || util.inspect(err)}`);
                    reject(err);
                });
        });
    }


    /**
     * Gets the id of the specified amount type
     *
     * @returns {promise} - id of the amountType
     */
    getAmountType(txn, amountType) {
        return new Promise((resolve, reject) => {
            return this.queryBuilder('amountType')
                .transacting(txn)
                .where('name', amountType)
                .select()
                .then(rows => {
                    if((!rows) || rows.length < 1) {
                        //amount type does not exist, this is an error
                        return reject(new Error(`Unsupported amount type \'${amountType}\'`));
                    }
                    resolve(rows[0].amountTypeId);
                })
                .catch(err => {
                    console.log(`Error in getAmountType: ${err.stack || util.inspect(err)}`);
                    reject(err);
                });
        });
    }


    /**
     * Creates a transaction reference in the database
     *
     * @returns {promise}
     */
    createTransactionReference(txn, quoteId, transactionReferenceId) {
        return new Promise((resolve, reject) => {
            return this.queryBuilder('transactionReference')
                .transacting(txn)
                .insert({
                    quoteId: quoteId,
                    transactionReferenceId: transactionReferenceId
                })
                .then(res => {
                    console.log(`inserted new transactionReference in db: ${transactionReferenceId}`);
                    resolve(transactionReferenceId);
                })
                .catch(err => {
                    console.log(`Error in createTransactionReference: ${err.stack || util.inspect(err)}`);
                    reject(err);
                });
        });
    }


    /**
     * Creates an entry in quoteDuplicateCheck
     *
     * @returns {promise} - quoteId
     */
    createQuoteDuplicateCheck(txn, quoteId, hash) {
        return new Promise((resolve, reject) => {
            return this.queryBuilder('quoteDuplicateCheck')
                .transacting(txn)
                .insert({
                    quoteId: quoteId //,
                    //hash: hash
                })
                .then(res => {
                    console.log(`inserted new quote duplicate check in db: ${quoteId}`);
                    resolve(quoteId);
                })
                .catch(err => {
                    console.log(`Error in createQuoteDuplicateCheck: ${err.stack || util.inspect(err)}`);
                    reject(err);
                });
        });
    }


    /**
     * Gets the id of the specified party type
     *
     * @returns {promise} - id of the partyType
     */
    getPartyType(txn, partyType) {
        return new Promise((resolve, reject) => {
            return this.queryBuilder('partyType')
                .transacting(txn)
                .where('name', partyType)
                .select()
                .then(rows => {
                    if((!rows) || rows.length < 1) {
                        //party type does not exist, this is an error
                        return reject(new Error(`Unsupported party type \'${partyType}\'`));
                    }
                    resolve(rows[0].partyTypeId);
                })
                .catch(err => {
                    console.log(`Error in getPartyType: ${err.stack || util.inspect(err)}`);
                    reject(err);
                });
        });
    }


    /**
     * Gets the id of the specified party identifier type
     *
     * @returns {promise} - id of the partyIdentifierType
     */
    getPartyIdentifierType(txn, partyIdentifierType) {
        return new Promise((resolve, reject) => {
            return this.queryBuilder('partyIdentifierType')
                .transacting(txn)
                .where('name', partyIdentifierType)
                .select()
                .then(rows => {
                    if((!rows) || rows.length < 1) {
                        //identifier type does not exist, this is an error
                        return reject(new Error(`Unsupported party identifier type \'${partyIdentifierType}\'`));
                    }
                    resolve(rows[0].partyIdentifierTypeId);
                })
                .catch(err => {
                    console.log(`Error in getPartyIdentifierType: ${err.stack || util.inspect(err)}`);
                    reject(err);
                });
        });
    }


    /**
     * Gets the id of the specified participant
     *
     * @returns {promise} - id of the participant
     */
    getParticipant(txn, participantName) {
        return new Promise((resolve, reject) => {
            return this.queryBuilder('participant')
                .transacting(txn)
                .where({
                    name: participantName,
                    isActive: 1
                })
                .select()
                .then(rows => {
                    if((!rows) || rows.length < 1) {
                        //active participant does not exist, this is an error
                        return reject(new Error(`Unsupported participant \'${participantName}\'`));
                    }
                    resolve(rows[0].participantId);
                })
                .catch(err => {
                    console.log(`Error in getPartyIdentifierType: ${err.stack || util.inspect(err)}`);
                    reject(err);
                });
        });
    }


    /**
     * Gets the id of the specified transfer participant role type
     *
     * @returns {promise} - id of the transfer participant role type
     */
    getTransferParticipantRoleType(txn, name) {
        return new Promise((resolve, reject) => {
            return this.queryBuilder('transferParticipantRoleType')
                .transacting(txn)
                .where({
                    name: name,
                    isActive: 1
                })
                .select()
                .then(rows => {
                    if((!rows) || rows.length < 1) {
                        //active role type does not exist, this is an error
                        return reject(new Error(`Unsupported transfer participant role type \'${name}\'`));
                    }
                    resolve(rows[0].transferParticipantRoleTypeId);
                })
                .catch(err => {
                    console.log(`Error in getTransferParticipantRoleType: ${err.stack || util.inspect(err)}`);
                    reject(err);
                });
        });
    }


    /**
     * Gets the id of the specified ledger entry type
     *
     * @returns {promise} - id of the ledger entry type
     */
    getLedgerEntryType(txn, name) {
        return new Promise((resolve, reject) => {
            return this.queryBuilder('ledgerEntryType')
                .transacting(txn)
                .where({
                    name: name,
                    isActive: 1
                })
                .select()
                .then(rows => {
                    if((!rows) || rows.length < 1) {
                        //active ledger entry type does not exist, this is an error
                        return reject(new Error(`Unsupported ledger entry type \'${name}\'`));
                    }
                    resolve(rows[0].ledgerEntryTypeId);
                })
                .catch(err => {
                    console.log(`Error in getLedgerEntryType: ${err.stack || util.inspect(err)}`);
                    reject(err);
                });
        });
    }


    /**
     * Creates a payer quote party
     *
     * @returns {promise}
     */
    createPayerQuoteParty(txn, quoteId, party, amount, currency) {
        //note amount is negative for payer and positive for payee
        return this.createQuoteParty(txn, quoteId, 'PAYER', 'PAYER_DFSP', 'PRINCIPLE_VALUE', party, -amount, currency);   
    }


    /**
     * Creates a payee quote party
     *
     * @returns {promise}
     */
    createPayeeQuoteParty(txn, quoteId, party, amount, currency) {
        //note amount is negative for payer and positive for payee
        return this.createQuoteParty(txn, quoteId, 'PAYEE', 'PAYEE_DFSP', 'PRINCIPLE_VALUE', party, amount, currency);
    }


    /**
     * Creates the quote parties for a payee dfsp for a quote response that includes fees
     *
     * @returns {promise}
     */
    createPayeeDfspQuoteParties(txn, quoteId, feeAmount, commissionAmount) {
        throw new Error(`createPayeeDfspQuoteParties method not implemented`);
    }


    createQuoteParty(txn, quoteId, partyType, participantType, ledgerEntryType, party, amount, currency) {
        return new Promise((resolve, reject) => {
            let refs = {};
            let quotePartyId = null;

            //get the party type id
            return this.getPartyType(txn, partyType)
                .then(id => {
                    refs.partyTypeId = id;

                        //get the party identifier type id
                        return this.getPartyIdentifierType(txn, party.partyIdInfo.partyIdType);
                    }).then(id => {
                        refs.partyIdentifierTypeId = id;

                        //do we have a subid?
                        if(party.partyIdInfo.partySubIdOrType) {
                            return this.getPartyIdentifierType(txn, party.partyIdInfo.partySubIdOrType)
                                .then(id => {
                                    refs.partySubIdOrTypeId = id;
                                });
                        }
                        return Promise.resolve();
                    }).then(() => {
                        //get participant id for fsp
                        return this.getParticipant(txn, party.partyIdInfo.fspId);
                    }).then(id => {
                        refs.participantId = id;

                        return this.getTransferParticipantRoleType(txn, participantType);
                    }).then(id => {
                        refs.transferParticipantRoleTypeId = id;

                        return this.getLedgerEntryType(txn, ledgerEntryType);
                    }).then(id => {
                        refs.ledgerEntryTypeId = id;

                        //insert a quote party
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

                        console.log(`${util.inspect(newQuoteParty)}`);

                        return this.queryBuilder('quoteParty')
                            .transacting(txn)
                            .insert(newQuoteParty)
                            .then(res => {
                                console.log(`inserted new quoteParty in db: ${res[0]}`);
                                //hold on to the created quotePartyId so we can return it at the end of the promise chain
                                quotePartyId = res[0];

                                if(party.personalInfo) {
                                    //we need to store personal info also
                                    let newParty = {
                                        firstName: party.personalInfo.complexName.firstName,
                                        middleName : party.personalInfo.complexName.middleName,
                                        lastName: party.personalInfo.complexName.lastName,
                                        dateOfBirth: party.personalInfo.dateOfBirth
                                    };

                                    return this.createParty(txn, quotePartyId, newParty);
                                }

                                return Promise.resolve();
                            })
                            .then(() => {
                                return resolve(quotePartyId);
                            })
                            .catch(err => {
                                console.log(`Error in createQuoteParty: ${err.stack || util.inspect(err)}`);
                                reject(err);
                            });
                    })
                    .catch(err => {
                        console.log(`Error in createQuoteParty ${partyType}: ${err.stack || util.inspect(err)}`);
                        reject(err);
                    });
            });
    }


    /**
     * Creates the specifid party and returns its id
     *
     * @returns {promise} - id of party
     */
    createParty(txn, quotePartyId, party) {
        return new Promise((resolve, reject) => {
            let newParty = {
                ...party,
                quotePartyId: quotePartyId
            };

            return this.queryBuilder('party')
                .transacting(txn)
                .insert(newParty)
                .then(res => {
                    console.log(`inserted new party in db: ${res[0]}`);
                    newParty.partyId = res[0];
                    resolve(newParty);
                })
                .catch(err => {
                    reject(err);
                });
        });
    }


    /**
     * Creates a quote in the database
     *
     * @returns {promise}
     */
    createQuote(txn, quote) {
        return new Promise((resolve, reject) => {
            return this.queryBuilder('quote')
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
                .then(res => {
                    console.log(`inserted new quote in db: ${util.inspect(quote)}`);
                    resolve(quote.quoteId);
                })
                .catch(err => {
                    console.log(`Error in createQuote: ${err.stack || util.inspect(err)}`);
                    reject(err);
                });
        });
    }


    /**
     * Gets the specified endpoint for the specified quote party
     *
     * @returns {undefined}
     */
    getQuotePartyEndpoint(txn, endpointType, quotePartyId) {
        return new Promise((resolve, reject) => {
            return this.queryBuilder()
                .transacting(txn)
                .select('');
        });

    }

}


module.exports = Database;
