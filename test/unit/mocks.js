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
  error: jest.fn(),
  isFinished: false,
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
  fxQuoteUpdateRequest: ({
    condition = randomUUID(),
    conversionTerms = fxQuoteMocks.fxQuoteRequest().conversionTerms
  } = {}) => ({
    condition,
    conversionTerms
  }),
  headers: () => ({
    accept: 'application/vnd.interoperability.fxquotes+json;version=1.0',
    'content-type': 'application/vnd.interoperability.fxquotes+json;version=1.0',
    'content-length': '100',
    date: new Date().toISOString(),
    'fspiop-source': 'mockSource',
    'fspiop-destination': 'mockDestination'
  }),
  span: () => ({
    getChild: jest.fn().mockReturnValue(mockSpan())
  }),
  source: 'mockSource',
  destination: 'mockDestination',
  initiatingFsp: 'mockInitiator',
  counterPartyFsp: 'mockcCounterParty',
  conversionRequestId: randomUUID(),
  error: () => ({
    code: 2001,
    message: 'Generic server error'
  }),
  httpRequestOptions: () => ({
  }),
  db: ({
    commit = jest.fn().mockResolvedValue({}),
    rollback = jest.fn(),
    getParticipant = jest.fn().mockResolvedValue({}),
    getParticipantEndpoint = jest.fn().mockResolvedValue(undefined),
    createFxQuoteResponse = jest.fn().mockResolvedValue({}),
    createFxQuoteResponseConversionTerms = jest.fn().mockResolvedValue({}),
    createFxQuoteResponseFxCharge = jest.fn().mockResolvedValue({}),
    createFxQuoteResponseConversionTermsExtension = jest.fn().mockResolvedValue({}),
    createFxQuoteResponseDuplicateCheck = jest.fn().mockResolvedValue({}),
    newTransaction = jest.fn().mockResolvedValue({ commit, rollback }),
    createFxQuoteDuplicateCheck = jest.fn().mockResolvedValue({}),
    createFxQuote = jest.fn().mockResolvedValue({}),
    createFxQuoteConversionTerms = jest.fn().mockResolvedValue({}),
    createFxQuoteConversionTermsExtension = jest.fn().mockResolvedValue({}),
    createFxQuoteError = jest.fn().mockResolvedValue({})
  } = {}) => ({
    getParticipant,
    getParticipantEndpoint,
    createFxQuoteResponse,
    createFxQuoteResponseConversionTerms,
    createFxQuoteResponseFxCharge,
    createFxQuoteResponseConversionTermsExtension,
    createFxQuoteResponseDuplicateCheck,
    newTransaction,
    createFxQuoteDuplicateCheck,
    createFxQuote,
    createFxQuoteConversionTerms,
    createFxQuoteConversionTermsExtension,
    createFxQuoteError,
    commit,
    rollback
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
    debug: jest.fn(),
    verbose: jest.fn()
  })
}

module.exports = {
  mockHttpRequest,
  createMockHapiHandler,
  fxQuoteMocks,
  mockSpan
}
