
const jre = require('json-rules-engine');

const engine = new jre.Engine();

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
module.exports.loadRulesFromDb = async function(db) {
    db.queryBuilder.transaction(async txn => {
        (await db.getTransferRules(txn)).forEach(r => engine.addRule(r));
    });
};

/**
 * Evaluate the input data against the business rules
 *
 * @returns {promise} - array of failure cases, may be empty
 */
module.exports.getFailures = engine.run.bind(engine);
