const rules = require(`${__ROOT__}/config/rules.json`)
const RulesEngine = require(`${__SRC__}/model/rules`)

describe('RulesEngine', () => {
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
    const { events } = await RulesEngine.run(rules, testFacts)
    expect(events).toEqual([rules[0].event])
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
    const { events } = await RulesEngine.run(rules, testFacts)
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
    const { events } = await RulesEngine.run(rules, testFacts)
    expect(events).toEqual([rules[1].event])
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
    const { events } = await RulesEngine.run(rules, testFacts)
    expect(events).toEqual([rules[1].event])
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
    const { events } = await RulesEngine.run(rules, testFacts)
    expect(events).toEqual([])
  })
})
