const { randomUUID } = require('node:crypto')

const mockHttpRequest = ({
  requestId = randomUUID(),
  payload = {},
  params = {},
  headers = {
    'fspiop-source': 'payerFsp',
    'content-type': 'application/vnd.interoperability.quotes+json;version=1.0'
  }
} = {}) => ({
  payload,
  params,
  headers,
  info: {
    id: requestId
  },
  server: {
    app: {
      database: jest.fn()
    },
    log: jest.fn()
  },
  span: {
    setTags: jest.fn(),
    audit: jest.fn()
  }
})

const createMockHapiHandler = () => {
  const code = jest.fn()
  const handler = {
    response: jest.fn(() => ({ code }))
  }

  return { handler, code }
}

const mockSpan = () => ({
  setTags: jest.fn(),
  audit: jest.fn(),
  finish: jest.fn(),
  getChild: jest.fn(),
  injectContextToHttpRequest: jest.fn().mockImplementation(param => param)
})

const fxQuoteMocks = {
  fxQuoteRequest: ({ conversionRequestId = randomUUID() } = {}) => ({
    conversionRequestId,
    conversionTerms: {
      conversionId: randomUUID(),
      determiningTransferId: randomUUID(),
      initiatingFsp: 'mockInitiator',
      counterPartyFsp: 'mockCounterParty',
      amountType: 'SEND',
      sourceAmount: {
        currency: 'ZMW',
        amount: '100'
      },
      targetAmount: {
        currency: 'TZS',
        amount: '10395'
      },
      expiration: new Date(Date.now() + 10_000).toISOString(),
      charges: [
        {
          chargeType: 'TRANSACTION FEE',
          sourceAmount: {
            currency: 'ZMW',
            amount: '1'
          },
          targetAmount: {
            currency: 'TZS',
            amount: '103'
          }
        }
      ],
      extensionList: {
        extension: [
          {
            key: 'key1',
            value: 'value1'
          }
        ]
      }
    }
  }),
  headers: () => ({
    Accept: 'application/vnd.interoperability.fxquotes+json;version=1.0',
    'Content-Type': 'application/vnd.interoperability.fxquotes+json;version=1.0',
    'Content-Length': '100',
    date: new Date().toISOString(),
    'fspiop-source': 'mockSource',
    'fspiop-destination': 'mockDestination'
  }),
  span: () => ({
    getChild: jest.fn().mockReturnValue(mockSpan())
  }),
  source: 'mockSource',
  destination: 'mockcDestination',
  initiatingFsp: 'mockInitiator',
  counterPartyFsp: 'mockcCounterParty',
  conversionRequestId: randomUUID(),
  error: () => ({
    code: 2001,
    message: 'Generic server error'
  }),
  httpRequestOptions: () => ({
  }),
  db: ({ getParticipant = jest.fn().mockResolvedValue({}) } = {}) => ({
    getParticipant
  }),
  proxyClient: ({
    isConnected = jest.fn().mockReturnValue(true),
    connect = jest.fn().mockResolvedValue(true),
    lookupProxyByDfspId = jest.fn().mockResolvedValue('mockProxy')
  } = {}) => ({
    isConnected,
    connect,
    lookupProxyByDfspId
  }),
  logger: () => ({
    error: jest.fn(),
    info: jest.fn(),
    debug: jest.fn()
  })
}

module.exports = {
  mockHttpRequest,
  createMockHapiHandler,
  fxQuoteMocks,
  mockSpan
}
