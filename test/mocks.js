/*****
 License
 --------------
 Copyright © 2020-2025 Mojaloop Foundation
 The Mojaloop files are made available by the Mojaloop Foundation under the Apache License, Version 2.0 (the "License") and you may not use these files except in compliance with the License. You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, the Mojaloop files are distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.

 Contributors
 --------------
 This is the official list of the Mojaloop project contributors for this file.
 Names of the original copyright holders (individuals or organizations)
 should be listed with a '*' in the first column. People who have
 contributed from an organization can be listed under the organization
 that actually holds the copyright for their contributions (see the
 Mojaloop Foundation for an example). Those individuals should have
 their names indented and be marked with a '-'. Email address can be added
 optionally within square brackets <email>.

 * Mojaloop Foundation
 - Name Surname <name.surname@mojaloop.io>
*****/

const idGenerator = require('@mojaloop/central-services-shared').Util.id
const { encodePayload } = require('@mojaloop/central-services-shared').Util.StreamingProtocol
const uuid = require('node:crypto').randomUUID
const Config = require('../src/lib/config')
const { RESOURCES } = require('../src/constants')

const config = new Config()

const CONTENT_TYPE = 'application/vnd.interoperability.quotes+json;version={{API_VERSION}}'
const contentTypeFn = ({ fspiopVersion = 1.0 }) => CONTENT_TYPE.replace('{{API_VERSION}}', fspiopVersion)

const generateULID = idGenerator({ type: 'ulid' })

const proxyCacheConfigDto = ({
  type = 'redis'
} = {}) => Object.freeze({
  type,
  proxyConfig: {
    ...(type === 'redis' && {
      host: 'localhost', port: 6379
    }),
    ...(type === 'redis-cluster' && {
      cluster: [{ host: 'localhost', port: 6379 }]
    })
  },
  timeout: 5000 // is it used anywhere?
})

const kafkaMessagePayloadDto = ({
  action = 'put',
  from = config.hubName,
  to = 'greenbank',
  id = 'aaab9c4d-2aac-42ef-8aad-2e76f2fac95a',
  type = 'quote',
  payloadBase64 = 'eyJlcnJvckluZm9ybWF0aW9uIjp7ImVycm9yQ29kZSI6IjUxMDAiLCJlcnJvckRlc2NyaXB0aW9uIjoiRXJyb3IgZGVzY3JpcHRpb24ifX0=',
  createdAtMs = Date.now(),
  fspiopVersion = '1.0',
  operationId = 'QuotesByID'
} = {}) => Object.freeze({
  from,
  to,
  id,
  type,
  content: {
    requestId: `${createdAtMs}:4015872a9e16:28:lsunvmzh:10002`,
    headers: {
      'content-type': contentTypeFn({ fspiopVersion }),
      accept: contentTypeFn({ fspiopVersion }),
      date: new Date(createdAtMs).toUTCString(),
      'fspiop-source': from,
      'fspiop-destination': to,
      traceparent: '00-aabbc4ff1f62cecc899cf5d8d51f42b7-0123456789abcdef0-00',
      'cache-control': 'no-cache',
      host: 'localhost:3002',
      connection: 'keep-alive',
      'content-length': '102'
    },
    payload: `data:${contentTypeFn({ fspiopVersion })};base64,${payloadBase64}`,
    uriParams: { id },
    spanContext: {
      service: operationId,
      traceId: 'aabbc4ff1f62cecc899cf5d8d51f42b7',
      spanId: '3aa852c7fa9edfbc',
      sampled: 0,
      flags: '00',
      startTimestamp: new Date(createdAtMs).toISOString(),
      tags: {
        tracestate: 'acmevendor=eyJzcGFuSWQiOiIzYWE4NTJjN2ZhOWVkZmJjIn0='
      },
      tracestates: {
        acmevendor: {
          spanId: '3aa852c7fa9edfbc'
        }
      }
    },
    id,
    type,
    action
  },
  metadata: {
    correlationId: id,
    event: {
      type,
      action,
      createdAt: new Date(createdAtMs).toISOString(),
      state: {
        status: 'success',
        code: 0,
        description: 'action successful'
      }
    },
    'protocol.createdAt': createdAtMs
  }
})

