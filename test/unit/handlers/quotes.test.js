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

jest.mock('../../../src/model/quotes')
jest.mock('@mojaloop/central-services-logger')

const Enum = require('@mojaloop/central-services-shared').Enum

const QuotesModel = require('../../../src/model/quotes')
const QuotesHandler = require('../../../src/handlers/quotes')
const { baseMockRequest } = require('../../util/helper')
const Logger = require('@mojaloop/central-services-logger')

Logger.isDebugEnabled = jest.fn(() => true)
Logger.isErrorEnabled = jest.fn(() => true)
Logger.isInfoEnabled = jest.fn(() => true)
const mockContext = jest.fn()

describe('/quotes', () => {
  describe('POST', () => {
    beforeEach(() => {
      QuotesModel.mockClear()
    })

    it('creates a quote', async () => {
      // Arrange
      const code = jest.fn()
      const handler = {
        response: jest.fn(() => ({
          code
        }))
      }
      const mockRequest = {
        ...baseMockRequest,
        payload: {
          quoteId: '12345'
        },
        span: {
          audit: jest.fn(),
          setTags: jest.fn()
        }
      }

      // Act
      await QuotesHandler.post(mockContext, mockRequest, handler)

      // Assert
      expect(code).toHaveBeenCalledWith(Enum.Http.ReturnCodes.ACCEPTED.CODE)
      const mockQuoteInstance = QuotesModel.mock.instances[0]
      expect(mockQuoteInstance.handleQuoteRequest).toHaveBeenCalledTimes(1)
    })

    it('fails to create a quote', async () => {
      // Arrange
      const throwError = new Error('Create Quote Test Error')
      const handleException = jest.fn(() => ({ code: Enum.Http.ReturnCodes.ACCEPTED.CODE }))
      QuotesModel.mockImplementationOnce(() => ({
        handleQuoteRequest: jest.fn(async () => {
          throw throwError
        }),
        handleException
      }))
      const code = jest.fn()
      const handler = {
        response: jest.fn(() => ({
          code
        }))
      }
      const mockRequest = {
        ...baseMockRequest,
        payload: {
          quoteId: '12345'
        },
        span: {
          audit: jest.fn(),
          setTags: jest.fn()
        }
      }

      // Act
      await QuotesHandler.post(mockContext, mockRequest, handler)

      // Assert
      expect(QuotesModel).toHaveBeenCalledTimes(1)
      expect(QuotesModel.mock.results[0].value.handleQuoteRequest.mock.results[0].value).rejects.toThrow(throwError)
      expect(code).toHaveBeenCalledWith(Enum.Http.ReturnCodes.ACCEPTED.CODE)
    })
  })
})
