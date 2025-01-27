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

 * Modusbox
 - Rajiv Mothilal <rajiv.mothilal@modusbox.com>
 --------------
 ******/

jest.mock('../../../src/lib/config')

const { randomUUID } = require('node:crypto')
const { Http, Events } = require('@mojaloop/central-services-shared').Enum
const { Producer } = require('@mojaloop/central-services-stream').Util
const Metrics = require('@mojaloop/central-services-metrics')

const { logger } = require('../../../src/lib')
const bulkQuotesApi = require('../../../src/api/bulkQuotes')
const mocks = require('../../mocks')

const Config = require('../../../src/lib/config')
const ActualConfig = jest.requireActual('../../../src/lib/config')
const configInstance = new ActualConfig()
Config.mockImplementation(() => {
  return configInstance
})

const { kafkaConfig } = new ActualConfig()
const { topic, config } = kafkaConfig.PRODUCER.BULK_QUOTE.POST
const fileConfig = new ActualConfig()

describe('POST /bulkQuotes endpoint Tests -->', () => {
  const mockContext = jest.fn()
  Metrics.setup(fileConfig.instrumentationMetricsConfig)

  beforeEach(() => {
    configInstance.instrumentationMetricsConfig = false
  })

  it('should publish a bulkQuote request message', async () => {
    // Arrange
    Producer.produceMessage = jest.fn()
    const bulkQuoteId = randomUUID()
    const mockRequest = mocks.mockHttpRequest({
      payload: { bulkQuoteId }
    })
    const { handler, code } = mocks.createMockHapiHandler()

    // Act
    await bulkQuotesApi.post(mockContext, mockRequest, handler)

    // Assert
    expect(code).toHaveBeenCalledWith(Http.ReturnCodes.ACCEPTED.CODE)
    expect(Producer.produceMessage).toHaveBeenCalledTimes(1)

    const [message, topicConfig, producerConfig] = Producer.produceMessage.mock.calls[0]
    const { id, type, action } = message.content
    expect(id).toBe(bulkQuoteId)
    expect(type).toBe(Events.Event.Type.BULK_QUOTE)
    expect(action).toBe(Events.Event.Action.POST)
    expect(topicConfig.topicName).toBe(topic)
    expect(producerConfig).toStrictEqual(config)
  })

  it('should rethrow error in case of error on publishing bulkQuote', async () => {
    // Arrange
    const error = new Error('Create BulkQuote Test Error')
    Producer.produceMessage = jest.fn(async () => { throw error })

    const mockRequest = mocks.mockHttpRequest()
    const { handler } = mocks.createMockHapiHandler()
    const spyErrorLog = jest.spyOn(logger, 'error')

    // Act
    await expect(() => bulkQuotesApi.post(mockContext, mockRequest, handler))
      .rejects.toThrowError(error.message)

    // Assert
    expect(spyErrorLog).toHaveBeenCalledTimes(1)
    expect(spyErrorLog.mock.calls[0][0]).toContain(error.message)
  })

  it('should rethrow error when metrics is disabled', async () => {
    // Arrange
    configInstance.instrumentationMetricsConfig = true

    const error = new Error('Create BulkQuote Test Error')
    Producer.produceMessage = jest.fn(async () => { throw error })

    const mockRequest = mocks.mockHttpRequest()
    const { handler } = mocks.createMockHapiHandler()

    // Act
    await expect(() => bulkQuotesApi.post(mockContext, mockRequest, handler))
      .rejects.toThrowError(error.message)
  })
})