const kafkaMessagePayloadPostDto = (params = {}) => kafkaMessagePayloadDto({
  ...params,
  action: 'post',
  operationId: 'Quotes'
})

const kafkaMessageFxPayloadPostDto = (params = {}) => kafkaMessagePayloadDto({
  ...params,
  fspiopVersion: '2.0',
  action: 'post',
  type: 'fxquote',
  operationId: 'FxQuotesPost'
})

const kafkaMessageFxPayloadPutDto = (params = {}) => {
  const dto = {
    ...kafkaMessagePayloadDto({
      ...params,
      fspiopVersion: '2.0',
      action: 'put',
      type: 'fxquote',
      operationId: 'FxQuotesPut'
    })
  }
  delete dto.content.headers.accept
  return dto
}

const kafkaMessageFxPayloadGetDto = (params = {}) => kafkaMessagePayloadDto({
  ...params,
  fspiopVersion: '2.0',
  action: 'get',
  type: 'fxquote',
  operationId: 'FxQuotesGet'
})

const postFxQuotesPayloadDto = ({
  conversionRequestId = generateULID(),
  conversionId = generateULID(),
  determiningTransferId = generateULID(),
  initiatingFsp = 'pinkbank',
  counterPartyFsp = 'redbank',
  amountType = 'SEND',
  sourceAmount = {
    currency: 'USD',
    amount: '300'
  },
  targetAmount = {
    currency: 'ZMW',
    amount: '0'
  },
  expiration = new Date(Date.now() + 5 * 60 * 1000).toISOString(),
  extensionList = {
    extension: [
      {
        key: 'Test',
        value: 'Data'
      }
    ]
  }
} = {}) => ({
  conversionRequestId,
  conversionTerms: {
    conversionId,
    ...(determiningTransferId && { determiningTransferId }),
    initiatingFsp,
    counterPartyFsp,
    amountType,
    sourceAmount,
    targetAmount,
    expiration,
    ...(extensionList && { extensionList })
  }
})

const putFxQuotesPayloadDto = ({
  fxQuotesPostPayload = postFxQuotesPayloadDto(),
  condition = 'mock-condition',
  charges = [{ chargeType: 'Tax', sourceAmount: { amount: '1', currency: 'USD' }, targetAmount: { amount: '100', currency: 'ZMW' } }]
} = {}) => {
  const dto = {
    ...fxQuotesPostPayload,
    condition
  }
  dto.conversionTerms.targetAmount.amount = 600
  dto.conversionTerms.charges = charges
  return dto
}

const postQuotesPayloadDto = ({
  from = 'payer',
  to = 'payee',
  quoteId = generateULID(),
  transactionId = generateULID(),
  amountType = 'SEND',
  amount = { amount: '100', currency: 'USD' },
  transactionType = transactionTypeDto(),
  payer = { partyIdInfo: { partyIdType: 'MSISDN', partyIdentifier: '987654321', fspId: from } },
  payee = { partyIdInfo: { partyIdType: 'MSISDN', partyIdentifier: '123456789', fspId: to } }
} = {}) => ({
  quoteId,
  transactionId,
  amountType,
  amount,
  transactionType,
  payer,
  payee
})

const putQuotesPayloadDto = ({
  transferAmount = { amount: '100', currency: 'USD' },
  payeeReceiveAmount = { amount: '100', currency: 'USD' },
  ilpPacket = 'test-ilp-packet',
  condition = 'test-condition',
  expiration = (new Date()).toISOString()
} = {}) => ({
  transferAmount,
  payeeReceiveAmount,
  ilpPacket,
  condition,
  expiration
})

