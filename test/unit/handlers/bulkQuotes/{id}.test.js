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

 * Modusbox
 - Rajiv Mothilal <rajiv.mothilal@modusbox.com>
 --------------
 ******/

jest.mock('@mojaloop/central-services-logger')
jest.mock('../../../../src/model/bulkQuotes')

const Enum = require('@mojaloop/central-services-shared').Enum
const BulkQuotesHandler = require('../../../../src/handlers/bulkQuotes/{id}')
const BulkQuotesModel = require('../../../../src/model/bulkQuotes')
const { baseMockRequest } = require('../../../util/helper')

const mockContext = jest.fn()

describe('/bulkQuotes/{id}', () => {
  beforeEach(() => {
    BulkQuotesModel.mockClear()
  })

  describe('GET', () => {
    it('gets a bulk quote by id', async () => {
      // Arrange
      const code = jest.fn()
      const handler = {
        response: jest.fn(() => ({
          code
        }))
      }

      // Act
      await BulkQuotesHandler.get(mockContext, { ...baseMockRequest }, handler)

      // Assert
      expect(BulkQuotesModel).toHaveBeenCalledTimes(1)
      const mockQuoteInstance = BulkQuotesModel.mock.instances[0]
      expect(mockQuoteInstance.handleBulkQuoteGet).toHaveBeenCalledTimes(1)
      expect(code).toHaveBeenCalledWith(Enum.Http.ReturnCodes.ACCEPTED.CODE)
    })

    it('handles an error with the model', async () => {
      // Arrange
      const handleException = jest.fn()
      BulkQuotesModel.mockImplementationOnce(() => {
        return {
          handleBulkQuoteGet: () => {
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
      await BulkQuotesHandler.get(mockContext, { ...baseMockRequest }, handler)

      // Assert
      expect(BulkQuotesModel).toHaveBeenCalledTimes(1)
      expect(handleException).toHaveBeenCalledTimes(1)
      expect(code).toHaveBeenCalledWith(Enum.Http.ReturnCodes.ACCEPTED.CODE)
    })
  })

  describe('PUT', () => {
    it('puts a bulk quote by id', async () => {
      BulkQuotesModel.mockClear()

      // Arrange
      const code = jest.fn()
      const handler = {
        response: jest.fn(() => ({
          code
        }))
      }

      // Act
      await BulkQuotesHandler.put(mockContext, { ...baseMockRequest }, handler)

      // Assert
      expect(BulkQuotesModel).toHaveBeenCalledTimes(1)
      const mockQuoteInstance = BulkQuotesModel.mock.instances[0]
      expect(mockQuoteInstance.handleBulkQuoteUpdate).toHaveBeenCalledTimes(1)
      expect(code).toHaveBeenCalledWith(Enum.Http.ReturnCodes.OK.CODE)
    })

    it('handles an error with the model', async () => {
      // Arrange
      const handleException = jest.fn()
      BulkQuotesModel.mockImplementationOnce(() => {
        return {
          handleBulkQuoteUpdate: () => {
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
      await BulkQuotesHandler.put(mockContext, { ...baseMockRequest }, handler)

      // Assert
      expect(BulkQuotesModel).toHaveBeenCalledTimes(1)
      expect(handleException).toHaveBeenCalledTimes(1)
      expect(code).toHaveBeenCalledWith(Enum.Http.ReturnCodes.OK.CODE)
    })
  })
})
