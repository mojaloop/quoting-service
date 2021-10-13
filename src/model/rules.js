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
const assert = require('assert').strict

const events = {
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
      assert.deepEqual(factValue, ruleValue)
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
  engine.addOperator('isString', (factValue, ruleValue) => {
    return ((typeof factValue === 'string') === ruleValue)
  })
  engine.addOperator('isArray', (factValue, ruleValue) => {
    return Array.isArray(factValue) === ruleValue
  })
  engine.addOperator('isObject', (factValue, ruleValue) => {
    return (typeof factValue === 'object' && !Array.isArray(factValue)) === ruleValue
  })

  return engine
}

/**
 * Evaluate the input data against the business rules
 *
 * @returns {promise} - array of failure cases, may be empty
 */
const run = (rules, runtimeFacts) => {
  const engine = createEngine()
  rules.map(r => new jre.Rule(r)).forEach(r => engine.addRule(r))

  return engine.run(runtimeFacts)
}

module.exports = {
  events,
  run
}
