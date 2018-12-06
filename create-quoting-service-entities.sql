/*
 * (C)2018 ModusBox Inc.
 * =====================
 * Project: Casablanca
 * Original Author: James Bush
 * Description: This script creates database entities required by the Casablanca Quoting service
 */


CREATE TABLE IF NOT EXISTS amountType (
    amountTypeId INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(256) NOT NULL,
    description VARCHAR(1024) NULL,
    createDate DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL COMMENT 'System dateTime stamp pertaining to the inserted record',
    CONSTRAINT amounttype_name_unique UNIQUE (name)
);


CREATE TABLE IF NOT EXISTS balanceOfPayments (
    balanceOfPaymentsId INT UNSIGNED PRIMARY KEY,
    name VARCHAR(256) NOT NULL,
    description VARCHAR(1024) NULL COMMENT 'Possible values and meaning are defined in https://www.imf.org/external/np/sta/bopcode/',
    createDate DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL COMMENT 'System dateTime stamp pertaining to the inserted record'
) COMMENT 'Balance of Payment catergorisation as per https://www.imf.org/external/np/sta/bopcode/guide.htm';


CREATE TABLE IF NOT EXISTS partyIdentifierType (
    partyIdentifierTypeId INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    description VARCHAR(256) NOT NULL,
    CONSTRAINT partyidentifiertype_name_unique UNIQUE (name)
);


CREATE TABLE IF NOT EXISTS partyType (
    partyTypeId INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(128) NOT NULL,
    description VARCHAR(256) NOT NULL,
    CONSTRAINT partytype_name_unique UNIQUE (name)
);


CREATE TABLE IF NOT EXISTS quoteDuplicateCheck (
    quoteId VARCHAR(36) NOT NULL COMMENT 'Common ID between the FSPs for the quote object, decided by the Payer FSP' PRIMARY KEY,
    hash VARCHAR(255) NULL COMMENT 'hash value received for the quote request',
    createdDate DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL COMMENT 'System dateTime stamp pertaining to the inserted record'
);



CREATE TABLE IF NOT EXISTS transactionInitiator (
    transactionInitiatorId INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(256) NOT NULL,
    description VARCHAR(1024) NULL,
    createDate DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL COMMENT 'System dateTime stamp pertaining to the inserted record',
    CONSTRAINT transactioninitiator_name_unique UNIQUE (name)
);


CREATE TABLE IF NOT EXISTS transactionInitiatorType (
    transactionInitiatorTypeId INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(256) NOT NULL,
    description VARCHAR(1024) NULL,
    createDate DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL COMMENT 'System dateTime stamp pertaining to the inserted record',
    CONSTRAINT transactioninitiatortype_name_unique UNIQUE (name)
);


CREATE TABLE IF NOT EXISTS transactionReference (
    transactionReferenceId VARCHAR(36) NOT NULL COMMENT 'Common ID (decided by the Payer FSP) between the FSPs for the future transaction object' PRIMARY KEY,
    quoteId VARCHAR(36) NULL COMMENT 'Common ID between the FSPs for the quote object, decided by the Payer FSP',
    createdDate DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL COMMENT 'System row creation timestamp',
    CONSTRAINT transactionreference_quoteid_foreign FOREIGN KEY (quoteId)
        REFERENCES quoteDuplicateCheck (quoteId),
    INDEX transactionreference_quoteid_index (quoteId),
    INDEX transactionreference_transactionreferenceid_index (transactionReferenceId)
);


CREATE TABLE IF NOT EXISTS transactionScenario (
    transactionScenarioId INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(256) NOT NULL,
    description VARCHAR(1024) NULL,
    createDate DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL COMMENT 'System dateTime stamp pertaining to the inserted record',
    CONSTRAINT transactionscenario_name_unique UNIQUE (name),
    INDEX transactionscenario_transactionscenarioid_index (transactionScenarioId)
);


CREATE TABLE IF NOT EXISTS transactionSubScenario (
    transactionSubScenarioId INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(256) NOT NULL,
    description VARCHAR(1024) NULL COMMENT 'Possible sub-scenario, defined locally within the scheme.',
    createDate DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL COMMENT 'System dateTime stamp pertaining to the inserted record'
);


