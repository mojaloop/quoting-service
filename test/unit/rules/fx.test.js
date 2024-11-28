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

const RulesEngine = require('../../../src/model/rules')

const fxRules = {
  EURtoXOFSendEUR: { // EUR to XOF, amountType=SEND, amount.currency=EUR
    conditions: {
      all: [
        {
          fact: 'headers',
          path: '$.fspiop-source',
          operator: 'notIn',
          value: [
            'DFSPXOF',
            'DFSPEUR',
            'DFSPMAD'
          ]
        },
        {
          fact: 'payload',
          path: '$.amount.currency',
          operator: 'notIn',
          value: {
            fact: 'payee',
            path: '$.accounts[?(@.ledgerAccountType == \'POSITION\' && @.isActive == 1)].currency'
          }
        },
        {
          fact: 'payload',
          path: '$.amount.currency',
          operator: 'equal',
          value: 'EUR'
        }
      ]
    },
    event: {
      type: 'INTERCEPT_QUOTE',
      params: {
        rerouteToFsp: 'DFSPEUR',
        sourceCurrency: 'EUR',
        rerouteToFspCurrency: 'XOF',
        additionalHeaders: {
          'x-fspiop-sourcecurrency': 'EUR',
          'x-fspiop-destinationcurrency': 'XOF'
        }
      }
    }
  },
  EURtoXOFReceiveXOF: { // EUR to XOF, amountType=RECEIVE, amount.currency=XOF
    conditions: {
      all: [
        {
          fact: 'headers',
          path: '$.fspiop-source',
          operator: 'notIn',
          value: [
            'DFSPXOF',
            'DFSPEUR',
            'DFSPMAD'
          ]
        },
        {
          fact: 'payload',
          path: '$.amount.currency',
          operator: 'notIn',
          value: {
            fact: 'payer',
            path: '$.accounts[?(@.ledgerAccountType == \'POSITION\' && @.isActive == 1)].currency'
          }
        },
        {
          fact: 'payload',
          path: '$.amount.currency',
          operator: 'equal',
          value: 'XOF'
        }
      ]
    },
    event: {
      type: 'INTERCEPT_QUOTE',
      params: {
        rerouteToFsp: 'DFSPEUR',
        sourceCurrency: 'EUR',
        rerouteToFspCurrency: 'XOF',
        additionalHeaders: {
          'x-fspiop-sourcecurrency': 'EUR',
          'x-fspiop-destinationcurrency': 'XOF'
        }
      }
    }
  },
  XOFtoEURSendXOF: { // XOF to EUR, amountType=SEND, amount.currency=XOF
    conditions: {
      all: [
        {
          fact: 'headers',
          path: '$.fspiop-source',
          operator: 'notIn',
          value: [
            'DFSPXOF',
            'DFSPEUR',
            'DFSPMAD'
          ]
        },
        {
          fact: 'payload',
          path: '$.amount.currency',
          operator: 'notIn',
          value: {
            fact: 'payee',
            path: '$.accounts[?(@.ledgerAccountType == \'POSITION\' && @.isActive == 1)].currency'
          }
        },
        {
          fact: 'payload',
          path: '$.amount.currency',
          operator: 'equal',
          value: 'XOF'
        }
      ]
    },
    event: {
      type: 'INTERCEPT_QUOTE',
      params: {
        rerouteToFsp: 'DFSPXOF',
        sourceCurrency: 'XOF',
        rerouteToFspCurrency: 'EUR',
        additionalHeaders: {
          'x-fspiop-sourcecurrency': 'XOF',
          'x-fspiop-destinationcurrency': 'EUR'
        }
      }
    }
  },
  XOFtoEURReceiveEUR: { // XOF to EUR, amountType=RECEIVE, amount.currency=EUR
    conditions: {
      all: [
        {
          fact: 'headers',
          path: '$.fspiop-source',
          operator: 'notIn',
          value: [
            'DFSPXOF',
            'DFSPEUR',
            'DFSPMAD'
          ]
        },
        {
          fact: 'payload',
          path: '$.amount.currency',
          operator: 'notIn',
          value: {
            fact: 'payer',
            path: '$.accounts[?(@.ledgerAccountType == \'POSITION\' && @.isActive == 1)].currency'
          }
        },
        {
          fact: 'payload',
          path: '$.amount.currency',
          operator: 'equal',
          value: 'EUR'
        }
      ]
    },
    event: {
      type: 'INTERCEPT_QUOTE',
      params: {
        rerouteToFsp: 'DFSPXOF',
        sourceCurrency: 'XOF',
        rerouteToFspCurrency: 'EUR',
        additionalHeaders: {
          'x-fspiop-sourcecurrency': 'XOF',
          'x-fspiop-destinationcurrency': 'EUR'
        }
      }
    }
  },
  payerUnsupportedCurrency: { // PAYER_UNSUPPORTED_CURRENCY
    conditions: {
      all: [
        {
          fact: 'payload',
          path: '$.amountType',
          operator: 'equal',
          value: 'SEND'
        },
        {
          fact: 'payload',
          path: '$.amount.currency',
          operator: 'notIn',
          value: {
            fact: 'payer',
            path: '$.accounts[?(@.ledgerAccountType == \'POSITION\' && @.isActive == 1)].currency'
          }
        }
      ]
    },
    event: {
      type: 'INVALID_QUOTE_REQUEST',
      params: {
        FSPIOPError: 'PAYER_UNSUPPORTED_CURRENCY',
        message: 'Requested currency not available for payer. Transfer not allowed.'
      }
    }
  },
  payeeUnsupportedCurrency: { // PAYEE_UNSUPPORTED_CURRENCY
    conditions: {
      all: [
        {
          fact: 'payload',
          path: '$.amountType',
          operator: 'equal',
          value: 'RECEIVE'
        },
        {
          fact: 'payload',
          path: '$.amount.currency',
          operator: 'notIn',
          value: {
            fact: 'payee',
            path: '$.accounts[?(@.ledgerAccountType == \'POSITION\' && @.isActive == 1)].currency'
          }
        }
      ]
    },
    event: {
      type: 'INVALID_QUOTE_REQUEST',
      params: {
        FSPIOPError: 'PAYEE_UNSUPPORTED_CURRENCY',
        message: 'Requested currency not available for payee. Transfer not allowed.'
      }
    }
  },
  FSPIOPSourceDoesNotMatchPayer: { // FSPIOP-Source not matching Payer
    conditions: {
      all: [
        {
          fact: 'headers',
          path: '$.fspiop-source',
          operator: 'notIn',
          value: [
            'DFSPXOF',
            'DFSPEUR',
            'DFSPMAD'
          ]
        },
        {
          fact: 'headers',
          path: '$.fspiop-source',
          operator: 'notEqual',
          value: {
            fact: 'payload',
            path: '$.payer.partyIdInfo.fspId'
          }
        }
      ]
    },
    event: {
      type: 'INVALID_QUOTE_REQUEST',
      params: {
        FSPIOPError: 'PAYER_FSPIO',
        message: 'The payer FSP does not match the fspiop-source header'
      }
    }
  },
  firstNameMissing: { // First Name is missing from the quote request
    conditions: {
      all: [
        {
          any: [
            {
              fact: 'payload',
              path: '$.amount.currency',
              operator: 'notIn',
              value: {
                fact: 'payee',
                path: '$.accounts[?(@.ledgerAccountType == \'POSITION\' && @.isActive  == 1)].currency'
              }
            },
            {
              fact: 'payload',
              path: '$.amount.currency',
              operator: 'notIn',
              value: {
                fact: 'payer',
                path: '$.accounts[?(@.ledgerAccountType == \'POSITION\' && @.isActive  == 1)].currency'
              }
            }
          ]
        },
        {
          fact: 'payload',
          path: '$.payer.personalInfo.complexName.firstName',
          operator: 'isString',
          value: false
        }
      ]
    },
    event: {
      type: 'INVALID_QUOTE_REQUEST',
      params: {
        FSPIOPError: 'MISSING_ELEMENT',
        message: 'child \'Party\' fails because [child \'PartyPersonalInfo\' fails because [child \'PartyComplexName\' fails because [child \'firstName\' fails because [\'firstName\' is required]]]]'
      }
    }
  },
  payerHasMoreThanOneCurrency: { // Payer has more than one currency
    conditions: {
      all: [
        {
          any: [
            {
              fact: 'payload',
              path: '$.amount.currency',
              operator: 'notIn',
              value: {
                fact: 'payer',
                path: '$.accounts[?(@.ledgerAccountType == \'POSITION\' && @.isActive  == 1)].currency'
              }
            },
            {
              fact: 'payload',
              path: '$.amount.currency',
              operator: 'notIn',
              value: {
                fact: 'payee',
                path: '$.accounts[?(@.ledgerAccountType == \'POSITION\' && @.isActive  == 1)].currency'
              }
            }
          ]
        },
        {
          fact: 'payer',
          path: '$.accounts[?(@.ledgerAccountType == \'POSITION\' && @.isActive  == 1)]',
          operator: 'isArray',
          value: true
        }
      ]
    },
    event: {
      type: 'INVALID_QUOTE_REQUEST',
      params: {
        FSPIOPError: 'PAYER_ERROR',
        message: 'Payer FSP has more than 1 active currency account. Switch does not support more than 1 active currency account for Forex Requests'
      }
    }
  },
  payeeHasMoreThanOneCurrency: { // Payee has more than one currency
    conditions: {
      all: [
        {
          any: [
            {
              fact: 'payload',
              path: '$.amount.currency',
              operator: 'notIn',
              value: {
                fact: 'payer',
                path: '$.accounts[?(@.ledgerAccountType == \'POSITION\' && @.isActive  == 1)].currency'
              }
            },
            {
              fact: 'payload',
              path: '$.amount.currency',
              operator: 'notIn',
              value: {
                fact: 'payee',
                path: '$.accounts[?(@.ledgerAccountType == \'POSITION\' && @.isActive  == 1)].currency'
              }
            }
          ]
        },
        {
          fact: 'payee',
          path: '$.accounts[?(@.ledgerAccountType == \'POSITION\' && @.isActive  == 1)]',
          operator: 'isArray',
          value: true
        }
      ]
    },
    event: {
      type: 'INVALID_QUOTE_REQUEST',
      params: {
        FSPIOPError: 'PAYEE_ERROR',
        message: 'Payee FSP has more than 1 active currency account. Switch does not support more than 1 active currency account for Forex Requests'
      }
    }
  }
}

