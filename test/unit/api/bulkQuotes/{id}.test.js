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

const { randomUUID } = require('node:crypto')
const { Http, Events } = require('@mojaloop/central-services-shared').Enum
const { Producer } = require('@mojaloop/central-services-stream').Util

const bulkQuotesApi = require('../../../../src/api/bulkQuotes/{id}')
const Config = require('../../../../src/lib/config')
const { logger } = require('../../../../src/lib/logger')

const mocks = require('../../mocks')

const { kafkaConfig } = new Config()

describe('/bulkQuotes/{id} API Tests -->', () => {
  const mockContext = jest.fn()

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('GET /bulkQuotes/{id} Endpoint Tests', () => {
    const { topic, config } = kafkaConfig.PRODUCER.BULK_QUOTE.GET

    it('should publish a message to get a bulkQuote by id', async () => {
      // Arrange
      Producer.produceMessage = jest.fn()
      const bulkQuoteId = randomUUID()
      const mockRequest = mocks.mockHttpRequest({
        params: { id: bulkQuoteId }
      })
      const { handler, code } = mocks.createMockHapiHandler()

      // Act
      await bulkQuotesApi.get(mockContext, mockRequest, handler)

      // Assert
      expect(code).toHaveBeenCalledWith(Http.ReturnCodes.ACCEPTED.CODE)
      expect(Producer.produceMessage).toHaveBeenCalledTimes(1)

      const [message, topicConfig, producerConfig] = Producer.produceMessage.mock.calls[0]
      const { id, type, action } = message.content
      expect(id).toBe(bulkQuoteId)
      expect(type).toBe(Events.Event.Type.BULK_QUOTE)
      expect(action).toBe(Events.Event.Action.GET)
      expect(topicConfig.topicName).toBe(topic)
      expect(producerConfig).toStrictEqual(config)
    })

    it('should rethrow error in case of error during publish a message, and log it', async () => {
      // Arrange
      const error = new Error('Get BulkQuote Test Error')
      Producer.produceMessage = jest.fn(async () => { throw error })

      const mockRequest = mocks.mockHttpRequest()
      const { handler } = mocks.createMockHapiHandler()
      const spyErrorLog = jest.spyOn(logger, 'error')

      // Act
      await expect(() => bulkQuotesApi.get(mockContext, mockRequest, handler))
        .rejects.toThrowError(error.message)

      // Assert
      expect(spyErrorLog).toHaveBeenCalledTimes(1)
      expect(spyErrorLog.mock.calls[0][0].message).toContain(error.message)
    })
  })

  describe('PUT /bulkQuotes/{id} Endpoint Tests', () => {
    const { topic, config } = kafkaConfig.PRODUCER.BULK_QUOTE.PUT

    it('should publish a message with PUT bulkQuotes callback payload', async () => {
      // Arrange
      Producer.produceMessage = jest.fn()
      const bulkQuoteId = randomUUID()
      const mockRequest = mocks.mockHttpRequest({
        payload: { bulkQuoteId }
      })
      const { handler, code } = mocks.createMockHapiHandler()

      // Act
      await bulkQuotesApi.put(mockContext, mockRequest, handler)

      // Assert
      expect(code).toHaveBeenCalledWith(Http.ReturnCodes.OK.CODE)
      expect(Producer.produceMessage).toHaveBeenCalledTimes(1)

      const [message, topicConfig, producerConfig] = Producer.produceMessage.mock.calls[0]
      const { id, type, action } = message.content
      expect(id).toBe(bulkQuoteId)
      expect(type).toBe(Events.Event.Type.BULK_QUOTE)
      expect(action).toBe(Events.Event.Action.PUT)
      expect(topicConfig.topicName).toBe(topic)
      expect(producerConfig).toStrictEqual(config)
    })

    it('should rethrow error in case of error during publish callback message', async () => {
      // Arrange
      const error = new Error('Put BulkQuote Test Error')
      Producer.produceMessage = jest.fn(async () => { throw error })

      const mockRequest = mocks.mockHttpRequest()
      const { handler } = mocks.createMockHapiHandler()
      const spyErrorLog = jest.spyOn(logger, 'error')

      // Act
      await expect(() => bulkQuotesApi.put(mockContext, mockRequest, handler))
        .rejects.toThrowError(error.message)

      // Assert
      expect(spyErrorLog).toHaveBeenCalledTimes(1)
      expect(spyErrorLog.mock.calls[0][0].message).toContain(error.message)
    })
  })
})