CREATE TABLE IF NOT EXISTS quote (
    quoteId VARCHAR(36) NOT NULL PRIMARY KEY,
    transactionReferenceId VARCHAR(36) NOT NULL COMMENT 'Common ID (decided by the Payer FSP) between the FSPs for the future transaction object',
    transactionRequestId VARCHAR(36) NULL COMMENT 'Optional previously-sent transaction request',
    note TEXT NULL COMMENT 'A memo that will be attached to the transaction',
    expirationDate DATETIME NULL COMMENT 'Optional expiration for the requested transaction',
    transactionInitiatorId INT UNSIGNED NOT NULL COMMENT 'This is part of the transaction initiator.',
    transactionInitiatorTypeId INT UNSIGNED NOT NULL COMMENT 'This is part of the transaction initiator type.',
    transactionScenarioId INT UNSIGNED NOT NULL COMMENT 'This is part of the transaction scenario.',
    balanceOfPaymentsId INT UNSIGNED NULL COMMENT 'This is part of the transaction type that contains the elements- balance of payment.',
    transactionSubScenarioId INT UNSIGNED NULL COMMENT 'This is part of the transaction type sub scenario as defined by the local scheme.',
    amountTypeId INT UNSIGNED NOT NULL COMMENT 'This is part of the transaction type that contains valid elements for - Amount Type.',
    amount DECIMAL(18 , 4 ) DEFAULT '0.00' NOT NULL COMMENT 'The amount that the quote is being requested for. Need to be interpert in accordance with the amount type.',
    currencyId VARCHAR(3) NULL COMMENT 'Trading currency pertaining to the Amount',
    createdDate DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL COMMENT 'System dateTime stamp pertaining to the inserted record',
    CONSTRAINT quote_quoteid_foreign FOREIGN KEY (quoteId)
        REFERENCES quoteDuplicateCheck (quoteId),
    CONSTRAINT quote_transactionreferenceid_foreign FOREIGN KEY (transactionReferenceId)
        REFERENCES transactionReference (transactionReferenceId),
    CONSTRAINT quote_transactionrequestid_foreign FOREIGN KEY (transactionRequestId)
        REFERENCES transactionReference (transactionReferenceId),
    CONSTRAINT quote_transactioninitiatorid_foreign FOREIGN KEY (transactionInitiatorId)
        REFERENCES transactionInitiator (transactionInitiatorId),
    CONSTRAINT quote_transactioninitiatortypeid_foreign FOREIGN KEY (transactionInitiatorTypeId)
        REFERENCES transactionInitiatorType (transactionInitiatorTypeId),
    CONSTRAINT quote_transactionscenarioid_foreign FOREIGN KEY (transactionScenarioId)
        REFERENCES transactionScenario (transactionScenarioId),
    CONSTRAINT quote_balanceofpaymentsid_foreign FOREIGN KEY (balanceOfPaymentsId)
        REFERENCES balanceOfPayments (balanceOfPaymentsId),
    CONSTRAINT quote_transactionsubscenarioid_foreign FOREIGN KEY (transactionSubScenarioId)
        REFERENCES transactionSubScenario (transactionSubScenarioId),
    CONSTRAINT quote_amounttypeid_foreign FOREIGN KEY (amountTypeId)
        REFERENCES amountType (amountTypeId),
    CONSTRAINT quote_currencyid_foreign FOREIGN KEY (currencyId)
        REFERENCES currency (currencyId)
);


