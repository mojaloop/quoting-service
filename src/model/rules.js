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
 * Project: Casablanca
 * Original Author: James Bush

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

const jre = require('json-rules-engine')

const engine = new jre.Engine()

/**
 * Build helper to handle application of business rules to quotes
 */

// const FLATLAND_FSPS = [
//     'MobileMoney'
// ];
//
// const forbidInterdimensionalTransfers = new jre.Rule({
//     conditions: {
//         any: [{
//             all: [{
//                 fact: 'payee',
//                 path: '.partyIdInfo.partyIdentifier',
//                 operator: 'in',
//                 value: FLATLAND_FSPS
//             },{
//                 fact: 'payer',
//                 path: '.partyIdInfo.partyIdentifier',
//                 operator: 'notIn',
//                 value: FLATLAND_FSPS
//             }]
//         }, {
//             all: [{
//                 fact: 'payer',
//                 path: '.partyIdInfo.partyIdentifier',
//                 operator: 'in',
//                 value: FLATLAND_FSPS
//             },{
//                 fact: 'payee',
//                 path: '.partyIdInfo.partyIdentifier',
//                 operator: 'notIn',
//                 value: FLATLAND_FSPS
//             }]
//         }]
//     },
//     event: {
//         type: 'fsps-exist-within-different-dimensional-spaces',
//         params: {
//             message: 'FSPS exist within different dimensional spaces. Transfer not allowed.'
//         }
//     }
// });
//
// engine.addRule(forbidInterdimensionalTransfers);

/**
 * Load rules from the database
 *
 * @returns {undefined}
 */
module.exports.loadRulesFromDb = async function (db) {
  db.queryBuilder.transaction(async txn => {
    (await db.getTransferRules(txn)).forEach(r => engine.addRule(r))
  })
}

/**
 * Evaluate the input data against the business rules
 *
 * @returns {promise} - array of failure cases, may be empty
 */
module.exports.getFailures = engine.run.bind(engine)
