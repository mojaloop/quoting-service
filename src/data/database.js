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
     * Ensures the specified transaction initiator type is present in the database and returns its id
     *
     * @returns {promise} - id of the transactionInitiatorType
     */
    ensureInitiatorType(txn, initiatorType) {
        return new Promise((resolve, reject) => {
            return this.queryBuilder('transactionInitiatorType')
                .transacting(txn)
                .where('name', initiatorType)
                .select()
                .then(rows => {
                    if((!rows) || rows.length < 1) {
                        //we need to insert this initiator type
                        return this.queryBuilder('transactionInitiatorType')
                            .transacting(txn)
                            .insert({
                                name: initiatorType
                            })
                            .then(res => {
                                console.log(`inserted new transactionInitiatorType in db: ${res[0]}`);
                                resolve(res[0]);
                            })
                            .catch(err => {
                                reject(err);
                            });
                    }
                    resolve(rows[0].transactionInitiatorTypeId);
                })
                .catch(err => {
                    console.log(`Error in ensureInitiatorType: ${err.stack || util.inspect(err)}`);
                    reject(err);
                });
        });
    }


    /**
     * Ensures the specified transaction initiator is present in the database and returns its id
     *
     * @returns {promise} - id of the transactionInitiator
     */
    ensureInitiator(txn, initiator) {
        return new Promise((resolve, reject) => {
            return this.queryBuilder('transactionInitiator')
                .transacting(txn)
                .where('name', initiator)
                .select()
                .then(rows => {
                    if((!rows) || rows.length < 1) {
                        //we need to insert this initiator
                        return this.queryBuilder('transactionInitiator')
                            .transacting(txn)
                            .insert({
                                name: initiator
                            })
                            .then(res => {
                                console.log(`inserted new transactionInitiator in db: ${res[0]}`);
                                resolve(res[0]);
                            })
                            .catch(err => {
                                reject(err);
                            });
                    }
                    resolve(rows[0].transactionInitiatorId);
                })
                .catch(err => {
                    console.log(`Error in ensureInitiator: ${err.stack || util.inspect(err)}`);
                    reject(err);
                });
        });
    }


    /**
     * Ensures the specified transaction scenario is present in the database and returns its id
     *
     * @returns {promise} - id of the transactionScenario
     */
    ensureScenario(txn, scenario) {
        return new Promise((resolve, reject) => {
            return this.queryBuilder('transactionScenario')
                .transacting(txn)
                .where('name', scenario)
                .select()
                .then(rows => {
                    if((!rows) || rows.length < 1) {
                        //we need to insert this scenario
                        return this.queryBuilder('transactionScenario')
                            .transacting(txn)
                            .insert({
                                name: scenario
                            })
                            .then(res => {
                                console.log(`inserted new transactionScenario in db: ${res[0]}`);
                                resolve(res[0]);
                            })
                            .catch(err => {
                                reject(err);
                            });
                    }
                    resolve(rows[0].transactionScenarioId);
                })
                .catch(err => {
                    console.log(`Error in ensureScenario: ${err.stack || util.inspect(err)}`);
                    reject(err);
                });
        });
    }


    /**
     * Ensures the specified amount type is present in the database and returns its id
     *
     * @returns {promise} - id of the amountType
     */
    ensureAmountType(txn, amountType) {
        return new Promise((resolve, reject) => {
            return this.queryBuilder('amountType')
                .transacting(txn)
                .where('name', amountType)
                .select()
                .then(rows => {
                    if((!rows) || rows.length < 1) {
                        //we need to insert this amount type
                        return this.queryBuilder('amountType')
                            .transacting(txn)
                            .insert({
                                name: amountType
                            })
                            .then(res => {
                                console.log(`inserted new amountType in db: ${res[0]}`);
                                resolve(res[0]);
                            })
                            .catch(err => {
                                reject(err);
                            });
                    }
                    resolve(rows[0].amountTypeId);
                })
                .catch(err => {
                    console.log(`Error in ensureAmountType: ${err.stack || util.inspect(err)}`);
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
     * Ensures the specified party type is present in the database and returns its id
     *
     * @returns {promise} - id of the partyType
     */
    ensurePartyType(txn, partyType) {
        return new Promise((resolve, reject) => {
            return this.queryBuilder('partyType')
                .transacting(txn)
                .where('name', partyType)
                .select()
                .then(rows => {
                    if((!rows) || rows.length < 1) {
                        //we need to insert this party type
                        return this.queryBuilder('partyType')
                            .transacting(txn)
                            .insert({
                                name: partyType
                            })
                            .then(res => {
                                console.log(`inserted new partyType in db: ${res[0]}`);
                                resolve(res[0]);
                            })
                            .catch(err => {
                                reject(err);
                            });
                    }
                    resolve(rows[0].partyTypeId);
                })
                .catch(err => {
                    console.log(`Error in ensurePartyType: ${err.stack || util.inspect(err)}`);
                    reject(err);
                });
        });
    }


    /**
     * Ensures the specified party identifier type is present in the database and returns its id
     *
     * @returns {promise} - id of the partyIdentifierType
     */
    ensurePartyIdentifierType(txn, partyIdentifierType) {
        return new Promise((resolve, reject) => {
            return this.queryBuilder('partyIdentifierType')
                .transacting(txn)
                .where('name', partyIdentifierType)
                .select()
                .then(rows => {
                    if((!rows) || rows.length < 1) {
                        //we need to insert this party identifier type
                        return this.queryBuilder('partyIdentifierType')
                            .transacting(txn)
                            .insert({
                                name: partyIdentifierType
                            })
                            .then(res => {
                                console.log(`inserted new partyIdentifierType in db: ${res[0]}`);
                                resolve(res[0]);
                            })
                            .catch(err => {
                                reject(err);
                            });
                    }
                    resolve(rows[0].partyIdentifierTypeId);
                })
                .catch(err => {
                    console.log(`Error in ensurePartyIdentifierType: ${err.stack || util.inspect(err)}`);
                    reject(err);
                });
        });
    }


    /**
     * Creates a payer quote party
     *
     * @returns {promise}
     */
    createPayerQuoteParty(txn, quoteId, party) {
        return this.createQuoteParty(txn, quoteId, 'PAYER', party);   
    }


    /**
     * Create
     *
     * @returns {undefined}
     */
    createPayeeQuoteParty(txn, quoteId, party) {
        return this.createQuoteParty(txn, quoteId, 'PAYEE', party);
    }

    
    createQuoteParty(txn, quoteId, partyType, party) {
        return new Promise((resolve, reject) => {
            return this.ensureParty(txn, partyType, party)
                .then(pty => {
                    //insert a quote party
                    let newQuoteParty = {
                        quoteId: quoteId,
                        partyTypeId: pty.partyTypeId,
                        partyId: pty.partyId
                        //roleId: ,
                        //ledgerEntryId ,
                        //amount: ,
                        //currencyId ,
                        //geoCodeId ,
                    };

                    return this.queryBuilder('quoteParty')
                        .transacting(txn)
                        .insert(newQuoteParty)
                        .then(res => {
                            console.log(`inserted new quoteParty in db: ${res[0]}`);
                            resolve(res[0]);
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
     * Ensures the specifid party exists and returns its id
     *
     * @returns {promise} - id of party
     */
    ensureParty(txn, partyType, party) {
        return new Promise((resolve, reject) => {
            let refs = {};

            //ensure party type exists
            this.ensurePartyType(txn, partyType)
                .then(partyTypeId => {
                    refs.partyTypeId = partyTypeId;

                    //ensure party identifier type exists
                    return this.ensurePartyIdentifierType(txn, party.partyIdInfo.partyIdType);
                }).then(id => {
                    refs.partyIdentifierTypeId = id;

                    //construct a unique key for the party
                    //todo: use proper algorithm - ask Warren Carew.
                    let key = `${refs.partyTypeId}-${refs.partyIdentifierTypeId}-${party.partyIdInfo.partyIdentifier}`;

                    //construct the new party row
                    let newParty = {
                        partyTypeId: refs.partyTypeId,
                        typeValue: partyType,
                        //for now use party type, identifier type and identifier as unique party identifier
                        key: key,
                        partyIdentifierTypeId: refs.partyIdentifierTypeId,
                        identifierValue: party.partyIdInfo.partyIdentifier
                    };

                    //add personal info if it is present
                    if(party.personalInfo && party.personalInfo.complexName) {
                        newParty.firstName = party.personalInfo.complexName.firstName;
                        newParty.lastName = party.personalInfo.complexName.lastName;
                        newParty.middleName = party.personalInfo.complexName.middleName;
                    }
                    
                    //does this party already exist?
                    return this.queryBuilder('party')
                        .transacting(txn)
                        .where('key', key)
                        .select()
                        .then(rows => {
                            if((!rows) || rows.length < 1) {
                                //we need to insert the party
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
                            }
                            resolve(rows[0]);
                        })
                        .catch(err => {
                            console.log(`Error in ensureParty: ${err.stack || util.inspect(err)}`);
                            reject(err);
                        });
                })
                .catch(err => {
                    console.log(`Error in ensureParty: ${err.stack || util.inspect(err)}`);
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
                    expirationDate: quote.expiration,
                    transactionInitiatorId: quote.transactionInitiatorId,
                    transactionInitiatorTypeId: quote.transactionInitiatorTypeId,
                    transactionScenarioId: quote.transactionScenarioId,
                    //balanceOfPaymentsId: ,
                    //transactionSubScenarioId: ,
                    amountTypeId: quote.amountTypeId,
                    //amount: ,
                    //currencyId: ,
                    //createdDate: ,
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

}


module.exports = Database;