describe('Forex rules', () => {
  describe('EURtoXOFSendEUR', () => {
    it('raises INTERCEPT_QUOTE', async () => {
      const testFacts = {
        payload: {
          payer: {
            partyIdInfo: {
              fspId: 'payeefsp'
            }
          },
          amount: {
            currency: 'EUR'
          }
        },
        headers: {
          'fspiop-source': 'blah'
        },
        payee: {
          accounts: [
            { isActive: 1, ledgerAccountType: 'POSITION', currency: 'XYZ' }
          ]
        }
      }
      const { events } = await RulesEngine.run([fxRules.EURtoXOFSendEUR], testFacts)
      expect(events).toEqual([fxRules.EURtoXOFSendEUR.event])
    })
  })
  describe('EURtoXOFReceiveXOF', () => {
    it('raises INTERCEPT_QUOTE', async () => {
      const testFacts = {
        payload: {
          payer: {
            partyIdInfo: {
              fspId: 'payerfsp'
            }
          },
          amount: {
            currency: 'XOF'
          }
        },
        headers: {
          'fspiop-source': 'blah'
        },
        payer: {
          accounts: [
            { isActive: 1, ledgerAccountType: 'POSITION', currency: 'xyz' }
          ]
        }
      }
      const { events } = await RulesEngine.run([fxRules.EURtoXOFReceiveXOF], testFacts)
      expect(events).toEqual([fxRules.EURtoXOFReceiveXOF.event])
    })
  })
  describe('XOFtoEURSendXOF', () => {
    it('raises INTERCEPT_QUOTE', async () => {
      const testFacts = {
        payload: {
          payer: {
            partyIdInfo: {
              fspId: 'payeefsp'
            }
          },
          amount: {
            currency: 'XOF'
          }
        },
        headers: {
          'fspiop-source': 'blah'
        },
        payee: {
          accounts: [
            { isActive: 1, ledgerAccountType: 'POSITION', currency: 'EUR' }
          ]
        }
      }
      const { events } = await RulesEngine.run([fxRules.XOFtoEURSendXOF], testFacts)
      expect(events).toEqual([fxRules.XOFtoEURSendXOF.event])
    })
  })
  describe('XOFtoEURReceiveEUR', () => {
    it('raises INTERCEPT_QUOTE', async () => {
      const testFacts = {
        payload: {
          payer: {
            partyIdInfo: {
              fspId: 'payeefsp'
            }
          },
          amount: {
            currency: 'EUR'
          }
        },
        headers: {
          'fspiop-source': 'blah'
        },
        payer: {
          accounts: [
            { isActive: 1, ledgerAccountType: 'POSITION', currency: 'xyz' }
          ]
        }
      }
      const { events } = await RulesEngine.run([fxRules.XOFtoEURReceiveEUR], testFacts)
      expect(events).toEqual([fxRules.XOFtoEURReceiveEUR.event])
    })
  })
  describe('payerUnsupportedCurrency', () => {
    it('raises INVALID_QUOTE_REQUEST', async () => {
      const testFacts = {
        payload: {
          payer: {
            partyIdInfo: {
              fspId: 'payerfsp'
            }
          },
          amountType: 'SEND',
          amount: {
            currency: 'EUR'
          }
        },
        headers: {
          'fspiop-source': 'payerfsp'
        },
        payer: {
          accounts: [
            { isActive: 1, ledgerAccountType: 'POSITION', currency: 'xyz' }
          ]
        }
      }
      const { events } = await RulesEngine.run([fxRules.payerUnsupportedCurrency], testFacts)
      expect(events).toEqual([fxRules.payerUnsupportedCurrency.event])
    })
  })
  describe('payeeUnsupportedCurrency', () => {
    it('raises INVALID_QUOTE_REQUEST', async () => {
      const testFacts = {
        payload: {
          payer: {
            partyIdInfo: {
              fspId: 'payerfsp'
            }
          },
          amountType: 'RECEIVE',
          amount: {
            currency: 'XOF'
          }
        },
        headers: {
          'fspiop-source': 'payerfsp'
        },
        payee: {
          accounts: [
            { isActive: 1, ledgerAccountType: 'POSITION', currency: 'xyz' }
          ]
        }
      }
      const { events } = await RulesEngine.run([fxRules.payeeUnsupportedCurrency], testFacts)
      expect(events).toEqual([fxRules.payeeUnsupportedCurrency.event])
    })
  })
  describe('FSPIOPSourceDoesNotMatchPayer', () => {
    it('raises INVALID_QUOTE_REQUEST', async () => {
      const testFacts = {
        payload: {
          payer: {
            partyIdInfo: {
              fspId: 'payerfsp'
            }
          },
          amountType: 'RECEIVE',
          amount: {
            currency: 'XOF'
          }
        },
        headers: {
          'fspiop-source': 'blah'
        },
        payee: {
          accounts: [
            { isActive: 1, ledgerAccountType: 'POSITION', currency: 'xyz' }
          ]
        }
      }
      const { events } = await RulesEngine.run([fxRules.FSPIOPSourceDoesNotMatchPayer], testFacts)
      expect(events).toEqual([fxRules.FSPIOPSourceDoesNotMatchPayer.event])
    })
  })
  describe('firstNameMissing', () => {
    it('raises INVALID_QUOTE_REQUEST', async () => {
      const testFacts = {
        payload: {
          payer: {
            partyIdInfo: {
              fspId: 'payerfsp'
            }
          },
          personalInfo: {
            complexName: {
              lastName: 'Hagman'
            },
            dateOfBirth: '1983-10-25'
          },
          amountType: 'RECEIVE',
          amount: {
            currency: 'XOF'
          }
        },
        headers: {
          'fspiop-source': 'payerfsp'
        },
        payer: {
          accounts: [
            { isActive: 1, ledgerAccountType: 'POSITION', currency: 'EUR' }
          ]
        },
        payee: {
          accounts: [
            { isActive: 1, ledgerAccountType: 'POSITION', currency: 'XOF' }
          ]
        }

      }
      const { events } = await RulesEngine.run([fxRules.firstNameMissing], testFacts)
      expect(events).toEqual([fxRules.firstNameMissing.event])
    })
  })
  describe('payerHasMoreThanOneCurrency', () => {
    it('raises INVALID_QUOTE_REQUEST', async () => {
      const testFacts = {
        payload: {
          payer: {
            partyIdInfo: {
              fspId: 'payerfsp'
            }
          },
          amountType: 'RECEIVE',
          amount: {
            currency: 'XOF'
          }
        },
        headers: {
          'fspiop-source': 'payerfsp'
        },
        payer: {
          accounts: [
            { isActive: 1, ledgerAccountType: 'POSITION', currency: 'EUR' },
            { isActive: 1, ledgerAccountType: 'POSITION', currency: 'USD' }
          ]
        },
        payee: {
          accounts: [
            { isActive: 1, ledgerAccountType: 'POSITION', currency: 'XOF' }
          ]
        }

      }
      const { events } = await RulesEngine.run([fxRules.payerHasMoreThanOneCurrency], testFacts)
      expect(events).toEqual([fxRules.payerHasMoreThanOneCurrency.event])
    })
  })
  describe('payeeHasMoreThanOneCurrency', () => {
    it('raises INVALID_QUOTE_REQUEST', async () => {
      const testFacts = {
        payload: {
          payer: {
            partyIdInfo: {
              fspId: 'payerfsp'
            }
          },
          amountType: 'RECEIVE',
          amount: {
            currency: 'XOF'
          }
        },
        headers: {
          'fspiop-source': 'payerfsp'
        },
        payer: {
          accounts: [
            { isActive: 1, ledgerAccountType: 'POSITION', currency: 'EUR' }
          ]
        },
        payee: {
          accounts: [
            { isActive: 1, ledgerAccountType: 'POSITION', currency: 'XOF' },
            { isActive: 1, ledgerAccountType: 'POSITION', currency: 'USD' }
          ]
        }

      }
      const { events } = await RulesEngine.run([fxRules.payeeHasMoreThanOneCurrency], testFacts)
      expect(events).toEqual([fxRules.payeeHasMoreThanOneCurrency.event])
    })
  })
})