const postBulkQuotesPayloadDto = ({
  from = 'payer',
  to = 'payee',
  bulkQuoteId = uuid(),
  quoteIds = [uuid()],
  payer = { partyIdInfo: { partyIdType: 'MSISDN', partyIdentifier: '987654321', fspId: from } },
  individualQuotes = [
    {
      quoteId: quoteIds[0],
      transactionId: uuid(),
      payee: { partyIdInfo: { partyIdType: 'MSISDN', partyIdentifier: '123456789', fspId: to } },
      amountType: 'SEND',
      amount: { amount: '100', currency: 'USD' },
      transactionType: transactionTypeDto()
    }
  ]
} = {}) => ({
  bulkQuoteId,
  payer,
  individualQuotes
})

const putBulkQuotesPayloadDto = ({
  to = 'payee',
  quoteIds = [uuid()],
  individualQuoteResults = [
    {
      quoteId: quoteIds[0],
      payee: { partyIdInfo: { partyIdType: 'MSISDN', partyIdentifier: '123456789', fspId: to } },
      transferAmount: { amount: '100', currency: 'USD' },
      payeeReceiveAmount: { amount: '100', currency: 'USD' },
      payeeFspFee: { amount: '0', currency: 'USD' },
      payeeFspCommission: { amount: '0', currency: 'USD' },
      ilpPacket: 'test-ilp-packet',
      condition: 'test-condition'
    }
  ],
  expiration = new Date(Date.now() + 5 * 60 * 1000).toISOString()
} = {}) => ({
  individualQuoteResults,
  expiration
})

const transactionTypeDto = ({
  scenario = 'DEPOSIT',
  initiator = 'PAYER',
  initiatorType = 'CONSUMER'
} = {}) => Object.freeze({
  scenario,
  initiator,
  initiatorType
})

const interoperabilityHeaderDto = (resource, version, isIsoApi = false) => {
  const isoPart = isIsoApi ? '.iso20022' : ''
  return `application/vnd.interoperability${isoPart}.${resource}+json;version=${version}`
}

const headersDto = ({
  resource = RESOURCES.quotes,
  version = '2.0',
  source = 'mockSource',
  destination = 'mockDestination',
  isIsoApi = false
} = {}) => Object.freeze({
  accept: interoperabilityHeaderDto(resource, version, isIsoApi),
  'content-type': interoperabilityHeaderDto(resource, version, isIsoApi),
  date: new Date().toUTCString(),
  'fspiop-source': source,
  'fspiop-destination': destination
})

const errorPayloadDto = ({
  errorCode = '3100',
  errorDescription = 'Client Validation Error',
  extensionList
} = {}) => Object.freeze({
  errorInformation: {
    errorCode,
    errorDescription,
    ...(extensionList && { extensionList })
  }
})

