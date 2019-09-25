
const RulesEngine = require(`${__SRC__}/model/rules`)

test('Test rules engine jsonpath and notDeepEqual operator', async () => {
  const conditions = {
    any: [{
      fact: 'json-path',
      params: {
        fact: 'payload',
        path: '$.payload.payer.partyIdInfo.fspId'
      },
      operator: 'notDeepEqual',
      value: [ 'payerfsp' ]
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
  expect(events).toEqual([ event ])
})

test('Test rules engine jsonpath fact-fact comparison', async () => {
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
  expect(events).toEqual([ event ])
})

test('Test rules engine jsonpath array filter', async () => {
  const conditions = {
    any: [{
      fact: 'json-path',
      params: {
        fact: 'payload',
        path: '$.payload.extensionList[?(@.key === \'KYCPayerTier\')].value'
      },
      operator: 'notDeepEqual',
      value: [ '1' ]
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
  expect(events).toEqual([ event ])
})

test('Test rules engine deepEqual operator', async () => {
  const conditions = {
    any: [{
      fact: 'json-path',
      params: {
        fact: 'payload',
        path: '$.payload.extensionList[?(@.key === \'KYCPayerTier\')].value'
      },
      operator: 'deepEqual',
      value: [ '1' ]
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
  expect(events).toEqual([ event ])
})

test('Test rules engine example config INTERCEPT_QUOTE event', async () => {
  const rules = require(`${__ROOT__}/config/rules.example.json`)
  const testFacts = {
    payee: {
      accounts: [{
        ledgerAccountType: "SETTLEMENT",
        currency: "ZAR"
      }]
    },
    payload: {
      amount: {
        currency: "XOF"
      },
      extensionList: [
        { key: 'blah', value: 'whatever' },
        { key: 'KYCPayerTier', value: '1' },
        { key: 'noise', value: 'blah' }
      ]
    }
  }
  const { events } = await RulesEngine.run(rules, testFacts)
  expect(events).toEqual([ rules[0].event ])
})

test('Test rules engine example config INTERCEPT_QUOTE event negative case', async () => {
  const rules = require(`${__ROOT__}/config/rules.example.json`)
  const testFacts = {
    payee: {
      accounts: [{
        ledgerAccountType: "SETTLEMENT",
        currency: "XOF"
      }]
    },
    payload: {
      amount: {
        currency: "XOF"
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

test('Test rules engine example config INVALID_QUOTE_REQUEST event', async () => {
  const rules = require(`${__ROOT__}/config/rules.example.json`)
  const testFacts = {
    payee: {
      accounts: [{
        ledgerAccountType: "SETTLEMENT",
        currency: "ZAR"
      }]
    },
    payload: {
      amount: {
        currency: "XOF"
      },
      extensionList: [
        { key: 'blah', value: 'whatever' },
        { key: 'KYCPayerTier', value: '2' },
        { key: 'noise', value: 'blah' }
      ]
    }
  }
  const { events } = await RulesEngine.run(rules, testFacts)
  expect(events).toEqual([ rules[1].event ])
})

test('Test rules engine example config INVALID_QUOTE_REQUEST event negative case', async () => {
  const rules = require(`${__ROOT__}/config/rules.example.json`)
  const testFacts = {
    payee: {
      accounts: [{
        ledgerAccountType: "SETTLEMENT",
        currency: "XOF"
      }]
    },
    payload: {
      amount: {
        currency: "XOF"
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
