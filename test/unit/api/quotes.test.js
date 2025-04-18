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

const { randomUUID } = require('node:crypto')
const { Http, Events } = require('@mojaloop/central-services-shared').Enum
const { Producer } = require('@mojaloop/central-services-stream').Util
const Metrics = require('@mojaloop/central-services-metrics')

const { logger } = require('../../../src/lib')
const quotesApi = require('../../../src/api/quotes')
const Config = require('../../../src/lib/config')
const mocks = require('../../mocks')

const { kafkaConfig } = new Config()
const { topic, config } = kafkaConfig.PRODUCER.QUOTE.POST
const fileConfig = new Config()

describe('POST /quotes API Tests -->', () => {
  const mockContext = jest.fn()
  Metrics.setup(fileConfig.instrumentationMetricsConfig)

  it('should publish a quote request message', async () => {
    // Arrange
    Producer.produceMessage = jest.fn()
    const quoteId = randomUUID()
    const mockRequest = mocks.mockHttpRequest({
      payload: { quoteId }
    })
    const { handler, code } = mocks.createMockHapiHandler()

    // Act
    await quotesApi.post(mockContext, mockRequest, handler)

    // Assert
    expect(code).toHaveBeenCalledWith(Http.ReturnCodes.ACCEPTED.CODE)
    expect(Producer.produceMessage).toHaveBeenCalledTimes(1)

    const [message, topicConfig, producerConfig] = Producer.produceMessage.mock.calls[0]
    const { id, type, action } = message.content
    expect(id).toBe(quoteId)
    expect(type).toBe(Events.Event.Type.QUOTE)
    expect(action).toBe(Events.Event.Action.POST)
    expect(topicConfig.topicName).toBe(topic)
    expect(producerConfig).toStrictEqual(config)
  })

  it('should publish an fxQuote request message', async () => {
    // Arrange
    Producer.produceMessage = jest.fn()
    const conversionRequestId = randomUUID()
    const mockRequest = mocks.mockHttpRequest({
      payload: { conversionRequestId, conversionTerms: { conversionId: randomUUID(), determiningTransferId: randomUUID() } },
      headers: {
        'content-type': 'application/vnd.interoperability.fxQuotes+json;version=1.0'
      }
    })
    const { handler, code } = mocks.createMockHapiHandler()

    // Act
    await quotesApi.post(mockContext, mockRequest, handler)

    // Assert
    expect(code).toHaveBeenCalledWith(Http.ReturnCodes.ACCEPTED.CODE)
    expect(Producer.produceMessage).toHaveBeenCalledTimes(1)

    const [message, topicConfig, producerConfig] = Producer.produceMessage.mock.calls[0]
    const { id, type, action } = message.content
    expect(id).toBe(conversionRequestId)
    expect(type).toBe(Events.Event.Type.FX_QUOTE)
    expect(action).toBe(Events.Event.Action.POST)
    expect(topicConfig.topicName).toBe(kafkaConfig.PRODUCER.FX_QUOTE.POST.topic)
    expect(producerConfig).toStrictEqual(kafkaConfig.PRODUCER.FX_QUOTE.POST.config)
  })

  it('should rethrow and log error in case of error on publishing quote', async () => {
    // Arrange
    const error = new Error('Create Quote Test Error')
    Producer.produceMessage = jest.fn(async () => { throw error })

    const mockRequest = mocks.mockHttpRequest()
    const { handler } = mocks.createMockHapiHandler()
    const spyErrorLog = jest.spyOn(logger, 'error')

    // Act
    await expect(() => quotesApi.post(mockContext, mockRequest, handler))
      .rejects.toThrowError(error.message)

    // Assert
    expect(spyErrorLog).toHaveBeenCalledTimes(1)
    expect(spyErrorLog.mock.calls[0][1].message).toContain(error.message)
  })

  it('should rethrow errors if metrics are disabled', async () => {
    // Arrange
    const error = new Error('Create Quote Test Error')
    Producer.produceMessage = jest.fn(async () => { throw error })

    const mockRequest = mocks.mockHttpRequest()
    const { handler } = mocks.createMockHapiHandler()
    mockRequest.server.app.config.instrumentationMetricsDisabled = true

    // Act / Assert
    await expect(() => quotesApi.post(mockContext, mockRequest, handler))
      .rejects.toThrowError(error.message)
  })
})