/*
 * This comes from a 'POST /quote' request from a DFSP to the switch.
 * A quote request contains both payer and payee parties.
 * This table captures primary actionable information about the parties 
 * that is supplied with the quote request.
 * This is a Party structure as defined in "API Definition v1.0.docx"
 * section 7.4.11
*/
CREATE TABLE IF NOT EXISTS quoteParty (
    quotePartyId BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    quoteId VARCHAR(36) NOT NULL COMMENT 'Common ID between the FSPs for the quote object, decided by the Payer FSP',
    partyTypeId INT UNSIGNED NOT NULL COMMENT 'Specifies the type of party this row relates to; typically PAYER or PAYEE',
    partyIdentifierTypeId INT UNSIGNED NOT NULL COMMENT 'Specifies the type of identifier used to identify this party e.g. MSISDN, IBAN etc...',
    partyIdentifierValue VARCHAR(128) NOT NULL COMMENT 'The value of the identifier used to identify this party',
    partySubIdOrTypeId INT UNSIGNED NULL COMMENT 'A sub-identifier or sub-type for the Party',
    fspId VARCHAR(255) NULL COMMENT 'This is the FSP ID as provided in the quote. For the switch between multi-parties it is required.',
    participantId INT UNSIGNED NULL COMMENT 'Reference to the resolved FSP ID (if supplied/known). If not an error will be reported.',
    merchantClassificationCode VARCHAR(4) NULL COMMENT 'Used in the context of Payee Information, where the Payee happens to be a merchant accepting merchant payments',
    partyName VARCHAR(128) NULL COMMENT 'Display name of the Party, could be a real name or a nick name',
    transferParticipantRoleTypeId INT UNSIGNED NOT NULL COMMENT 'The role this Party is playing in the transaction',
    ledgerEntryTypeId INT UNSIGNED NOT NULL COMMENT 'The type of financial entry this Party is presenting',
    amount DECIMAL(18, 4) NOT NULL,
    currencyId VARCHAR(3) NOT NULL COMMENT 'Trading currency pertaining to the party amount',
    createdDate DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL COMMENT 'System dateTime stamp pertaining to the inserted record',

    CONSTRAINT quoteparty_quoteid_foreign FOREIGN KEY (quoteId)
        REFERENCES quote (quoteId),

    CONSTRAINT quoteparty_partytypeid_foreign FOREIGN KEY (partyTypeId)
        REFERENCES partyType (partyTypeId),

    CONSTRAINT quoteparty_partyidentifiertypeid_foreign FOREIGN KEY (partyIdentifierTypeId)
        REFERENCES partyIdentifierType (partyIdentifierTypeId),

    CONSTRAINT quoteparty_partysubidortypeid_foreign FOREIGN KEY (partySubIdOrTypeId)
        REFERENCES partyIdentifierType (partyIdentifierTypeId),

    CONSTRAINT quoteparty_participantid_foreign FOREIGN KEY (participantId)
        REFERENCES participant (participantId),

    CONSTRAINT quoteparty_transferparticipantroletypeid_foreign FOREIGN KEY (transferParticipantRoleTypeId)
        REFERENCES transferParticipantRoleType (transferParticipantRoleTypeId),

    CONSTRAINT quoteparty_ledgerentrytypeid_foreign FOREIGN KEY (ledgerEntryTypeId)
        REFERENCES ledgerEntryType (ledgerEntryTypeId),

    CONSTRAINT quoteparty_currencyid_foreign FOREIGN KEY (currencyId)
        REFERENCES currency (currencyId)
);


/*
 * This comes from a 'POST /quote' request from a DFSP to the switch.
 * A quote request contains both payer and payee parties.
 * This table captures any optional personal information
 * about the parties that is supplied with the quote request.
 * This is a PartyComplexName structure as defined in "API Definition v1.0.docx"
 * section 7.4.12
*/
CREATE TABLE IF NOT EXISTS party (
    partyId BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    quotePartyId BIGINT UNSIGNED NOT NULL,
    firstName VARCHAR(128) NULL,
    middleName VARCHAR(128) NULL,
    lastName VARCHAR(128) NULL,
    dateOfBirth DATETIME NULL, 
    CONSTRAINT party_quotepartyid_foreign FOREIGN KEY (quotePartyId)
        REFERENCES quoteParty (quotePartyId)
) COMMENT 'Optional personal data provided during the Quote Request for the Payer and Quote Response for the Payee';



