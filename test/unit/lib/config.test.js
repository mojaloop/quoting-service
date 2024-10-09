/*****
 License
 --------------
 Copyright © 2017 Bill & Melinda Gates Foundation
 The Mojaloop files are made available by the Bill & Melinda Gates Foundation under the Apache License, Version 2.0 (the "License") and you may not use these files except in compliance with the License. You may obtain a copy of the License at
 http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, the Mojaloop files are distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
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

 * Crosslake
 - Lewis Daly <lewisd@crosslaketech.com>

 --------------
 ******/
'use strict'

const mockDefaultFile = {
  HUB_PARTICIPANT: {
    ID: 1,
    NAME: 'Hub'
  },
  HOSTNAME: 'http://quoting-service',
  LISTEN_ADDRESS: '0.0.0.0',
  PORT: 3002,
  API_TYPE: 'fspiop',
  AMOUNT: {
    PRECISION: 18,
    SCALE: 4
  },
  PROTOCOL_VERSIONS: {
    CONTENT: {
      DEFAULT: '1.1',
      VALIDATELIST: [
        '1',
        '1.1'
      ]
    },
    ACCEPT: {
      DEFAULT: '1',
      VALIDATELIST: [
        '1',
        '1.1'
      ]
    }
  },
  DATABASE: {
    DIALECT: 'mysql',
    HOST: 'localhost',
    PORT: 3306,
    USER: 'central_ledger',
    PASSWORD: 'password',
    SCHEMA: 'central_ledger',
    POOL_MIN_SIZE: 10,
    POOL_MAX_SIZE: 10,
    ACQUIRE_TIMEOUT_MILLIS: 30000,
    CREATE_TIMEOUT_MILLIS: 30000,
    DESTROY_TIMEOUT_MILLIS: 5000,
    IDLE_TIMEOUT_MILLIS: 30000,
    REAP_INTERVAL_MILLIS: 1000,
    CREATE_RETRY_INTERVAL_MILLIS: 200,
    DEBUG: true
  },
  SWITCH_ENDPOINT: 'http://localhost:3001',
  ERROR_HANDLING: {
    includeCauseExtension: false,
    truncateExtensions: true
  },
  SIMPLE_ROUTING_MODE: true,
  ENDPOINT_SECURITY: {
    JWS: {
      JWS_SIGN: true,
      JWS_SIGNING_KEY_PATH: 'secrets/jwsSigningKey.key'
    }
  },
  INSTRUMENTATION: {
    METRICS: {
      DISABLED: false,
      labels: {
        fspId: '*'
      },
      config: {
        timeout: 5000,
        prefix: 'moja_qs_',
        defaultLabels: {
          serviceName: 'quoting-service'
        }
      }
    }
  },
  CACHE: {
    CACHE_ENABLED: true,
    EXPIRES_IN_MS: 1000
  }
}

describe('Config', () => {
  beforeEach(() => {
    jest.resetModules()
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('sets the default amounts', () => {
    // Arrange
    jest.mock('../../../config/default.json', () => ({
      ...mockDefaultFile,
      AMOUNT: {}
    }), { virtual: true })

    const Config = require('../../../src/lib/config')

    // Act
    const result = new Config()

    // Assert
    expect(result.amount.precision).toBe(18)
    expect(result.amount.scale).toBe(4)
    expect(result.database.debug).toBe(true)
  })

  it('throws when JWS Signing key file is not provided', () => {
    // Arrange
    jest.mock('../../../config/default.json', () => ({
      ...mockDefaultFile,
      ENDPOINT_SECURITY: {
        JWS: {
          JWS_SIGN: true,
          FSPIOP_SOURCE_TO_SIGN: 'Hub',
          JWS_SIGNING_KEY_PATH: '/fake/path'
        }
      }
    }), { virtual: true })

    const Config = require('../../../src/lib/config')

    // Act
    try {
      const result = new Config()
      expect(result).toBeUndefined()
    } catch (error) {
      expect(error).toBeInstanceOf(Error)
      expect(error).toHaveProperty('message', 'File /fake/path doesn\'t exist, can\'t enable JWS signing')
    }
  })

  it('should parse ENV var QUOTE_PROTOCOL_VERSIONS__ACCEPT__VALIDATELIST as a string', async () => {
    // Arrange
    jest.mock('../../../config/default.json', () => ({
      ...mockDefaultFile
    }), { virtual: true })

    // Setup
    let result = null
    let isSuccess
    const validateList = ['1']
    // set env var
    process.env.QUOTE_PROTOCOL_VERSIONS__CONTENT__VALIDATELIST = JSON.stringify(validateList)
    process.env.QUOTE_PROTOCOL_VERSIONS__ACCEPT__VALIDATELIST = JSON.stringify(validateList)

    // Act
    try {
      const Config = require('../../../src/lib/config')
      result = new Config()
      isSuccess = true
    } catch (e) {
      isSuccess = false
    }

    // Assert
    expect(result != null).toBe(true)
    expect(isSuccess).toBe(true)
    expect(result.protocolVersions.CONTENT.VALIDATELIST).toMatchObject(validateList)
    expect(result.protocolVersions.ACCEPT.VALIDATELIST).toMatchObject(validateList)
  })
})
