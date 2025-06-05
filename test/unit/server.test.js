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

const mockProducer = {
  connectAll: jest.fn(),
  disconnect: jest.fn()
}

jest.mock('@mojaloop/central-services-stream', () => ({
  Util: { Producer: mockProducer }
}))
jest.mock('@mojaloop/central-services-shared', () => ({
  HealthCheck: {
    HealthCheck: class {},
    HealthCheckEnums: {
      responseCode: {},
      serviceName: {},
      statusEnum: {}
    }
  },
  Util: {
    OpenapiBackend: {
      initialise: jest.fn().mockResolvedValue(),
      validationFail: jest.fn().mockResolvedValue(),
      notFound: jest.fn().mockResolvedValue(),
      methodNotAllowed: jest.fn().mockResolvedValue()
    },
    rethrow: {
      with: jest.fn(() => ({
        rethrowAndCountFspiopError: jest.fn(),
        rethrowDatabaseError: jest.fn(),
        rethrowCachedDatabaseError: jest.fn()
      }))
    },
    HeaderValidation: {
      getHubNameRegex: jest.fn(() => ({
        test: jest.fn(() => true)
      }))
    },
    Hapi: {
      API_TYPES: { fspiop: 'fspiop', iso20022: 'iso20022' }
    },
    StreamingProtocol: {
      decodePayload: jest.fn(),
      encodePayload: jest.fn(),
      decodeMessages: jest.fn(),
      isDataUri: jest.fn(),
      createMessage: jest.fn(),
      createMessageFromRequest: jest.fn(),
      updateMessageProtocolMetadata: jest.fn(),
      createMetadata: jest.fn(),
      createMetadataWithCorrelatedEvent: jest.fn(),
      createMetadataWithCorrelatedEventState: jest.fn(),
      createEventMetadata: jest.fn(),
      createEventState: jest.fn(),
      parseDataURI: jest.fn()
    }
  },
  Enum: {
    Http: {
      Headers: {
        FSPIOP: {
          SOURCE: 'fspiop-source',
          DESTINATION: 'fspiop-destination'
        },
        GENERAL: {
          ACCEPT: {
            regex: /.*/
          },
          CONTENT_TYPE: {
            regex: /.*/
          }
        }
      }
    }
  }
}))

jest.mock('@mojaloop/central-services-metrics', () => ({
  plugin: { register: jest.fn() },
  setup: jest.fn()
}))

jest.mock('../../src/lib', () => ({
  ...jest.requireActual('../../src/lib'),
  initPayloadCache: jest.fn().mockResolvedValue({}),
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    verbose: jest.fn()
  }
}))

jest.setTimeout(20_000)

describe('Server Tests', () => {
  let Hapi

  beforeEach(() => {
    jest.resetModules()
    jest.mock('@hapi/hapi')
    Hapi = require('@hapi/hapi')
  })

  it('runs the server', async () => {
    // Arrange
    const mockRegister = jest.fn()
    const mockStart = jest.fn()
    const mockRoute = jest.fn()
    const mockLog = jest.fn()
    Hapi.Server.mockImplementationOnce(() => ({
      app: {},
      register: mockRegister,
      start: mockStart,
      route: mockRoute,
      log: mockLog,
      info: {
        host: 'localhost',
        port: 3333,
        uri: 'http://localhost:3333'
      }
    }))

    // Act
    const server = require('../../src/server')
    await server()

    // Assert
    expect(mockRegister).toHaveBeenCalledTimes(4)
    expect(mockStart).toHaveBeenCalledTimes(1)
    expect(mockRoute).toHaveBeenCalledTimes(1)
    expect(mockLog).toHaveBeenCalledTimes(1)
    expect(mockProducer.connectAll).toHaveBeenCalledTimes(1)
  })

  it('handles exception when starting', async () => {
    // Arrange
    const mockRegister = jest.fn().mockImplementationOnce(() => { throw new Error('Test Error') })
    const mockStart = jest.fn()
    const mockRoute = jest.fn()
    const mockLog = jest.fn()
    Hapi.Server.mockImplementationOnce(() => ({
      app: {},
      register: mockRegister,
      route: mockRoute,
      start: mockStart,
      log: mockLog,
      info: {
        host: 'localhost',
        port: 3333,
        uri: 'http://localhost:3333'
      }
    }))

    const { logger } = require('../../src/lib')
    const spyErrorLog = jest.spyOn(logger, 'error')

    // Act
    const server = require('../../src/server')
    await server()

    // Assert
    expect(mockRegister).toHaveBeenCalledTimes(1)
    expect(mockStart).not.toHaveBeenCalled()
    expect(mockRoute).not.toHaveBeenCalled()
    expect(mockLog).not.toHaveBeenCalled()
    expect(spyErrorLog).toHaveBeenCalledTimes(1)
  })
})