CREATE TABLE IF NOT EXISTS quoteResponse (
    quoteResponseId BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    quoteId VARCHAR(36) NOT NULL COMMENT 'Common ID between the FSPs for the quote object, decided by the Payer FSP',
    transferAmountCurrencyId VARCHAR(3) NOT NULL COMMENT 'CurrencyId of the transfer amount',
    transferAmount DECIMAL(18, 4) NOT NULL COMMENT 'The amount of money that the Payer FSP should transfer to the Payee FSP',
    payeeReceiveAmountCurrencyId VARCHAR(3) NULL COMMENT 'CurrencyId of the payee receive amount',
    payeeReceiveAmount DECIMAL(18, 4) NULL COMMENT 'The amount of Money that the Payee should receive in the end-to-end transaction. Optional as the Payee FSP might not want to disclose any optional Payee fees',
    payeeFspFeeCurrencyId VARCHAR(3) NULL COMMENT 'CurrencyId of the payee fsp fee amount',
    payeeFspFeeAmount DECIMAL(18, 4) NULL COMMENT 'Payee FSP’s part of the transaction fee',
    payeeFspCommissionCurrencyId VARCHAR(3) NULL COMMENT 'CurrencyId of the payee fsp commission amount',
    payeeFspCommissionAmount DECIMAL(18, 4) NULL COMMENT 'Transaction commission from the Payee FSP',
    `ilpCondition` varchar(256) NOT NULL,
    responseExpirationDate DATETIME NULL COMMENT 'Optional expiration for the requested transaction',
    `isValid` tinyint(1) DEFAULT NULL,
    createdDate DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL COMMENT 'System dateTime stamp pertaining to the inserted record',
    CONSTRAINT quoteresponse_quoteid_foreign FOREIGN KEY (quoteId)
        REFERENCES quote (quoteId),
    CONSTRAINT quoteresponse_transferamountcurrencyid_foreign FOREIGN KEY (transferAmountCurrencyId)
        REFERENCES currency (currencyId),
    CONSTRAINT quoteresponse_payeereceiveamountcurrencyid_foreign FOREIGN KEY (payeeReceiveAmountCurrencyId)
        REFERENCES currency (currencyId),
    CONSTRAINT quoteresponse_payeefspfeecurrencyid_foreign FOREIGN KEY (payeeFspFeeCurrencyId)
        REFERENCES currency (currencyId),
    CONSTRAINT quoteresponse_payeefspcommissioncurrencyid_foreign FOREIGN KEY (payeeFspCommissionCurrencyId)
        REFERENCES currency (currencyId)
)  COMMENT 'This table is the primary store for quote responses';


CREATE TABLE IF NOT EXISTS quoteResponseIlpPacket (
    quoteResponseId BIGINT UNSIGNED NOT NULL,
    `value` TEXT NOT NULL COMMENT 'ilpPacket returned from Payee in response to a quote request',
    PRIMARY KEY (quoteResponseId),
    CONSTRAINT quoteResponseilppacket_quoteResponseid_foreign FOREIGN KEY (quoteResponseId)
        REFERENCES quoteResponse (quoteResponseId)
);

CREATE TABLE IF NOT EXISTS geoCode (
    geoCodeId BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    quotePartyId BIGINT UNSIGNED NOT NULL COMMENT 'Optionally the GeoCode for the Payer/Payee may have been provided. If the Quote Response has the GeoCode for the Payee, an additional row is added',
    latitude VARCHAR(50) NOT NULL COMMENT 'Latitude of the initiating Party',
    longitude VARCHAR(50) NOT NULL COMMENT 'Longitude of the initiating Party',
    createdDate DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL COMMENT 'System dateTime stamp pertaining to the inserted record',
    CONSTRAINT geocode_quotepartyid_foreign FOREIGN KEY (quotePartyId)
        REFERENCES quoteParty (quotePartyId)
);


 
CREATE TABLE IF NOT EXISTS quoteExtension (
    quoteExtensionId BIGINT NOT NULL PRIMARY KEY,
    quoteId VARCHAR(36) NOT NULL COMMENT 'Common ID between the FSPs for the quote object, decided by the Payer FSP',
    quoteResponseId BIGINT UNSIGNED NOT NULL COMMENT 'The response to the intial quote',
    transactionId VARCHAR(36) NOT NULL COMMENT 'The transaction reference that is part of the initial quote.',
    `key` VARCHAR(128) NOT NULL,
    `value` TEXT NOT NULL,
    createdDate DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL COMMENT 'System dateTime stamp pertaining to the inserted record',
    CONSTRAINT quoteextension_quoteid_foreign FOREIGN KEY (quoteId)
        REFERENCES quote (quoteId),
    CONSTRAINT quoteextension_quoteresponseid_foreign FOREIGN KEY (quoteResponseId)
        REFERENCES quoteResponse (quoteResponseId),
    CONSTRAINT quoteextension_transactionid_foreign FOREIGN KEY (transactionId)
        REFERENCES transactionReference (transactionReferenceId)
)  COMMENT 'Persists the extention lists elements associated with the quote. When it is from the response to a quote (i.e. PUT) the quoteResponseId is populated.';


