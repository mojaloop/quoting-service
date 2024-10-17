const { randomUUID } = require('node:crypto')
const { Cache } = require('memory-cache')
const { Tracer } = require('@mojaloop/event-sdk')
const { encodePayload } = require('@mojaloop/central-services-shared').Util.StreamingProtocol

jest.mock('../../../src/model/quotes')
jest.mock('../../../src/model/fxQuotes')
jest.mock('../../../src/model/bulkQuotes')

const QuotingHandler = require('../../../src/handlers/QuotingHandler')
const QuotesModel = require('../../../src/model/quotes')
const FxQuotesModel = require('../../../src/model/fxQuotes')
const BulkQuotesModel = require('../../../src/model/bulkQuotes')
const Config = require('../../../src/lib/config')
const { logger } = require('../../../src/lib')
const { PAYLOAD_STORAGES } = require('../../../src/constants')

const dto = require('../../../src/lib/dto')
const mocks = require('../mocks')

const createRequestData = async ({
  payload,
  type = 'type',
  action = 'action',
  isIsoApi = false
} = {}) => {
  const request = mocks.mockHttpRequest({ payload })
  const messageValue = await dto.messageFromRequestDto({ request, type, action, isIsoApi })
  const { requestData } = dto.requestDataFromMessageDto({ value: messageValue })

  return requestData
}

const createKafkaMessage = (topic) => ({
  topic,
  value: {
    content: { payload: '{}' }
  }
})

