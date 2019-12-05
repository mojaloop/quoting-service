/*****
 License
 --------------
 Copyright © 2017 Bill & Melinda Gates Foundation
 The Mojaloop files are made available by the Bill & Melinda Gates Foundation under the Apache License, Version 2.0 (the 'License') and you may not use these files except in compliance with the License. You may obtain a copy of the License at
 http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, the Mojaloop files are distributed on an 'AS IS' BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.

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

 * ModusBox
 - Georgi Georgiev <georgi.georgiev@modusbox.com>
 - Vassilis Barzokas <vassilis.barzokas@modusbox.com>
 --------------
 ******/

// jest has a buggy system for mocking dependencies that can be overcome by mocking and then
// requiring the module like below.
// more info on https://github.com/facebook/jest/issues/2582#issuecomment-321607875
const mockRules = [
  {
    conditions: {
      all: [
        {
          fact: 'json-path',
          params: {
            fact: 'payload',
            path: '$.payload.extensionList[?(@.key == "KYCPayerTier")].value'
          },
          operator: 'deepEqual',
          value: ['1']
        },
        {
          fact: 'payload',
          path: '.amount.currency',
          operator: 'notIn',
          value: {
            fact: 'json-path',
            params: {
              fact: 'payee',
              path: '$.payee.accounts[?(@.ledgerAccountType == "SETTLEMENT")].currency'
            }
          }
        }
      ]
    },
    event: {
      type: 'INTERCEPT_QUOTE',
      params: {
        rerouteToFsp: 'DFSPEUR'
      }
    }
  },
  {
    conditions: {
      all: [
        {
          fact: 'json-path',
          params: {
            fact: 'payload',
            path: '$.payload.extensionList[?(@.key == "KYCPayerTier")].value'
          },
          operator: 'notDeepEqual',
          value: ['1']
        },
        {
          fact: 'payload',
          path: '.amount.currency',
          operator: 'notIn',
          value: {
            fact: 'json-path',
            params: {
              fact: 'payee',
              path: '$.payee.accounts[?(@.ledgerAccountType == "SETTLEMENT")].currency'
            }
          }
        }
      ]
    },
    event: {
      type: 'INVALID_QUOTE_REQUEST',
      params: {
        FSPIOPError: 'PAYEE_UNSUPPORTED_CURRENCY',
        message: 'The requested payee does not support the payment currency'
      }
    }
  }
]

const RulesEngine = require('../../../src/model/rules')