DROP TABLE IF EXISTS quoteResponseDuplicateCheck;
CREATE TABLE IF NOT EXISTS quoteResponseDuplicateCheck (
    quoteResponseId BIGINT UNSIGNED PRIMARY KEY COMMENT 'The response to the intial quote',
    quoteId VARCHAR(36) NOT NULL COMMENT 'Common ID between the FSPs for the quote object, decided by the Payer FSP',
    hash VARCHAR(255) NULL COMMENT 'hash value received for the quote response',
    createdDate DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL COMMENT 'System dateTime stamp pertaining to the inserted record',
    CONSTRAINT quoteresponseduplicatecheck_quoteid_foreign FOREIGN KEY (quoteId)
        REFERENCES quote (quoteId),
    CONSTRAINT quoteresponseduplicatecheck_quoteresponseid_foreign FOREIGN KEY (quoteResponseId)
        REFERENCES quoteResponse (quoteResponseId)
);


DROP TABLE IF EXISTS `quoteError`;
CREATE TABLE `quoteError` (
  `quoteErrorId` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
   quoteId VARCHAR(36) NOT NULL COMMENT 'Common ID between the FSPs for the quote object, decided by the Payer FSP',
   quoteResponseId BIGINT UNSIGNED NULL COMMENT 'The response to the intial quote',
  `errorCode` int(10) unsigned NOT NULL,
  `errorDescription` varchar(128) NOT NULL,
  `createdDate` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`quoteErrorId`),
      CONSTRAINT quoteerror_quoteid_foreign FOREIGN KEY (quoteId)
        REFERENCES quote (quoteId),
    CONSTRAINT quoteerror_quoteresponseid_foreign FOREIGN KEY (quoteResponseId)
        REFERENCES quoteResponse (quoteResponseId)
);


DROP TABLE IF EXISTS `transferRules`;
CREATE TABLE `transferRules` (
  `transferRulesId` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(128) NOT NULL,
  `description` VARCHAR(512) DEFAULT NULL,
  `rule` VARCHAR(16384) NOT NULL,
  `enabled` BOOLEAN NOT NULL DEFAULT TRUE,
  `createdDate` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`transferRulesId`)
);


/* views */
CREATE VIEW quotePartyView AS
SELECT
    qp.quoteId AS quoteId,
    qp.quotePartyId AS quotePartyId,
    pt.name AS partyType,
    pit.name AS identifierType,
    qp.partyIdentifierValue,
    spit.name AS partySubIdOrType,
    qp.fspId AS fspId,
    qp.merchantClassificationCode AS merchantClassificationCode,
    qp.partyName AS partyName,
    p.firstName AS firstName,
    p.lastName AS lastName,
    p.middleName AS middleName,
    p.dateOfBirth AS dateOfBirth,
    gc.longitude,
    gc.latitude
FROM
    quoteParty qp
    INNER JOIN partyType pt ON pt.partyTypeId = qp.partyTypeId
    INNER JOIN partyIdentifierType pit ON pit.partyIdentifierTypeId = qp.partyIdentifierTypeId
    LEFT JOIN party p ON p.quotePartyId = qp.quotePartyId
    LEFT JOIN partyIdentifierType spit ON spit.partyIdentifierTypeId = qp.partySubIdOrTypeId
    LEFT JOIN geoCode gc ON gc.quotePartyId = qp.quotePartyId;


CREATE OR REPLACE VIEW quoteView AS
SELECT
    q.quoteId AS quoteId,
    q.transactionReferenceId AS transactionReferenceId,
    q.transactionRequestId AS transactionRequestId,
    q.note AS note,
    q.expirationDate AS expirationDate,
    ti.name AS transactionInitiator,
    tit.name AS transactionInitiatorType,
    ts.name AS transactionScenario,
    q.balanceOfPaymentsId AS balanceOfPaymentsId,
    tss.name AS transactionSubScenario,
    amt.name AS amountType,
    q.amount AS amount,
    q.currencyId AS currency
