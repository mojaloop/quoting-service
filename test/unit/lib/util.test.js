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

 * Crosslake
 - Lewis Daly <lewisd@crosslaketech.com>

 --------------
 ******/
'use strict'

jest.mock('axios')
jest.mock('@mojaloop/central-services-logger')

const fs = require('node:fs/promises')
const axios = require('axios')
const Logger = require('@mojaloop/central-services-logger')
const { Cache } = require('memory-cache')
const { Enum } = require('@mojaloop/central-services-shared')

let Config = require('../../../src/lib/config.js')
const { RESOURCES, ISO_HEADER_PART } = require('../../../src/constants')
let {
  failActionHandler,
  getStackOrInspect,
  getSpanTags,
  generateRequestHeaders,
  generateRequestHeadersForJWS,
  removeEmptyKeys,
  fetchParticipantInfo,
  getParticipantEndpoint,
  makeAppInteroperabilityHeader,
  resolveOpenApiSpecPath
} = require('../../../src/lib/util')

Logger.isDebugEnabled = jest.fn(() => true)
Logger.isErrorEnabled = jest.fn(() => true)
Logger.isInfoEnabled = jest.fn(() => true)

// load config
const config = new Config()

describe('util', () => {
  const mockData = {
    amountTypeId: 'fakeAmountTypeId',
    endpoints: {
      payerfsp: 'http://localhost:8444/payerfsp',
      payeefsp: 'http://localhost:8444/payeefsp',
      invalid: 'http://invalid.com/',
      invalidResponse: 'http://invalid-response.com/'
    },
    geoCode: {
      latitude: '42.69751',
      longitude: '23.32415'
    },
    headers: {
      Accept: 'application/vnd.interoperability.quotes+json;version=1.1',
      'Content-Type': 'application/vnd.interoperability.quotes+json;version=1.1',
      'fspiop-source': 'dfsp1',
      'fspiop-destination': 'dfsp2'
    },
    switchHeaders: {
      Accept: 'application/vnd.interoperability.transfers+json;version=1.1',
      'Content-Type': 'application/vnd.interoperability.transfers+json;version=1.1',
      'fspiop-source': config.hubName,
      'fspiop-destination': 'dfsp2'
    },
    initiatorType: 'fakeInitiatorType',
    initiator: 'fakeInitiator',
    quoteId: 'test123',
    quoteRequest: {
      quoteId: 'test123',
      transactionId: 'abc123',
      payee: {
        partyIdInfo: {
          partyIdType: 'MSISDN',
          partyIdentifier: '27824592509',
          fspId: 'dfsp2'
        }
      },
      payer: {
        partyIdInfo: {
          partyIdType: 'MSISDN',
          partyIdentifier: '27713803905',
          fspId: 'dfsp1'
        }
      },
      amountType: 'SEND',
      amount: {
        amount: 100,
        currency: 'USD'
      },
      transactionType: {
        scenario: 'TRANSFER',
        initiator: 'PAYER',
        initiatorType: 'CONSUMER'
      },
      geoCode: {
        latitude: '43.69751',
        longitude: '24.32415'
      },
      extensionList: {
        extension: [{
          key: 'key1',
          value: 'value1'
        }]
      }
    },
    quoteUpdate: {
      transferAmount: {
        amount: '100',
        currency: 'USD'
      },
      payeeReceiveAmount: {
        amount: '95',
        currency: 'USD'
      },
      payeeFspFee: {
        amount: '3',
        currency: 'USD'
      },
      payeeFspCommission: {
        amount: '2',
        currency: 'USD'
      },
      expiration: '2019-10-30T10:30:19.899Z',
      geoCode: {
        latitude: '42.69751',
        longitude: '23.32415'
      },
      ilpPacket: '<ilpPacket>',
      condition: 'HOr22-H3AfTDHrSkPjJtVPRdKouuMkDXTR4ejlQa8Ks',
      extensionList: {
        extension: [{
          key: 'key1',
          value: 'value1'
        }]
      }
    },
    quoteResponse: {
      quoteId: 'test123'
    },
    rules: [
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
    ],
    scenario: 'fakeScenario',
    subScenario: 'fakeSubScenario',
    transactionReference: 'fakeTxRef'
  }

  describe('failActionHandler', () => {
    it('throws the reformatted error', async () => {
      // Arrange
      const input = new Error('Generic error')

      // Act
      const action = async () => failActionHandler(null, null, input)

      // Assert
      await expect(action()).rejects.toThrowError('Generic error')
    })
  })

  describe('getSpanTags', () => {
    it('does not get the span tags for payeeFsp and payerFsp if they do not exist', () => {
      // Arrange
      const expected = {
        transactionType: 'quote',
        transactionAction: 'prepare',
        source: 'fsp1',
        destination: config.hubName
      }
      const mockRequest = {
        params: {
          id: 'ABCDE'
        },
        payload: {
          transactionId: '12345'
        },
        headers: {
          'fspiop-source': 'fsp1',
          'fspiop-destination': config.hubName
        }
      }

      // Act
      const result = getSpanTags(mockRequest, Enum.Events.Event.Type.QUOTE, Enum.Events.Event.Action.PREPARE)

      // Assert
      expect(result).toStrictEqual(expected)
    })

    it('gets the span tags for payeeFsp and payerFsp if they do not exist', () => {
      // Arrange
      const expected = {
        transactionType: 'quote',
        transactionAction: 'prepare',
        source: 'fsp1',
        destination: config.hubName,
        payeeFsp: 'fsp1',
        payerFsp: 'fsp2'
      }
      const mockRequest = {
        params: {
          id: 'ABCDE'
        },
        payload: {
          transactionId: '12345',
          payee: {
            partyIdInfo: {
              fspId: 'fsp1'
            }
          },
          payer: {
            partyIdInfo: {
              fspId: 'fsp2'
            }
          }
        },
        headers: {
          'fspiop-source': 'fsp1',
          'fspiop-destination': config.hubName
        }
      }

      // Act
      const result = getSpanTags(mockRequest, Enum.Events.Event.Type.QUOTE, Enum.Events.Event.Action.PREPARE)

      // Assert
      expect(result).toStrictEqual(expected)
    })
  })

  describe('getStackOrInspect', () => {
    it('handles an error without a stack', () => {
      // Arrange
      const input = new Error('This is a normal error')
      delete input.stack
      const expected = '[Error: This is a normal error]'

      // Act
      const output = getStackOrInspect(input)

      // Assert
      expect(output).toBe(expected)
    })
  })

  describe('removeEmptyKeys', () => {
    it('removes nothing if there are no empty keys', () => {
      // Arrange
      const input = {
        a: 1,
        b: 2,
        c: 3
      }
      const expected = {
        a: 1,
        b: 2,
        c: 3
      }

      // Act
      const result = removeEmptyKeys(input)

      // Assert
      expect(result).toStrictEqual(expected)
    })

    it('removes a key and if it is undefined', () => {
      // Arrange
      const input = {
        a: 1,
        b: 2,
        c: undefined
      }
      const expected = {
        a: 1,
        b: 2
      }

      // Act
      const result = removeEmptyKeys(input)

      // Assert
      expect(result).toStrictEqual(expected)
    })

    it('removes an empty key', () => {
      // Arrange
      const input = {
        a: 1,
        b: 2,
        c: {

        }
      }
      const expected = {
        a: 1,
        b: 2
      }

      // Act
      const result = removeEmptyKeys(input)

      // Assert
      expect(result).toStrictEqual(expected)
    })

    it('removes a nested empty key', () => {
      // Arrange
      const input = {
        a: 1,
        b: 2,
        c: {
          d: {

          }
        }
      }
      const expected = {
        a: 1,
        b: 2,
        c: {}
      }

      // Act
      const result = removeEmptyKeys(input)

      // Assert
      expect(result).toStrictEqual(expected)
    })
  })

  describe('generateRequestHeaders', () => {
    it('generates the default request headers', () => {
      // Arrange
      const expected = {
        'Content-Type': 'application/vnd.interoperability.quotes+json;version=1.1',
        'FSPIOP-Destination': 'dfsp2',
        'FSPIOP-Source': 'dfsp1'
      }

      // Act
      const result = generateRequestHeaders(mockData.headers, config.protocolVersions, true)

      // Assert
      expect(result).toStrictEqual(expected)
    })

    it('generates default request headers, including the Accept', () => {
      // Arrange
      const expected = {
        Accept: 'application/vnd.interoperability.quotes+json;version=1.1',
        'Content-Type': 'application/vnd.interoperability.quotes+json;version=1.1',
        'FSPIOP-Destination': 'dfsp2',
        'FSPIOP-Source': 'dfsp1'
      }

      // Act
      const result = generateRequestHeaders(mockData.headers, config.protocolVersions, false)

      // Assert
      expect(result).toStrictEqual(expected)
    })

    it('generates default request headers, including the Accept and additionalHeaders', () => {
      // Arrange
      const expected = {
        Accept: 'application/vnd.interoperability.quotes+json;version=1.1',
        'Content-Type': 'application/vnd.interoperability.quotes+json;version=1.1',
        'FSPIOP-Destination': 'dfsp2',
        'FSPIOP-Source': 'dfsp1'
      }
      const additionalHeaders = {
        'x-fspsiop-sourcecurrency': 'EUR',
        'x-fspsiop-destinationcurrency': 'MAD'
      }

      // Act
      const result = generateRequestHeaders(mockData.headers, config.protocolVersions, false, RESOURCES.quotes, additionalHeaders)

      // Assert
      expect(result).toStrictEqual({ ...expected, ...additionalHeaders })
    })

    it('generates request headers, including the and converts accept and content-type to quotes', () => {
      // Arrange
      const expected = {
        Accept: makeAppInteroperabilityHeader(RESOURCES.quotes, config.protocolVersions.ACCEPT.DEFAULT),
        'Content-Type': makeAppInteroperabilityHeader(RESOURCES.quotes, config.protocolVersions.CONTENT.DEFAULT),
        'FSPIOP-Destination': 'dfsp2',
        'FSPIOP-Source': config.hubName
      }

      // Act
      const result = generateRequestHeaders(mockData.switchHeaders, config.protocolVersions, false)

      // Assert
      expect(result).toStrictEqual(expected)
    })
  })

  describe('generateRequestHeadersForJWS', () => {
    it('generates the default request headers', () => {
      // Arrange
      const expected = {
        'content-type': 'application/vnd.interoperability.quotes+json;version=1.1',
        'fspiop-destination': 'dfsp2',
        'fspiop-source': 'dfsp1'
      }

      // Act
      const result = generateRequestHeadersForJWS(mockData.headers, config.protocolVersions, true)

      // Assert
      expect(result).toStrictEqual(expected)
    })

    it('generates default request headers, including the Accept', () => {
      // Arrange
      const expected = {
        accept: 'application/vnd.interoperability.quotes+json;version=1.1',
        'content-type': 'application/vnd.interoperability.quotes+json;version=1.1',
        'fspiop-destination': 'dfsp2',
        'fspiop-source': 'dfsp1'
      }

      // Act
      const result = generateRequestHeadersForJWS(mockData.headers, config.protocolVersions, false)
      // Assert
      expect(result).toStrictEqual(expected)
    })
  })

  describe('fetchParticipantInfo', () => {
    beforeAll(() => {
      jest.mock('../../../src/lib/config')
    })

    beforeEach(() => {
      // restore the current method in test to its original implementation
      axios.request.mockRestore()
      jest.resetModules()
      Config = require('../../../src/lib/config')
    })

    afterAll(() => {
      Config = jest.requireActual('../../../src/lib/config')
    })

    it('returns payer and payee', async () => {
      // Arrange
      const payer = { data: { accounts: [{ accountId: 1, ledgerAccountType: 'POSITION', isActive: 1 }] } }
      const payee = { data: { accounts: [{ accountId: 2, ledgerAccountType: 'POSITION', isActive: 1 }] } }
      axios.request
        .mockImplementationOnce(() => { return payer })
        .mockImplementationOnce(() => { return payee })
      // Act
      const result = await fetchParticipantInfo(mockData.headers['fspiop-source'], mockData.headers['fspiop-destination'])
      // Assert
      expect(result).toEqual({ payer: payer.data, payee: payee.data })
      expect(axios.request.mock.calls.length).toBe(2)
      expect(axios.request.mock.calls[0][0]).toEqual({ url: 'http://localhost:3001/participants/' + mockData.headers['fspiop-source'] })
      expect(axios.request.mock.calls[1][0]).toEqual({ url: 'http://localhost:3001/participants/' + mockData.headers['fspiop-destination'] })
    })

    it('returns original payer and original payee data structure when they are proxied', async () => {
      // Arrange
      const cache = new Cache()
      const proxyId1 = 'proxy1'
      const proxyId2 = 'proxy2'
      // Act
      const result = await fetchParticipantInfo(
        mockData.headers['fspiop-source'],
        mockData.headers['fspiop-destination'],
        cache,
        {
          isConnected: false,
          connect: jest.fn().mockResolvedValue(true),
          lookupProxyByDfspId: jest.fn().mockResolvedValueOnce(proxyId1).mockResolvedValueOnce(proxyId2)
        }
      )
      // Assert
      expect(result).toEqual({
        payer: {
          name: mockData.headers['fspiop-source'],
          id: '',
          isActive: 1,
          links: { self: '' },
          accounts: [],
          proxiedParticipant: true
        },
        payee: {
          name: mockData.headers['fspiop-destination'],
          id: '',
          isActive: 1,
          links: { self: '' },
          accounts: [],
          proxiedParticipant: true
        }
      })
      expect(axios.request.mock.calls.length).toBe(0)
    })

    it('caches payer and payee when cache is provided', async () => {
      const cache = new Cache()
      // Arrange
      const payer = { data: { accounts: [{ accountId: 1, ledgerAccountType: 'POSITION', isActive: 1 }] } }
      const payee = { data: { accounts: [{ accountId: 2, ledgerAccountType: 'POSITION', isActive: 1 }] } }
      axios.request
        .mockImplementationOnce(() => { return payer })
        .mockImplementationOnce(() => { return payee })
      // Act
      const result = await fetchParticipantInfo(
        mockData.headers['fspiop-source'],
        mockData.headers['fspiop-destination'],
        cache
      )
      await fetchParticipantInfo(
        mockData.headers['fspiop-source'],
        mockData.headers['fspiop-destination'],
        cache
      )
      // Assert
      expect(result).toEqual({ payer: payer.data, payee: payee.data })
      expect(axios.request.mock.calls.length).toBe(2)
      expect(axios.request.mock.calls[0][0]).toEqual({ url: 'http://localhost:3001/participants/' + mockData.headers['fspiop-source'] })
      expect(axios.request.mock.calls[1][0]).toEqual({ url: 'http://localhost:3001/participants/' + mockData.headers['fspiop-destination'] })
      expect(axios.request.mock.calls[2]).toBeUndefined()
      cache.clear()
    })

    it('throws an unhandled exception if the first attempt of `axios.request` throws an exception', async () => {
      axios.request
        .mockImplementationOnce(() => { throw new Error('foo') })

      await expect(fetchParticipantInfo(mockData.headers['fspiop-source'], mockData.headers['fspiop-destination']))
        .rejects
        .toHaveProperty('message', 'foo')

      expect(axios.request.mock.calls.length).toBe(1)
      expect(axios.request.mock.calls[0][0]).toEqual({ url: 'http://localhost:3001/participants/' + mockData.headers['fspiop-source'] })
    })

    it('throws an unhandled exception if the second attempt of `axios.request` throws an exception', async () => {
      axios.request
        .mockImplementationOnce(() => { return { success: true } })
        .mockImplementationOnce(() => { throw new Error('foo') })

      await expect(fetchParticipantInfo(mockData.headers['fspiop-source'], mockData.headers['fspiop-destination']))
        .rejects
        .toHaveProperty('message', 'foo')

      expect(axios.request.mock.calls.length).toBe(2)
      expect(axios.request.mock.calls[0][0]).toEqual({ url: 'http://localhost:3001/participants/' + mockData.headers['fspiop-source'] })
      expect(axios.request.mock.calls[1][0]).toEqual({ url: 'http://localhost:3001/participants/' + mockData.headers['fspiop-destination'] })
    })

    it('self heals source proxy mapping if not found', async () => {
      // Arrange
      Config.mockImplementation(() => ({
        proxyMap: {
          [mockData.headers['fspiop-source']]: 'selfHealProxy1'
        }
      // eslint-disable-next-line
      }))
      // eslint-disable-next-line
      ({ fetchParticipantInfo } = require('../../../src/lib/util'))
      const cache = new Cache()
      const proxyClient = {
        isConnected: false,
        connect: jest.fn().mockResolvedValue(true),
        lookupProxyByDfspId: jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce('proxy2'),
        addDfspIdToProxyMapping: jest.fn().mockResolvedValue(true)
      }
      // Act
      const result = await fetchParticipantInfo(
        mockData.headers['fspiop-source'],
        mockData.headers['fspiop-destination'],
        cache,
        proxyClient
      )
      // Assert
      expect(result).toEqual({
        payer: {
          name: mockData.headers['fspiop-source'],
          id: '',
          isActive: 1,
          links: { self: '' },
          accounts: [],
          proxiedParticipant: true
        },
        payee: {
          name: mockData.headers['fspiop-destination'],
          id: '',
          isActive: 1,
          links: { self: '' },
          accounts: [],
          proxiedParticipant: true
        }
      })
      expect(proxyClient.addDfspIdToProxyMapping).toHaveBeenCalledWith(mockData.headers['fspiop-source'], 'selfHealProxy1')
      expect(axios.request.mock.calls.length).toBe(0)
    })

    it('self heals destination proxy mapping if not found', async () => {
      // Arrange
      Config.mockImplementation(() => ({
        proxyMap: {
          [mockData.headers['fspiop-destination']]: 'selfHealProxy2'
        }
      // eslint-disable-next-line
      }))
      // eslint-disable-next-line
      ({ fetchParticipantInfo } = require('../../../src/lib/util'))
      const cache = new Cache()
      const proxyClient = {
        isConnected: false,
        connect: jest.fn().mockResolvedValue(true),
        lookupProxyByDfspId: jest.fn().mockResolvedValueOnce('proxy1').mockResolvedValueOnce(null),
        addDfspIdToProxyMapping: jest.fn().mockResolvedValue(true)
      }
      // Act
      const result = await fetchParticipantInfo(
        mockData.headers['fspiop-source'],
        mockData.headers['fspiop-destination'],
        cache,
        proxyClient
      )
      // Assert
      expect(result).toEqual({
        payer: {
          name: mockData.headers['fspiop-source'],
          id: '',
          isActive: 1,
          links: { self: '' },
          accounts: [],
          proxiedParticipant: true
        },
        payee: {
          name: mockData.headers['fspiop-destination'],
          id: '',
          isActive: 1,
          links: { self: '' },
          accounts: [],
          proxiedParticipant: true
        }
      })
      expect(proxyClient.addDfspIdToProxyMapping).toHaveBeenCalledWith(mockData.headers['fspiop-destination'], 'selfHealProxy2')
      expect(axios.request.mock.calls.length).toBe(0)
    })
  })

  describe('getParticipantEndpoint', () => {
    it('throws an error if required arguments are missing', async () => {
      // Arrange
      const fspId = 'fsp1'
      const db = {
        getParticipantEndpoint: jest.fn()
      }
      const endpointType = 'TEST_ENDPOINT_TYPE'
      const proxyClient = {
        connect: jest.fn(),
        lookupProxyByDfspId: jest.fn()
      }
      const params = { db, endpointType, proxyClient }

      // Act
      const action = async () => getParticipantEndpoint(params)
      // Assert
      await expect(action()).rejects.toThrowError('Missing required arguments for \'getParticipantEndpoint\'')

      // Arrange
      params.fspId = fspId
      params.db = null
      // Act
      const action2 = async () => getParticipantEndpoint(params)
      // Assert
      await expect(action2()).rejects.toThrowError('Missing required arguments for \'getParticipantEndpoint\'')

      // Arrange
      params.endpointType = null
      // Act
      const action4 = async () => getParticipantEndpoint(params)
      // Assert
      await expect(action4()).rejects.toThrowError('Missing required arguments for \'getParticipantEndpoint\'')

      // Arrange
      params.db = db
      params.endpointType = endpointType
      params.proxyClient = null
      // Act
      const action5 = async () => getParticipantEndpoint(params)
      // Assert
      await expect(action5()).resolves.not.toThrow()
    })

    it('returns the participant endpoint by calling db.getParticipantEndpoint', async () => {
      // Arrange
      const expected = 'http://localhost:8444/payerfsp'
      const params = {
        fspId: 'fsp1',
        db: {
          getParticipantEndpoint: jest.fn().mockResolvedValue(expected)
        },
        endpointType: 'TEST_ENDPOINT_TYPE',
        proxyClient: {
          connect: jest.fn(),
          lookupProxyByDfspId: jest.fn()
        }
      }
      // Act
      const result = await getParticipantEndpoint(params)
      // Assert
      expect(result).toEqual(expected)
      expect(params.db.getParticipantEndpoint).toBeCalledTimes(1)
      expect(params.db.getParticipantEndpoint).toBeCalledWith(params.fspId, params.endpointType)
      expect(params.proxyClient.connect).toBeCalledTimes(0)
      expect(params.proxyClient.lookupProxyByDfspId).toBeCalledTimes(0)
    })

    it('returns the participant endpoint using proxy client if participant not found in db', async () => {
      // Arrange
      const expected = 'http://localhost:8444/payerfsp'
      const proxyId = 'proxy1'
      const params = {
        fspId: 'fsp1',
        db: {
          getParticipantEndpoint: jest.fn().mockImplementation((fspId, endpointType) => {
            if (fspId === proxyId && endpointType === 'TEST_ENDPOINT_TYPE') {
              return Promise.resolve(expected)
            }
            return Promise.resolve(null)
          })
        },
        endpointType: 'TEST_ENDPOINT_TYPE',
        proxyClient: {
          isConnecected: false,
          connect: jest.fn().mockResolvedValue(true),
          lookupProxyByDfspId: jest.fn().mockResolvedValue(proxyId)
        }
      }
      // Act
      const result = await getParticipantEndpoint(params)
      // Assert
      expect(result).toEqual(expected)
      expect(params.db.getParticipantEndpoint).toBeCalledTimes(2)
      expect(params.db.getParticipantEndpoint).toBeCalledWith(proxyId, params.endpointType)
      expect(params.proxyClient.connect).toBeCalledTimes(1)
      expect(params.proxyClient.lookupProxyByDfspId).toBeCalledTimes(1)
    })
  })

  describe('resolveOpenApiSpecPath Tests -->', () => {
    it('should resolve ISO OpenAPI spec path, and be able to read it', async () => {
      const isIsoApi = true
      const path = resolveOpenApiSpecPath(isIsoApi)
      await expect(fs.access(path, fs.constants.R_OK)).resolves.toBeUndefined()
    })

    it('should resolve FSPIOP OpenAPI spec path, and be able to read it', async () => {
      const isIsoApi = false
      const path = resolveOpenApiSpecPath(isIsoApi)
      await expect(fs.access(path, fs.constants.R_OK)).resolves.toBeUndefined()
    })
  })

  describe('makeAppInteroperabilityHeader', () => {
    it('should make ISO20022 header', () => {
      const isIsoApi = true
      const header = makeAppInteroperabilityHeader(RESOURCES.quotes, config.protocolVersions.ACCEPT.DEFAULT, isIsoApi)
      expect(header).toContain(ISO_HEADER_PART)
    })
  })
})
