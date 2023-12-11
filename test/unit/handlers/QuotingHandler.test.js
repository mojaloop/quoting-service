const { randomUUID } = require('node:crypto')
const { Cache } = require('memory-cache')
const { Tracer } = require('@mojaloop/event-sdk')

jest.mock('../../../src/model/quotes')
jest.mock('../../../src/data/cachedDatabase')

const QuotingHandler = require('../../../src/handlers/QuotingHandler')
const QuotesModel = require('../../../src/model/quotes')
const modelFactory = require('../../../src/model')
const Database = require('../../../src/data/cachedDatabase')
const Config = require('../../../src/lib/config')
const { logger } = require('../../../src/lib/logger')

const dto = require('../../../src/lib/dto')
const mocks = require('../mocks')

const createRequestData = ({
  payload,
  type = 'type',
  action = 'action'
} = {}) => {
  const httpRequest = mocks.mockHttpRequest({ payload })
  const { content } = dto.messageFromRequestDto(httpRequest, type, action)
  return content
  // maybe, use mocks.toKafkaMessageFormat()
}

describe('QuotingHandler Tests -->', () => {
  let handler

  beforeEach(() => {
    const config = new Config()
    const db = new Database(config)
    const { quotesModelFactory, bulkQuotesModelFactory } = modelFactory(db)

    handler = new QuotingHandler({
      quotesModelFactory,
      bulkQuotesModelFactory,
      config,
      logger,
      cache: new Cache(),
      tracer: Tracer
    })
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('handlePostQuotes method Tests', () => {
    it('should create a quote', async () => {
      const requestData = createRequestData()

      const result = await handler.handlePostQuotes(requestData)
      expect(result).toBe(true)

      const model = QuotesModel.mock.instances[0]
      expect(model.handleQuoteRequest).toHaveBeenCalledTimes(1)
      expect(model.handleException).toHaveBeenCalledTimes(0)
      // todo: add more tests
    })

    it('should call handleException model method on error during quote creation', async () => {
      const throwError = new Error('Create Quote Test Error')
      const model = {
        handleQuoteRequest: jest.fn(() => { throw throwError }),
        handleException: jest.fn()
      }
      handler.quotesModelFactory = () => model

      const payload = { quoteId: randomUUID() }
      const requestData = createRequestData({ payload })
      const result = await handler.handlePostQuotes(requestData)
      expect(result).toBe(true)

      expect(model.handleException).toHaveBeenCalledTimes(1)
      const [, quoteId, fspiopErr] = model.handleException.mock.calls[0]
      expect(quoteId).toBe(payload.quoteId)
      expect(fspiopErr.message).toBe(throwError.message)
    })
  })
})