FROM
    quote q
    INNER JOIN transactionInitiator ti ON ti.transactionInitiatorId = q.transactionInitiatorId
    INNER JOIN transactionInitiatorType tit ON tit.transactionInitiatorTypeId = q.transactionInitiatorTypeId
    INNER JOIN transactionScenario ts ON ts.transactionScenarioId = q.transactionScenarioId
    INNER JOIN amountType amt ON amt.amountTypeId = q.amountTypeId
    LEFT JOIN transactionSubScenario tss ON tss.transactionSubScenarioId = q.transactionSubScenarioId;


CREATE OR REPLACE VIEW quoteResponseView AS
SELECT
    qr.*,
    qrilp.value as ilpPacket,
    gc.longitude,
    gc.latitude
FROM
    quoteResponse qr
    INNER JOIN quoteResponseIlpPacket qrilp ON qrilp.quoteResponseId = qr.quoteResponseId
    INNER JOIN quoteParty qp ON qp.quoteId = qr.quoteId
    INNER JOIN partyType pt ON pt.partyTypeId = qp.partyTypeId
    LEFT JOIN geoCode gc ON gc.quotePartyId = qp.quotePartyId
WHERE
    pt.name = 'PAYEE';


/* seed values */

/* amountType table */
INSERT INTO amountType (name, description) VALUES ('SEND', 'Amount the Payer would like to send; that is, the amount that should be withdrawn from the Payer account including any fees');
INSERT INTO amountType (name, description) VALUES ('RECEIVE', 'Amount the Payer would like the Payee to receive; that is, the amount that should be sent to the receiver exclusive fees');


/* partyIdentifierType table */
INSERT INTO partyIdentifierType (name, description) VALUES ('MSISDN', 'An MSISDN (Mobile Station International Subscriber Directory Number; that is, a phone number) is used in reference to a Party');

/* note that the following partyIdentifierTypes although defined by the API spec are not supported by the casablanca switch.

INSERT INTO partyIdentifierType (name, description) VALUES ('EMAIL', 'An email is used in reference to a Party. The format of the email should be according to the informational RFC 3696');
INSERT INTO partyIdentifierType (name, description) VALUES ('PERSONAL_ID', 'A personal identifier is used in reference to a participant. Examples of personal identification are passport number, birth certificate number, and national registration number. The identifier number is added in the PartyIdentifier element. The personal identifier type is added in the PartySubIdOrType element');
INSERT INTO partyIdentifierType (name, description) VALUES ('BUSINESS', 'A specific Business (for example, an organization or a company) is used in reference to a participant. The BUSINESS identifier can be in any format. To make a transaction connected to a specific username or bill number in a Business, the PartySubIdOrType element should be used');
INSERT INTO partyIdentifierType (name, description) VALUES ('DEVICE', 'A specific device (for example, POS or ATM) ID connected to a specific business or organization is used in reference to a Party. For referencing a specific device under a specific business or organization, use the PartySubIdOrType element');
INSERT INTO partyIdentifierType (name, description) VALUES ('ACCOUNT_ID', 'A bank account number or FSP account ID should be used in reference to a participant. The ACCOUNT_ID identifier can be in any format, as formats can greatly differ depending on country and FSP');
INSERT INTO partyIdentifierType (name, description) VALUES ('IBAN', 'A bank account number or FSP account ID is used in reference to a participant. The IBAN identifier can consist of up to 34 alphanumeric characters and should be entered without whitespace');
INSERT INTO partyIdentifierType (name, description) VALUES ('ALIAS', 'An alias is used in reference to a participant. The alias should be created in the FSP as an alternative reference to an account owner. Another example of an alias is a username in the FSP system. The ALIAS identifier can be in any format. It is also possible to use the PartySubIdOrType element for identifying an account under an Alias defined by the PartyIdentifier');
*/

/* partyType table */
INSERT INTO partyType (name, description) VALUES ('PAYER', 'Represents the entity sending money');
INSERT INTO partyType (name, description) VALUES ('PAYEE', 'Represents the entity receiving money');


