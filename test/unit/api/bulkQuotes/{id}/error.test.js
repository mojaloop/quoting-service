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

 Initial contribution
 --------------------
 The initial functionality and code base was donated by the Mowali project working in conjunction with MTN and Orange as service provides.
 * Project: Mowali

 * Crosslake
 - Lewis Daly <lewisd@crosslaketech.com>
 --------------
 ******/
let mockConfig

jest.mock('../../../../../src/lib/config', () => {
  return jest.fn().mockImplementation(() => mockConfig)
})

const { randomUUID } = require('node:crypto')
const { Http, Events } = require('@mojaloop/central-services-shared').Enum
const { Producer } = require('@mojaloop/central-services-stream').Util
const Metrics = require('@mojaloop/central-services-metrics')

const { logger } = require('../../../../../src/lib')
const bulkQuotesApi = require('../../../../../src/api/bulkQuotes/{id}/error')
const mocks = require('../../../../mocks')

const Config = jest.requireActual('../../../../../src/lib/config')

const { kafkaConfig } = new Config()
const { topic, config } = kafkaConfig.PRODUCER.BULK_QUOTE.PUT
const fileConfig = new Config()

describe('PUT /bulkQuotes/{id}/error API Tests -->', () => {
  Metrics.setup(fileConfig.instrumentationMetricsConfig)
  const mockContext = jest.fn()

  beforeEach(() => {
    mockConfig = new Config()
  })

  it('should publish a message with bulkQuotes callback error payload', async () => {
    // Arrange
    Producer.produceMessage = jest.fn()
    const bulkQuoteId = randomUUID()
    const mockRequest = mocks.mockHttpRequest({
      payload: { errorInformation: {} },
      params: { id: bulkQuoteId }
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

  it('should rethrow error in case of error during publish bulkQuotes message', async () => {
    // Arrange
    const error = new Error('PUT BulkQuote Test Error')
    Producer.produceMessage = jest.fn(async () => { throw error })

    const mockRequest = mocks.mockHttpRequest()
    const { handler } = mocks.createMockHapiHandler()
    const spyErrorLog = jest.spyOn(logger, 'error')

    // Act
    await expect(() => bulkQuotesApi.put(mockContext, mockRequest, handler))
      .rejects.toThrowError(error.message)

    // Assert
    expect(spyErrorLog).toHaveBeenCalledTimes(1)
    expect(spyErrorLog.mock.calls[0][1].message).toContain(error.message)
  })

  it('should rethrow error when metrics is disabled', async () => {
    // Arrange
    mockConfig.instrumentationMetricsDisabled = true

    const error = new Error('Put BulkQuote Test Error')
    Producer.produceMessage = jest.fn(async () => { throw error })

    const mockRequest = mocks.mockHttpRequest()
    const { handler } = mocks.createMockHapiHandler()

    // Act
    await expect(() => bulkQuotesApi.put(mockContext, mockRequest, handler))
      .rejects.toThrowError(error.message)
  })
})