describe('QuotingHandler Tests -->', () => {
  let handler
  let quotesModel
  let fxQuotesModel
  let bulkQuotesModel

  const quotesModelFactory = () => quotesModel
  const fxQuotesModelFactory = () => fxQuotesModel
  const bulkQuotesModelFactory = () => bulkQuotesModel

  beforeEach(() => {
    const config = new Config()

    quotesModel = new QuotesModel({})
    fxQuotesModel = new FxQuotesModel({})
    bulkQuotesModel = new BulkQuotesModel({})

    handler = new QuotingHandler({
      quotesModelFactory,
      bulkQuotesModelFactory,
      fxQuotesModelFactory,
      config,
      logger,
      cache: new Cache(),
      payloadCache: null,
      tracer: Tracer
    })
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('handlePostQuotes method Tests', () => {
    it('should create a quote', async () => {
      const requestData = await createRequestData()

      const result = await handler.handlePostQuotes(requestData)
      expect(result).toBe(true)

      expect(quotesModel.handleQuoteRequest).toHaveBeenCalledTimes(1)
      expect(quotesModel.handleException).toHaveBeenCalledTimes(0)
    })

    it('should call handleException model method on error during quote creation', async () => {
      const throwError = new Error('Create Quote Test Error')
      quotesModel.handleQuoteRequest = jest.fn(() => { throw throwError })

      const payload = { quoteId: randomUUID() }
      const requestData = await createRequestData({ payload })
      const result = await handler.handlePostQuotes(requestData)
      expect(result).toBe(true)

      expect(quotesModel.handleException).toHaveBeenCalledTimes(1)
      const [, quoteId, fspiopErr] = quotesModel.handleException.mock.calls[0]
      expect(quoteId).toBe(payload.quoteId)
      expect(fspiopErr.message).toBe(throwError.message)
    })
  })

  describe('handlePutQuotes method Tests', () => {
    it('should process success PUT /quotes payload', async () => {
      const requestData = await createRequestData()

      const result = await handler.handlePutQuotes(requestData)
      expect(result).toBe(true)

      expect(quotesModel.handleQuoteUpdate).toHaveBeenCalledTimes(1)
      expect(quotesModel.handleException).toHaveBeenCalledTimes(0)
    })

    it('should process error PUT /quotes payload', async () => {
      const requestData = await createRequestData({
        payload: { errorInformation: {} }
      })

      const result = await handler.handlePutQuotes(requestData)
      expect(result).toBe(true)

      expect(quotesModel.handleQuoteError).toHaveBeenCalledTimes(1)
      expect(quotesModel.handleException).toHaveBeenCalledTimes(0)
    })

    it('should call handleException in case of error', async () => {
      quotesModel.handleQuoteUpdate = jest.fn(async () => { throw new Error('Test Error') })
      const requestData = await createRequestData()

      const result = await handler.handlePutQuotes(requestData)
      expect(result).toBe(true)
      expect(quotesModel.handleException).toHaveBeenCalledTimes(1)
    })
  })

  describe('handleGetQuotes method Tests', () => {
    it('should process GET /quotes payload', async () => {
      const requestData = await createRequestData()

      const result = await handler.handleGetQuotes(requestData)
      expect(result).toBe(true)

      expect(quotesModel.handleQuoteGet).toHaveBeenCalledTimes(1)
      expect(quotesModel.handleException).toHaveBeenCalledTimes(0)
    })

    it('should call handleException in case of error in handleQuoteGet', async () => {
      quotesModel.handleQuoteGet = jest.fn(async () => { throw new Error('Test Error') })
      const requestData = await createRequestData()

      const result = await handler.handleGetQuotes(requestData)
      expect(result).toBe(true)
      expect(quotesModel.handleException).toHaveBeenCalledTimes(1)
    })
  })

  describe('handlePostBulkQuotes method Tests', () => {
    it('should process POST /bulkQuotes payload', async () => {
      const requestData = await createRequestData()

      const result = await handler.handlePostBulkQuotes(requestData)
      expect(result).toBe(true)

      expect(bulkQuotesModel.handleBulkQuoteRequest).toHaveBeenCalledTimes(1)
      expect(bulkQuotesModel.handleException).toHaveBeenCalledTimes(0)
    })

    it('should call handleException in case of error in handleBulkQuoteRequest', async () => {
      bulkQuotesModel.handleBulkQuoteRequest = jest.fn(async () => { throw new Error('Test Error') })
      const requestData = await createRequestData()

      const result = await handler.handlePostBulkQuotes(requestData)
      expect(result).toBe(true)
      expect(bulkQuotesModel.handleException).toHaveBeenCalledTimes(1)
    })
  })

  describe('handlePutBulkQuotes method Tests', () => {
    it('should process success PUT /bulkQuotes payload', async () => {
      const requestData = await createRequestData()

      const result = await handler.handlePutBulkQuotes(requestData)
      expect(result).toBe(true)

      expect(bulkQuotesModel.handleBulkQuoteUpdate).toHaveBeenCalledTimes(1)
      expect(bulkQuotesModel.handleException).toHaveBeenCalledTimes(0)
    })

    it('should process error PUT /bulkQuotes payload', async () => {
      const requestData = await createRequestData({
        payload: { errorInformation: {} }
      })

      const result = await handler.handlePutBulkQuotes(requestData)
      expect(result).toBe(true)

      expect(bulkQuotesModel.handleBulkQuoteError).toHaveBeenCalledTimes(1)
      expect(bulkQuotesModel.handleBulkQuoteUpdate).toHaveBeenCalledTimes(0)
      expect(bulkQuotesModel.handleException).toHaveBeenCalledTimes(0)
    })

    it('should call handleException in case of error in handleBulkQuoteUpdate', async () => {
      bulkQuotesModel.handleBulkQuoteUpdate = jest.fn(async () => { throw new Error('Test Error') })
      const requestData = await createRequestData()

      const result = await handler.handlePutBulkQuotes(requestData)
      expect(result).toBe(true)
      expect(bulkQuotesModel.handleException).toHaveBeenCalledTimes(1)
    })
  })

  describe('handleGetBulkQuotes method Tests', () => {
    it('should process GET /bulkQuotes payload', async () => {
      const requestData = await createRequestData()

      const result = await handler.handleGetBulkQuotes(requestData)
      expect(result).toBe(true)

      expect(bulkQuotesModel.handleBulkQuoteGet).toHaveBeenCalledTimes(1)
      expect(bulkQuotesModel.handleException).toHaveBeenCalledTimes(0)
    })

    it('should call handleException in case of error in handleBulkQuoteGet', async () => {
      bulkQuotesModel.handleBulkQuoteGet = jest.fn(async () => { throw new Error('Test Error') })
      const requestData = await createRequestData()

      const result = await handler.handleGetBulkQuotes(requestData)
      expect(result).toBe(true)
      expect(bulkQuotesModel.handleException).toHaveBeenCalledTimes(1)
    })
  })

  describe('handlePostFxQuotes method Tests', () => {
    it('should process POST /fxQuotes payload', async () => {
      const requestData = await createRequestData()

      const result = await handler.handlePostFxQuotes(requestData)
      expect(result).toBe(true)

      expect(fxQuotesModel.handleFxQuoteRequest).toHaveBeenCalledTimes(1)
      expect(fxQuotesModel.handleException).toHaveBeenCalledTimes(0)
    })

    it('should call handleException in case of error in handleFxQuoteRequest', async () => {
      fxQuotesModel.handleFxQuoteRequest = jest.fn(async () => { throw new Error('Test Error') })
      const requestData = await createRequestData()

      const result = await handler.handlePostFxQuotes(requestData)
      expect(result).toBe(true)
      expect(fxQuotesModel.handleException).toHaveBeenCalledTimes(1)
    })
  })

  describe('handlePutFxQuotes method Tests', () => {
    it('should process success PUT /fxQuotes payload', async () => {
      const requestData = await createRequestData()

      const result = await handler.handlePutFxQuotes(requestData)
      expect(result).toBe(true)

      expect(fxQuotesModel.handleFxQuoteUpdate).toHaveBeenCalledTimes(1)
      expect(fxQuotesModel.handleException).toHaveBeenCalledTimes(0)
    })

    it('should process error PUT /fxQuotes payload', async () => {
      const requestData = await createRequestData({
        payload: { errorInformation: {} }
      })

      const result = await handler.handlePutFxQuotes(requestData)
      expect(result).toBe(true)

      expect(fxQuotesModel.handleFxQuoteError).toHaveBeenCalledTimes(1)
      expect(fxQuotesModel.handleFxQuoteUpdate).toHaveBeenCalledTimes(0)
      expect(fxQuotesModel.handleException).toHaveBeenCalledTimes(0)
    })

    it('should call handleException in case of error in handleFxQuoteUpdate', async () => {
      fxQuotesModel.handleFxQuoteUpdate = jest.fn(async () => { throw new Error('Test Error') })
      const requestData = await createRequestData()

      const result = await handler.handlePutFxQuotes(requestData)
      expect(result).toBe(true)
      expect(fxQuotesModel.handleException).toHaveBeenCalledTimes(1)
    })
  })

  describe('handleGetFxQuotes method Tests', () => {
    it('should process GET /fxQuotes payload', async () => {
      const requestData = await createRequestData()

      const result = await handler.handleGetFxQuotes(requestData)
      expect(result).toBe(true)

      expect(fxQuotesModel.handleFxQuoteGet).toHaveBeenCalledTimes(1)
      expect(fxQuotesModel.handleException).toHaveBeenCalledTimes(0)
    })

    it('should call handleException in case of error in handleFxQuoteGet', async () => {
      fxQuotesModel.handleFxQuoteGet = jest.fn(async () => { throw new Error('Test Error') })
      const requestData = await createRequestData()

      const result = await handler.handleGetFxQuotes(requestData)
      expect(result).toBe(true)
      expect(fxQuotesModel.handleException).toHaveBeenCalledTimes(1)
    })
  })

  describe('defineHandlerByTopic method Tests', () => {
    const { QUOTE, BULK_QUOTE, FX_QUOTE } = (new Config()).kafkaConfig.CONSUMER

    it('should skip message processing and log warn on incorrect topic name', async () => {
      const message = createKafkaMessage('wrong-topic')
      const warnLogSpy = jest.spyOn(logger, 'warn')

      const result = await handler.defineHandlerByTopic(message)
      expect(result).toBeUndefined()
      expect(warnLogSpy).toHaveBeenCalledTimes(1)
    })

    it('should define a handler for QUOTE.POST.topic', async () => {
      const message = createKafkaMessage(QUOTE.POST.topic)
      handler.handlePostQuotes = jest.fn()

      await handler.defineHandlerByTopic(message)
      expect(handler.handlePostQuotes).toHaveBeenCalledTimes(1)
    })

    it('should define a handler for QUOTE.PUT.topic', async () => {
      const message = createKafkaMessage(QUOTE.PUT.topic)
      handler.handlePutQuotes = jest.fn()

      await handler.defineHandlerByTopic(message)
      expect(handler.handlePutQuotes).toHaveBeenCalledTimes(1)
    })

    it('should define a handler for QUOTE.GET.topic', async () => {
      const message = createKafkaMessage(QUOTE.GET.topic)
      handler.handleGetQuotes = jest.fn()

      await handler.defineHandlerByTopic(message)
      expect(handler.handleGetQuotes).toHaveBeenCalledTimes(1)
    })

    it('should define a handler for BULK_QUOTE.POST.topic', async () => {
      const message = createKafkaMessage(BULK_QUOTE.POST.topic)
      handler.handlePostBulkQuotes = jest.fn()

      await handler.defineHandlerByTopic(message)
      expect(handler.handlePostBulkQuotes).toHaveBeenCalledTimes(1)
    })

    it('should define a handler for BULK_QUOTE.PUT.topic', async () => {
      const message = createKafkaMessage(BULK_QUOTE.PUT.topic)
      handler.handlePutBulkQuotes = jest.fn()

      await handler.defineHandlerByTopic(message)
      expect(handler.handlePutBulkQuotes).toHaveBeenCalledTimes(1)
    })

    it('should define a handler for BULK_QUOTE.GET.topic', async () => {
      const message = createKafkaMessage(BULK_QUOTE.GET.topic)
      handler.handleGetBulkQuotes = jest.fn()

      await handler.defineHandlerByTopic(message)
      expect(handler.handleGetBulkQuotes).toHaveBeenCalledTimes(1)
    })

    it('should define a handler for FX_QUOTE.POST.topic', async () => {
      const message = createKafkaMessage(FX_QUOTE.POST.topic)
      handler.handlePostFxQuotes = jest.fn()

      await handler.defineHandlerByTopic(message)
      expect(handler.handlePostFxQuotes).toHaveBeenCalledTimes(1)
    })

    it('should define a handler for FX_QUOTE.PUT.topic', async () => {
      const message = createKafkaMessage(FX_QUOTE.PUT.topic)
      handler.handlePutFxQuotes = jest.fn()

      await handler.defineHandlerByTopic(message)
      expect(handler.handlePutFxQuotes).toHaveBeenCalledTimes(1)
    })

    it('should define a handler for FX_QUOTE.GET.topic', async () => {
      const message = createKafkaMessage(FX_QUOTE.GET.topic)
      handler.handleGetFxQuotes = jest.fn()

      await handler.defineHandlerByTopic(message)
      expect(handler.handleGetFxQuotes).toHaveBeenCalledTimes(1)
    })
  })

  describe('handleMessages method Tests', () => {
    it('should return true after precessing messages', async () => {
      const messages = [createKafkaMessage('topic')]
      const result = await handler.handleMessages(null, messages)
      expect(result).toBe(true)
    })

    it('should rethrow error from kafka broker', async () => {
      const error = new Error('Kafka Error')
      await expect(() => handler.handleMessages(error, []))
        .rejects.toThrowError(error.message)
    })
  })

  describe('addOriginalPayload method Tests', () => {
    const toBase64 = (json, mimeType = 'application/json') => encodePayload(JSON.stringify(json), mimeType)

    it('should add originalPayload from kafka message to requestData', async () => {
      const payload = { quoteId: randomUUID() }
      const requestData = {
        context: {
          originalRequestPayload: toBase64(payload)
        }
      }
      handler.config.originalPayloadStorage = PAYLOAD_STORAGES.kafka

      await handler.addOriginalPayload(requestData)
      expect(requestData.originalPayload).toEqual(payload)
    })

    it('should add originalPayload from redis message to requestData', async () => {
      const payload = { quoteId: randomUUID() }
      const requestId = randomUUID()
      const requestData = {
        context: {
          originalRequestId: requestId
        }
      }
      handler.config.originalPayloadStorage = PAYLOAD_STORAGES.redis
      handler.payloadCache = {
        getPayload: async (reqId) => (reqId === requestId ? toBase64(payload) : null)
      }

      await handler.addOriginalPayload(requestData)
      expect(requestData.originalPayload).toEqual(payload)
    })
  })
})