describe('RulesEngine', () => {
  describe('run', () => {
    it('returns the expected events when using jsonpath and notDeepEqual operator', async () => {
      const conditions = {
        any: [{
          fact: 'json-path',
          params: {
            fact: 'payload',
            path: '$.payload.payer.partyIdInfo.fspId'
          },
          operator: 'notDeepEqual',
          value: ['payerfsp']
        }]
      }
      const event = {
        type: RulesEngine.events.INVALID_QUOTE_REQUEST
      }
      const testFacts = {
        payload: {
          payer: {
            partyIdInfo: {
              fspId: 'payeefsp'
            }
          }
        }
      }
      const { events } = await RulesEngine.run([{ conditions, event }], testFacts)
      expect(events).toEqual([event])
    })

    it('returns the expected events when using jsonpath fact-fact comparison', async () => {
      const conditions = {
        any: [{
          fact: 'json-path',
          params: {
            fact: 'payload',
            path: '$.payload.payer.partyIdInfo.fspId'
          },
          operator: 'notDeepEqual',
          value: {
            fact: 'json-path',
            params: {
              path: '$.headers[\'fspiop-source\']',
              fact: 'headers'
            }
          }
        }]
      }
      const event = {
        type: RulesEngine.events.INVALID_QUOTE_REQUEST
      }
      const testFacts = {
        payload: {
          payer: {
            partyIdInfo: {
              fspId: 'payeefsp'
            }
          }
        },
        headers: {
          'fspiop-source': 'payerfsp'
        }
      }
      const { events } = await RulesEngine.run([{ conditions, event }], testFacts)
      expect(events).toEqual([event])
    })

    it('returns the expected events when using jsonpath array filter', async () => {
      const conditions = {
        any: [{
          fact: 'json-path',
          params: {
            fact: 'payload',
            path: '$.payload.extensionList[?(@.key === \'KYCPayerTier\')].value'
          },
          operator: 'notDeepEqual',
          value: ['1']
        }]
      }
      const event = {
        type: RulesEngine.events.INVALID_QUOTE_REQUEST
      }
      const testFacts = {
        payload: {
          extensionList: [
            { key: 'blah', value: 'whatever' },
            { key: 'KYCPayerTier', value: '2' },
            { key: 'noise', value: 'blah' }
          ]
        }
      }
      const { events } = await RulesEngine.run([{ conditions, event }], testFacts)
      expect(events).toEqual([event])
    })

    it('returns the expected events when using deepEqual operator', async () => {
      const conditions = {
        any: [{
          fact: 'json-path',
          params: {
            fact: 'payload',
            path: '$.payload.extensionList[?(@.key === \'KYCPayerTier\')].value'
          },
          operator: 'deepEqual',
          value: ['1']
        }]
      }
      const event = {
        type: RulesEngine.events.INVALID_QUOTE_REQUEST
      }
      const testFacts = {
        payload: {
          extensionList: [
            { key: 'blah', value: 'whatever' },
            { key: 'KYCPayerTier', value: '1' },
            { key: 'noise', value: 'blah' }
          ]
        }
      }
      const { events } = await RulesEngine.run([{ conditions, event }], testFacts)
      expect(events).toEqual([event])
    })

    it('returns the expected events when using example config for event INTERCEPT_QUOTE', async () => {
      const testFacts = {
        payee: {
          accounts: [{
            ledgerAccountType: 'SETTLEMENT',
            currency: 'ZAR'
          }]
        },
        payload: {
          amount: {
            currency: 'XOF'
          },
          extensionList: [
            { key: 'blah', value: 'whatever' },
            { key: 'KYCPayerTier', value: '1' },
            { key: 'noise', value: 'blah' }
          ]
        }
      }
      const { events } = await RulesEngine.run(mockRules, testFacts)
      expect(events).toEqual([mockRules[0].event])
    })

    it('returns an empty array of events when using example config for INTERCEPT_QUOTE negative case', async () => {
      const testFacts = {
        payee: {
          accounts: [{
            ledgerAccountType: 'SETTLEMENT',
            currency: 'XOF'
          }]
        },
        payload: {
          amount: {
            currency: 'XOF'
          },
          extensionList: [
            { key: 'blah', value: 'whatever' },
            { key: 'KYCPayerTier', value: '1' },
            { key: 'noise', value: 'blah' }
          ]
        }
      }
      const { events } = await RulesEngine.run(mockRules, testFacts)
      expect(events).toEqual([])
    })

    it('returns the expected events when using example config for INVALID_QUOTE_REQUEST triggered by missing extension value', async () => {
      const testFacts = {
        payee: {
          accounts: [{
            ledgerAccountType: 'SETTLEMENT',
            currency: 'ZAR'
          }]
        },
        payload: {
          amount: {
            currency: 'XOF'
          },
          extensionList: [
            { key: 'blah', value: 'whatever' },
            { key: 'noise', value: 'blah' }
          ]
        }
      }
      const { events } = await RulesEngine.run(mockRules, testFacts)
      expect(events).toEqual([mockRules[1].event])
    })

    it('returns the expected events when using example config INVALID_QUOTE_REQUEST triggered by incorrect extension value', async () => {
      const testFacts = {
        payee: {
          accounts: [{
            ledgerAccountType: 'SETTLEMENT',
            currency: 'ZAR'
          }]
        },
        payload: {
          amount: {
            currency: 'XOF'
          },
          extensionList: [
            { key: 'blah', value: 'whatever' },
            { key: 'KYCPayerTier', value: '2' },
            { key: 'noise', value: 'blah' }
          ]
        }
      }
      const { events } = await RulesEngine.run(mockRules, testFacts)
      expect(events).toEqual([mockRules[1].event])
    })

    it('returns the expected events when using example config INVALID_QUOTE_REQUEST event negative case', async () => {
      const testFacts = {
        payee: {
          accounts: [{
            ledgerAccountType: 'SETTLEMENT',
            currency: 'XOF'
          }]
        },
        payload: {
          amount: {
            currency: 'XOF'
          },
          extensionList: [
            { key: 'blah', value: 'whatever' },
            { key: 'KYCPayerTier', value: '2' },
            { key: 'noise', value: 'blah' }
          ]
        }
      }
      const { events } = await RulesEngine.run(mockRules, testFacts)
      expect(events).toEqual([])
    })
  })
})
