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

jest.mock('@mojaloop/central-services-logger')
jest.mock('../../../../src/model/quotes')

const QuotesHandler = require('../../../../src/handlers/quotes/{id}')
const QuotesModel = require('../../../../src/model/quotes')
const { baseMockRequest } = require('../../../util/helper')

describe('/quotes/{id}', () => {
  beforeEach(() => {
    QuotesModel.mockClear()
  })

  describe('GET', () => {
    it('gets a quote by id', async () => {
      // Arrange
      const code = jest.fn()
      const handler = {
        response: jest.fn(() => ({
          code
        }))
      }

      // Act
      await QuotesHandler.get({ ...baseMockRequest }, handler)

      // Assert
      expect(QuotesModel).toHaveBeenCalledTimes(1)
      const mockQuoteInstance = QuotesModel.mock.instances[0]
      expect(mockQuoteInstance.handleQuoteGet).toHaveBeenCalledTimes(1)
      expect(code).toHaveBeenCalledWith(202)
    })

    it('handles an error with the model', async () => {
      // Arrange
      const handleException = jest.fn(() => ({ code: 202 }))
      QuotesModel.mockImplementationOnce(() => {
        return {
          handleQuoteGet: () => {
            throw new Error('Test error')
          },
          handleException
        }
      })
      const code = jest.fn()
      const handler = {
        response: jest.fn(() => ({
          code
        }))
      }

      // Act
      await QuotesHandler.get({ ...baseMockRequest }, handler)

      // Assert
      expect(QuotesModel).toHaveBeenCalledTimes(1)
      expect(handleException).toHaveBeenCalledTimes(1)
      expect(code).toHaveBeenCalledWith(202)
    })
  })

  describe('PUT', () => {
    it('puts a quote by id', async () => {
      QuotesModel.mockClear()

      // Arrange
      const code = jest.fn()
      const handler = {
        response: jest.fn(() => ({
          code
        }))
      }

      // Act
      await QuotesHandler.put({ ...baseMockRequest }, handler)

      // Assert
      expect(QuotesModel).toHaveBeenCalledTimes(1)
      const mockQuoteInstance = QuotesModel.mock.instances[0]
      expect(mockQuoteInstance.handleQuoteUpdate).toHaveBeenCalledTimes(1)
      expect(code).toHaveBeenCalledWith(202)
    })

    it('handles an error with the model', async () => {
      // Arrange
      const handleException = jest.fn(() => ({ code: 202 }))
      QuotesModel.mockImplementationOnce(() => {
        return {
          handleQuoteUpdate: () => {
            throw new Error('Test error')
          },
          handleException
        }
      })
      const code = jest.fn()
      const handler = {
        response: jest.fn(() => ({
          code
        }))
      }

      // Act
      await QuotesHandler.put({ ...baseMockRequest }, handler)

      // Assert
      expect(QuotesModel).toHaveBeenCalledTimes(1)
      expect(handleException).toHaveBeenCalledTimes(1)
      expect(code).toHaveBeenCalledWith(202)
    })
  })
})
