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

const Enum = require('@mojaloop/central-services-shared').Enum

jest.mock('@mojaloop/central-services-logger')
jest.mock('../../../../../src/model/quotes')

const QuotesErrorHandler = require('../../../../../src/handlers/quotes/{id}/error')
const QuotesModel = require('../../../../../src/model/quotes')
const { baseMockRequest } = require('../../../../util/helper')
const Logger = require('@mojaloop/central-services-logger')

Logger.isDebugEnabled = jest.fn(() => true)
Logger.isErrorEnabled = jest.fn(() => true)
Logger.isInfoEnabled = jest.fn(() => true)
const mockContext = jest.fn()

describe('/quotes/{id}', () => {
  beforeEach(() => {
    QuotesModel.mockClear()
  })

  describe('PUT', () => {
    it('handles an error', async () => {
      // Arrange
      const request = {
        ...baseMockRequest,
        payload: {
          errorInformation: {
            errorCode: '2201',
            errorDescription: 'Test Error'
          }
        }
      }
      const code = jest.fn()
      const handler = {
        response: jest.fn(() => ({
          code
        }))
      }

      // Act
      await QuotesErrorHandler.put(mockContext, request, handler)

      // Assert
      expect(QuotesModel).toHaveBeenCalledTimes(1)
      const mockQuoteInstance = QuotesModel.mock.instances[0]
      expect(mockQuoteInstance.handleQuoteError).toHaveBeenCalledTimes(1)
      expect(code).toHaveBeenCalledWith(Enum.Http.ReturnCodes.OK.CODE)
    })

    it('handles an error with the model', async () => {
      // Arrange
      const throwError = new Error('Create Quote Test Error')
      const request = {
        ...baseMockRequest,
        payload: {
          errorInformation: {
            errorCode: '2201',
            errorDescription: 'Test Error'
          }
        }
      }
      const handleException = jest.fn(() => ({ code: Enum.Http.ReturnCodes.OK.CODE }))
      QuotesModel.mockImplementationOnce(() => {
        return {
          handleQuoteError: jest.fn(async () => {
            throw throwError
          }),
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
      await QuotesErrorHandler.put(mockContext, request, handler)

      // Assert
      expect(QuotesModel).toHaveBeenCalledTimes(1)
      expect(QuotesModel.mock.results[0].value.handleQuoteError.mock.results[0].value).rejects.toThrow(throwError)
      expect(code).toHaveBeenCalledWith(Enum.Http.ReturnCodes.OK.CODE)
    })
  })
})