const mockIlp4Combo = () => ({
  fulfillment: '7Gaq2EMhWqs8Wjlr6yhnACKaIGIS6gZLFj8sB8FGkHo',
  condition: 'T6s_xO9OwXuoXidLgxfrqflBI9Nd3TQCpFNV8tG7l6k',
  ilpPacket: 'DIIDSgAAAAAAAMNQMjAxNzExMTUyMzE3Mjg5ODVPqz_E707Be6heJ0uDF-up-UEj013dNAKkU1Xy0buXqQpnLm1vamFsb29wggMDZXlKeGRXOTBaVWxrSWpvaU1qQTFNRGd4T0RZdE1UUTFPQzAwWVdNd0xXRTRNalF0WkRSaU1EZGxNemRrTjJJeklpd2lkSEpoYm5OaFkzUnBiMjVKWkNJNklqSXdOVEE0TVRnMkxURTBOVGd0TkdGak1DMWhPREkwTFdRMFlqQTNaVE0zWkRkaU15SXNJblJ5WVc1ellXTjBhVzl1Vkhsd1pTSTZleUp6WTJWdVlYSnBieUk2SWxSU1FVNVRSa1ZTSWl3aWFXNXBkR2xoZEc5eUlqb2lVRUZaUlZJaUxDSnBibWwwYVdGMGIzSlVlWEJsSWpvaVEwOU9VMVZOUlZJaUxDSmlZV3hoYm1ObFQyWlFZWGx0Wlc1MGN5STZJakV4TUNKOUxDSndZWGxsWlNJNmV5SndZWEowZVVsa1NXNW1ieUk2ZXlKd1lYSjBlVWxrVkhsd1pTSTZJazFUU1ZORVRpSXNJbkJoY25SNVNXUmxiblJwWm1sbGNpSTZJakV5TXpRMU5qYzRPU0lzSW1aemNFbGtJam9pVFc5aWFXeGxUVzl1WlhraWZYMHNJbkJoZVdWeUlqcDdJbkJsY25OdmJtRnNTVzVtYnlJNmV5SmpiMjF3YkdWNFRtRnRaU0k2ZXlKbWFYSnpkRTVoYldVaU9pSk5ZWFJ6SWl3aWJHRnpkRTVoYldVaU9pSklZV2R0WVc0aWZYMHNJbkJoY25SNVNXUkpibVp2SWpwN0luQmhjblI1U1dSVWVYQmxJam9pVFZOSlUwUk9JaXdpY0dGeWRIbEpaR1Z1ZEdsbWFXVnlJam9pT1RnM05qVTBNeUlzSW1aemNFbGtJam9pUW1GdWEwNXlUMjVsSW4xOUxDSmxlSEJwY21GMGFXOXVJam9pTWpBeE55MHhNUzB4TlZReU1qb3hOem95T0M0NU9EVXRNREU2TURBaUxDSmhiVzkxYm5RaU9uc2lZVzF2ZFc1MElqb2lOVEF3SWl3aVkzVnljbVZ1WTNraU9pSlZVMFFpZlgw'
})

const toBuffer = json => Buffer.from(JSON.stringify(json))