/* transactionInitiator table */
INSERT INTO transactionInitiator (name, description) VALUES ('PAYER', 'Sender of funds is initiating the transaction. The account to send from is either owned by the Payer or is connected to the Payer in some way');
INSERT INTO transactionInitiator (name, description) VALUES ('PAYEE', 'Recipient of the funds is initiating the transaction by sending a transaction request. The Payer must approve the transaction, either automatically by a pre-generated OTP or by pre-approval of the Payee, or manually by approving on their own Device.');


/* transactionInitiatorType table */
INSERT INTO transactionInitiatorType (name, description) VALUES ('CONSUMER', 'Consumer is the initiator of the transaction');
INSERT INTO transactionInitiatorType (name, description) VALUES ('AGENT', 'Agent is the initiator of the transaction');
INSERT INTO transactionInitiatorType (name, description) VALUES ('BUSINESS', 'Business is the initiator of the transaction');
INSERT INTO transactionInitiatorType (name, description) VALUES ('DEVICE', 'Device is the initiator of the transaction');


/* transactionScenario table */
INSERT INTO transactionScenario (name, description) VALUES ('TRANSFER', 'Used for performing a P2P (Peer to Peer, or Consumer to Consumer) transaction');

/* note that the following transactionScenarios although defined by the API spec are not supported by the casablanca switch.

INSERT INTO transactionScenario (name, description) VALUES ('DEPOSIT', 'Used for performing a Cash-In (deposit) transaction. In a normal scenario, electronic funds are transferred from a Business account to a Consumer account, and physical cash is given from the Consumer to the Business User');
INSERT INTO transactionScenario (name, description) VALUES ('WITHDRAWAL', 'Used for performing a Cash-Out (withdrawal) transaction. In a normal scenario, electronic funds are transferred from a Consumer’s account to a Business account, and physical cash is given from the Business User to the Consumer');
INSERT INTO transactionScenario (name, description) VALUES ('PAYMENT', 'Usually used for performing a transaction from a Consumer to a Merchant or Organization, but could also be for a B2B (Business to Business) payment. The transaction could be online for a purchase in an Internet store, in a physical store where both the Consumer and Business User are present, a bill payment, a donation, and so on');
INSERT INTO transactionScenario (name, description) VALUES ('REFUND', 'Used for performing a refund of transaction');
*/


/* transactionSubScenario table */

