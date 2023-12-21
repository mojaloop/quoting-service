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

 * Crosslake
 - Lewis Daly <lewisd@crosslaketech.com>
 --------------
 ******/
jest.mock('../../../src/lib/config')
jest.mock('@mojaloop/central-services-logger')

const { responseCode, statusEnum } = require('@mojaloop/central-services-shared').HealthCheck.HealthCheckEnums
const { Producer } = require('@mojaloop/central-services-stream').Util
const HealthHandler = require('../../../src/api/health')
const { baseMockRequest } = require('../../util/helper')

let Config = require('../../../src/lib/config')
let HealthCheck = require('@mojaloop/central-services-shared/src/healthCheck')

const mockContext = jest.fn()

describe('/health', () => {
  describe('getSubServiceHealthDatastore', () => {
    beforeAll(() => {
      jest.mock('@mojaloop/central-services-shared/src/healthCheck')
    })

    it('is down when the database throws an error', async () => {
      // Arrange
      const mockDb = {
        getIsMigrationLocked: jest.fn(() => { throw new Error('Test Error') })
      }

      // Act
      const result = await HealthHandler.getSubServiceHealthDatastore(mockDb)

      // Assert
      expect(result.status).toEqual(statusEnum.DOWN)
    })

    it('is down when the database is locked', async () => {
      // Arrange
      const mockDb = {
        getIsMigrationLocked: jest.fn(() => true)
      }

      // Act
      const result = await HealthHandler.getSubServiceHealthDatastore(mockDb)

      // Assert
      expect(result.status).toEqual(statusEnum.DOWN)
    })

    it('is up when the database is not locked', async () => {
      // Arrange
      const mockDb = {
        getIsMigrationLocked: jest.fn(() => false)
      }

      // Act
      const result = await HealthHandler.getSubServiceHealthDatastore(mockDb)

      // Assert
      expect(result.status).toEqual(statusEnum.OK)
    })
  })

  describe('GET success', () => {
    let code
    let handler

    beforeEach(() => {
      // We need to reimport the modules here, since `new Config()` is called at import time
      jest.resetModules()
      jest.mock('@mojaloop/central-services-shared/src/healthCheck')
      Config = require('../../../src/lib/config')
      HealthCheck = require('@mojaloop/central-services-shared/src/healthCheck').HealthCheck

      handler = {
        response: jest.fn(() => ({
          code
        }))
      }
      HealthCheck.mockImplementationOnce(() => ({
        getHealth: () => ({
          status: statusEnum.OK
        })
      }))
    })

    it('returns an UP response when simpleRoutingMode is on', async () => {
      // Arrange
      code = jest.fn()
      Config.mockImplementation(() => ({
        simpleRoutingMode: true
      }))
      const HealthHandlerProxy = require('../../../src/api/health')
      const expectedServiceHealthList = []

      // Act
      await HealthHandlerProxy.get(mockContext, { ...baseMockRequest }, handler)

      // Assert
      expect(code).toHaveBeenCalledWith(responseCode.success)
      expect(HealthCheck.mock.calls.pop()[1]).toEqual(expectedServiceHealthList)
    })

    it('returns an UP response when simpleRoutingMode is off', async () => {
      // Arrange
      code = jest.fn()
      Config.mockImplementation(() => ({
        simpleRoutingMode: false
      }))
      const HealthHandlerProxy = require('../../../src/api/health')

      // Act
      await HealthHandlerProxy.get(mockContext, { ...baseMockRequest }, handler)

      // Assert
      expect(code).toHaveBeenCalledWith(responseCode.success)
      // Ensure there was one item in the `serviceHealthList`
      expect(HealthCheck.mock.calls.pop()[1].length).toEqual(1)
    })
  })

  describe('GET failure', () => {
    let code
    let handler
    let HealthHandlerProxy

    beforeEach(() => {
      // We need to reimport the modules here, since `new Config()` is called at import time
      jest.resetModules()
      Config = require('../../../src/lib/config')
      Config.mockImplementation(() => ({
        simpleRoutingMode: false
      }))

      handler = {
        response: jest.fn(() => ({
          code
        }))
      }
    })

    it('returns an down response when getHealth returns DOWN', async () => {
      // Arrange
      HealthCheck = require('@mojaloop/central-services-shared/src/healthCheck').HealthCheck
      HealthHandlerProxy = require('../../../src/api/health')

      code = jest.fn()
      const mockRequest = {
        ...baseMockRequest
      }
      mockRequest.server.app.database.getIsMigrationLocked = jest.fn().mockImplementation(() => {
        throw new Error('Test Error')
      })

      // Act
      await HealthHandlerProxy.get(mockContext, mockRequest, handler)

      // Assert
      expect(code).toHaveBeenCalledWith(responseCode.gatewayTimeout)
    })

    it('returns an down response when getHealth returns undefined', async () => {
      // Arrange
      jest.mock('@mojaloop/central-services-shared/src/healthCheck')
      HealthCheck = require('@mojaloop/central-services-shared/src/healthCheck').HealthCheck
      HealthHandlerProxy = require('../../../src/api/health')

      code = jest.fn()
      HealthCheck.mockImplementationOnce(() => ({
        getHealth: () => undefined
      }))

      // Act
      await HealthHandlerProxy.get(mockContext, { ...baseMockRequest }, handler)

      // Assert
      expect(code).toHaveBeenCalledWith(responseCode.gatewayTimeout)
    })
  })

  describe('checkKafkaProducers Tests', () => {
    it('should return OK status if all producers are connected', async () => {
      Producer.getProducer = jest.fn(() => ({
        isConnected: () => true
      }))
      const topicNames = ['topic1', 'topic2']
      const result = await HealthHandler.checkKafkaProducers(topicNames)
      expect(result.status).toEqual(statusEnum.OK)
    })

    it('should return DOWN status if NOT all producers are connected', async () => {
      Producer.getProducer = jest.fn(() => ({
        isConnected: () => false
      }))
      const result = await HealthHandler.checkKafkaProducers(['topic1'])
      expect(result.status).toEqual(statusEnum.DOWN)
    })

    it('should return DOWN status if getProducer throws na error', async () => {
      Producer.getProducer = jest.fn(() => { throw new Error('Test Error') })
      const result = await HealthHandler.checkKafkaProducers(['topic1'])
      expect(result.status).toEqual(statusEnum.DOWN)
    })
  })
})