const mockHttpRequest = ({
  requestId = uuid(),
  payload = {},
  params = {},
  headers = {
    'fspiop-source': 'payerFsp',
    'content-type': 'application/vnd.interoperability.quotes+json;version=1.0'
  },
  app = {
    database: jest.fn(),
    config: new Config()
  }
} = {}) => ({
  payload,
  rawPayload: toBuffer(payload), // by HapiRawPayload plugin
  dataUri: encodePayload(toBuffer(payload), headers['content-type']), // by HapiRawPayload plugin
  params,
  headers,
  info: {
    id: requestId
  },
  server: {
    app,
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
  fxQuoteRequest: ({ conversionRequestId = uuid() } = {}) => ({
    conversionRequestId,
    conversionTerms: {
      conversionId: uuid(),
      determiningTransferId: uuid(),
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
    condition = uuid(),
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
  conversionRequestId: uuid(),
  error: () => ({
    code: 2001,
    message: 'Generic server error'
  }),
  httpRequestOptions: () => ({
  }),
  db: ({
    commit = jest.fn().mockResolvedValue({}),
    rollback = jest.fn(() => Promise.reject(new Error('DB error'))),
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

const jwsSigningKey = `-----BEGIN RSA PRIVATE KEY-----
MIIEowIBAAKCAQEA0eJEh3Op5p6x137lRkAsvmEBbd32dbRChrCUItZbtxjf/qfB
yD5k8Hn4n4vbqzP8XSGS0f6KmNC+iRaP74HVgzAqc4Uid4J8dtSBq3VmucYQYzLc
101QjuvD+SKmZwlw/q0PtulmqlASI2SbMfwcAraMi6ab7v5W4EGNeIPLEIo3BXsQ
DTCWqiZb7aXkHkcY7sOjAzK/2bNGYFmAthdYrHzvCkqnJ7LAHX3Oj7rJea5MqtuN
B9POZYaD10n9JuYWdwPqLrw6/hVgPSFEy+ulrVbXf54ZH0dfMThAYRvFrT81yulk
H95JhXWGdi6cTp6t8LVOKFhnNfxjWw0Jayj9xwIDAQABAoIBADB2u/Y/CgNbr5sg
DRccqHhJdAgHkep59kadrYch0knEL6zg1clERxCUSYmlxNKSjXp/zyQ4T46b3PNQ
x2m5pDDHxXWpT10jP1Q9G7gYwuCw0IXnb8EzdB+cZ0M28g+myXW1RoSo/nDjTlzn
1UJEgb9Kocd5cFZOWocr+9vRKumlZULMsA8yiNwlAfJHcMBM7acsa3myCqVhLyWt
4BQylVuLFa+A6QzpMXEwFCq8EOXf07gl1XVzC6LJ1fTa9gVM3N+YE+oEXKrsHCxG
/ACgKsjepL27QjJ7qvecWPP0F2LxEZYOm5tbXaKJTobzQUJHgUokanZMhjYprDsZ
zumLw9kCgYEA/DUWcnLeImlfq/EYdhejkl3J+WX3vhS23OqVgY1amu7CZzaai6vt
H0TRc8Zsbi4jgmFDU8PFzytP6qz6Tgom4R736z6oBi7bjnGyN17/NSbf+DaRVcM6
vnZr7jNC2FJlECmIN+dkwUA/YCr2SA7hxZXM9mIYSc+6+glDiIO5Cf0CgYEA1Qo/
uQbVHhW+Cp8H0kdMuhwUbkBquRrxRZlXS1Vrf3f9me9JLUy9UPWb3y3sKVurG5+O
SIlr4hDcZyXdE198MtDMhBIGqU9ORSjppJDNDVvtt+n2FD4XmWIU70vKBJBivX0+
Bow6yduis+p12fuvpvpnKCz8UjOgOQJhLZ4GQBMCgYBP6gpozVjxkm4ML2LO2IKt
+CXtbo/nnOysZ3BkEoQpH4pd5gFmTF3gUJAFnVPyPZBm2abZvejJ0jGKbLELVVAo
eQWZdssK2oIbSo9r2CAJmX3SSogWorvUafWdDoUZwlHfoylUfW+BhHgQYsyS3JRR
ZTwCveZwTPA0FgdeFE7niQKBgQCHaD8+ZFhbCejDqXb4MXdUJ3rY5Lqwsq491YwF
huKPn32iNNQnJcqCxclv3iln1Cr6oLx34Fig1KSyLv/IS32OcuY635Y6UPznumxe
u+aJIjADIILXNOwdAplZy6s4oWkRFaSx1rmbCa3tew2zImTv1eJxR76MpOGmupt3
uiQw3wKBgFjBT/aVKdBeHeP1rIHHldQV5QQxZNkc6D3qn/oAFcwpj9vcGfRjQWjO
ARzXM2vUWEet4OVn3DXyOdaWFR1ppehz7rAWBiPgsMg4fjAusYb9Mft1GMxMzuwT
Oyqsp6pzAWFrCD3JAoTLxClV+j5m+SXZ/ItD6ziGpl/h7DyayrFZ
-----END RSA PRIVATE KEY-----`

module.exports = {
  headersDto,
  kafkaMessagePayloadDto,
  kafkaMessagePayloadPostDto,
  kafkaMessageFxPayloadPostDto,
  kafkaMessageFxPayloadPutDto,
  kafkaMessageFxPayloadGetDto,
  proxyCacheConfigDto,
  postFxQuotesPayloadDto,
  putFxQuotesPayloadDto,
  postQuotesPayloadDto,
  putQuotesPayloadDto,
  postBulkQuotesPayloadDto,
  putBulkQuotesPayloadDto,
  errorPayloadDto,
  transactionTypeDto,
  mockIlp4Combo,
  generateULID,
  mockHttpRequest,
  createMockHapiHandler,
  fxQuoteMocks,
  mockSpan,
  jwsSigningKey
}