/* balanceOfPayments table */
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (100, '100');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (110, '110');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (150, '150');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (151, '151');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (152, '152');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (160, '160');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (170, '170');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (171, '171');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (172, '172');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (173, '173');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (180, '180');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (181, '181');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (182, '182');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (200, '200');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (205, '205');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (206, '206');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (207, '207');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (208, '208');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (209, '209');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (210, '210');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (211, '211');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (212, '212');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (213, '213');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (214, '214');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (215, '215');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (216, '216');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (217, '217');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (218, '218');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (219, '219');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (220, '220');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (221, '221');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (222, '222');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (223, '223');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (224, '224');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (225, '225');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (226, '226');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (227, '227');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (228, '228');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (229, '229');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (230, '230');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (231, '231');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (232, '232');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (236, '236');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (237, '237');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (238, '238');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (239, '239');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (240, '240');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (241, '241');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (242, '242');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (243, '243');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (245, '245');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (246, '246');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (247, '247');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (249, '249');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (250, '250');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (251, '251');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (253, '253');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (254, '254');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (255, '255');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (256, '256');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (257, '257');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (258, '258');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (260, '260');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (262, '262');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (263, '263');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (264, '264');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (266, '266');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (268, '268');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (269, '269');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (270, '270');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (271, '271');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (272, '272');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (273, '273');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (274, '274');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (275, '275');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (276, '276');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (277, '277');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (278, '278');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (279, '279');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (280, '280');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (281, '281');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (282, '282');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (283, '283');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (284, '284');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (285, '285');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (287, '287');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (288, '288');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (289, '289');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (291, '291');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (292, '292');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (293, '293');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (294, '294');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (300, '300');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (310, '310');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (320, '320');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (330, '330');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (331, '331');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (332, '332');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (333, '333');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (334, '334');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (339, '339');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (340, '340');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (341, '341');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (342, '342');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (343, '343');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (344, '344');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (349, '349');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (350, '350');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (351, '351');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (352, '352');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (353, '353');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (354, '354');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (360, '360');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (361, '361');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (362, '362');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (363, '363');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (364, '364');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (370, '370');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (371, '371');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (372, '372');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (373, '373');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (374, '374');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (379, '379');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (380, '380');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (390, '390');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (391, '391');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (392, '392');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (400, '400');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (401, '401');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (402, '402');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (410, '410');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (430, '430');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (431, '431');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (432, '432');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (440, '440');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (480, '480');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (500, '500');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (505, '505');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (510, '510');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (515, '515');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (520, '520');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (525, '525');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (526, '526');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (527, '527');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (530, '530');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (535, '535');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (540, '540');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (555, '555');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (560, '560');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (565, '565');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (570, '570');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (575, '575');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (576, '576');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (577, '577');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (580, '580');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (585, '585');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (590, '590');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (600, '600');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (602, '602');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (610, '610');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (611, '611');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (612, '612');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (613, '613');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (614, '614');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (619, '619');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (620, '620');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (621, '621');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (622, '622');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (623, '623');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (624, '624');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (630, '630');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (631, '631');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (632, '632');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (633, '633');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (634, '634');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (652, '652');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (660, '660');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (663, '663');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (664, '664');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (669, '669');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (670, '670');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (671, '671');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (672, '672');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (673, '673');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (674, '674');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (680, '680');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (681, '681');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (682, '682');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (683, '683');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (684, '684');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (700, '700');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (703, '703');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (706, '706');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (707, '707');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (708, '708');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (709, '709');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (710, '710');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (711, '711');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (712, '712');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (714, '714');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (715, '715');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (717, '717');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (718, '718');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (719, '719');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (720, '720');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (721, '721');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (722, '722');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (723, '723');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (724, '724');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (725, '725');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (726, '726');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (727, '727');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (730, '730');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (731, '731');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (732, '732');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (733, '733');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (734, '734');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (736, '736');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (737, '737');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (738, '738');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (739, '739');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (740, '740');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (741, '741');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (742, '742');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (743, '743');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (744, '744');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (745, '745');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (746, '746');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (747, '747');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (748, '748');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (753, '753');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (756, '756');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (757, '757');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (758, '758');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (759, '759');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (760, '760');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (761, '761');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (762, '762');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (764, '764');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (765, '765');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (766, '766');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (767, '767');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (768, '768');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (769, '769');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (770, '770');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (771, '771');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (772, '772');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (773, '773');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (774, '774');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (775, '775');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (776, '776');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (777, '777');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (780, '780');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (781, '781');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (782, '782');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (783, '783');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (784, '784');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (786, '786');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (787, '787');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (788, '788');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (789, '789');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (790, '790');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (791, '791');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (792, '792');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (793, '793');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (794, '794');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (795, '795');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (796, '796');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (797, '797');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (798, '798');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (802, '802');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (803, '803');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (806, '806');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (808, '808');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (810, '810');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (811, '811');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (812, '812');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (813, '813');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (814, '814');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (850, '850');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (851, '851');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (852, '852');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (858, '858');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (862, '862');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (863, '863');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (865, '865');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (868, '868');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (871, '871');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (887, '887');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (888, '888');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (889, '889');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (890, '890');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (891, '891');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (892, '892');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (894, '894');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (895, '895');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (896, '896');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (897, '897');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (900, '900');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (901, '901');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (902, '902');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (903, '903');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (904, '904');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (905, '905');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (906, '906');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (907, '907');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (908, '908');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (909, '909');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (910, '910');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (911, '911');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (912, '912');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (913, '913');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (914, '914');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (920, '920');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (950, '950');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (951, '951');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (952, '952');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (953, '953');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (956, '956');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (957, '957');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (960, '960');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (961, '961');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (962, '962');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (972, '972');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (973, '973');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (974, '974');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (975, '975');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (976, '976');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (977, '977');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (982, '982');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (983, '983');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (984, '984');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (991, '991');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (992, '992');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (993, '993');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (994, '994');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (995, '995');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (996, '996');
INSERT INTO balanceOfPayments (balanceOfPaymentsId, name) VALUES (998, '998');

