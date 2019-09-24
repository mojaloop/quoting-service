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

/*
 * This module presents a rules engine based on json-rules-engine with some Mojaloop-specific
 * operators, events and dynamic facts for use by schemes. Note that the entire json-rules-engine
 * API is still available to users of this module.
 */

const jre = require('json-rules-engine')
const jsonpath = require('jsonpath')
const assert = require('assert').strict

module.exports.events = {
  INTERCEPT_QUOTE: 'INTERCEPT_QUOTE',
  INVALID_QUOTE_REQUEST: 'INVALID_QUOTE_REQUEST'
}

/**
 * Build helper to handle application of business rules to quotes
 */
const createEngine = () => {
  const engine = new jre.Engine()

  const deepEqual = (factValue, ruleValue) => {
    try {
      assert.deepEqual(factValue, ruleValue);
      return true
    } catch (err) {
      return false
    }
  }

  engine.addOperator('notDeepEqual', (factValue, ruleValue) => {
    return !deepEqual(factValue, ruleValue)
  })
  engine.addOperator('deepEqual', (factValue, ruleValue) => {
    return deepEqual(factValue, ruleValue)
  })

  /**
   * The json-rules-engine path only supports selectn paths. This is problematic, as selectn cannot
   * traverse an array with filters, it can only use a static array index. For example, selectn
   * cannot find the age of user with name 'Tutaia' in the following array, without knowing in
   * advance that Tutaia will be the first element of the array:
   *
   *   [ { name: 'Tutaia', age: 25 }, { name: 'Kim', age: 66 } ]
   *
   * In many (most) cases we cannot know the order and content of our data in advance. We therefore
   * provide a more flexible, but still declarative jsonpath dynamic fact. Note that the examples
   * provided below in this comment are reproduced in the tests.
   *
   * Note that the jsonPathFact requires the deepEqual operator to function correctly, as jsonpath
   * returns an array of results.
   *
   * See https://www.npmjs.com/package/jsonpath for more information on jsonpath.
   *
   * The json-path fact exploits the fact params as its API by allowing the user to specify the fact
   * they'd like to retrieve and a jsonpath within that fact.
   *
   * The following example looks at the payload fact, and checks whether the payer fspId, at jsonpath
   * `$.payload.payer.partyIdInfo.fspId` is not `payerfsp`:
   *
   *   {
   *     fact: 'json-path',
   *     params: {
   *       fact: 'payload',
   *       path: '$.payload.payer.partyIdInfo.fspId'
   *     },
   *     operator: 'notDeepEqual',
   *     value: [ 'payerfsp' ]
   *   }
   *
   * Note that the value of .params.fact will be a top-level key in the jsonpath query, and therefore
   * must correspond to the top-level key in .params.path. A general example:
   *
   *   {
   *     fact: 'json-path',
   *     params: {
   *       fact: 'top-level-key',
   *       path: '$.top-level-key'
   *     },
   *     ...
   *   }
   *
   * Supported top-level keys (facts) are:
   * - payload
   * - headers
   * - payer
   * - payee
   *
   * Another slightly more complex example, comparing the value of the fspiop-source header with the
   * payer fspId in the payload:
   *
   *   {
   *     fact: 'json-path',
   *     params: {
   *       fact: 'payload',
   *       path: '$.payload.payer.partyIdInfo.fspId'
   *     },
   *     operator: 'deepEqual',
   *     value: {
   *       fact: 'json-path',
   *       params: {
   *         path: '$.headers[\'fspiop-source\']',
   *         fact: 'headers'
   *       }
   *     }
   *   }
   *
   * So far, no example rules have _required_ the use of jsonpath. The following rule filters the
   * KYCPayerTier key in the extension list of the quote payload and verifies that it is '1':
   *
   *   {
   *     fact: 'json-path',
   *     params: {
   *       fact: 'payload',
   *       path: '$.payload.extensionList[?(@.key === \'KYCPayerTier\')].value'
   *     },
   *     operator: 'deepEqual',
   *     value: [ '1' ]
   *   }
   */
  let jsonPathFact = function(params, almanac) {
    return almanac.factValue(params.fact)
      .then((fact) => {
        return jsonpath.query({ [params.fact]: fact }, params.path)
      })
  };
  engine.addFact('json-path', jsonPathFact)

  return engine
}

/**
 * Evaluate the input data against the business rules
 *
 * @returns {promise} - array of failure cases, may be empty
 */
module.exports.run = (rules, runtimeFacts) => {
  const engine = createEngine();
  const engineRules = rules.forEach(r => engine.addRule(new jre.Rule(r)))
  return engine.run(runtimeFacts)
}
