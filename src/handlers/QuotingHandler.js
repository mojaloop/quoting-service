/* eslint-disable space-before-function-paren */
const { Enum } = require('@mojaloop/central-services-shared')
const { reformatFSPIOPError } = require('@mojaloop/central-services-error-handling').Factory

const { ErrorMessages } = require('../lib/enum')
const { getSpanTags } = require('../lib/util')
const dto = require('../lib/dto')

const { FSPIOP } = Enum.Http.Headers

class QuotingHandler {
  constructor (deps) {
    this.quotesModelFactory = deps.quotesModelFactory
    this.bulkQuotesModelFactory = deps.bulkQuotesModelFactory
    this.logger = deps.logger
    this.config = deps.config
    this.cache = deps.cache
    this.tracer = deps.tracer
    this.handleMessages = this.handleMessages.bind(this)
  }

  async handleMessages(error, messages) {
    // think, if we need to add Metrics.getHistogram here
    if (error) {
      this.logger.error(`${ErrorMessages.consumingErrorFromKafka}: ${error.message}`)
      throw reformatFSPIOPError(error)
    }

    await Promise.allSettled(
      messages.map(msg => this.defineHandlerByTopic(msg))
    )
    this.logger.info('handleMessages is done')

    return true
  }

  async defineHandlerByTopic(message) {
    const { topic, requestData } = dto.requestDataFromMessageDto(message)
    const { QUOTE, BULK_QUOTE } = this.config.kafkaConfig.CONSUMER

    switch (topic) {
      case QUOTE.POST.topic:
        return this.handlePostQuotes(requestData)
      case QUOTE.PUT.topic:
        return this.handlePutQuotes(requestData)
      case QUOTE.GET.topic:
        return this.handleGetQuotes(requestData)
      case BULK_QUOTE.POST.topic:
        return this.handlePostBulkQuotes(requestData)
      case BULK_QUOTE.PUT.topic:
        return this.handlePutBulkQuotes(requestData)
      case BULK_QUOTE.GET.topic:
        return this.handleGetBulkQuotes(requestData)

      default:
        this.logger.warn(ErrorMessages.unsupportedKafkaTopic, message)
    }
  }

  async handlePostQuotes(requestData) {
    const { requestId, payload, headers } = requestData
    const model = this.quotesModelFactory(requestId)
    let span

    try {
      span = await this.createSpan(requestData)
      await model.handleQuoteRequest(headers, payload, span, this.cache)
      this.logger.debug('handlePostQuotes is done')
    } catch (err) {
      this.logger.error(`error in handlePostQuotes partition:${requestData.partition}, offset:${requestData.offset}: ${err?.stack}`)
      const fspiopError = reformatFSPIOPError(err)
      const fspiopSource = headers[FSPIOP.SOURCE]
      await model.handleException(fspiopSource, payload.quoteId, fspiopError, headers, span)
    }

    return true
  }

  async handlePutQuotes(requestData) {
    const { id: quoteId, requestId, payload, headers } = requestData
    const model = this.quotesModelFactory(requestId)
    const isError = !!payload.errorInformation
    let span

    try {
      span = await this.createSpan(requestData)
      const result = isError
        ? await model.handleQuoteError(headers, quoteId, payload.errorInformation, span)
        : await model.handleQuoteUpdate(headers, quoteId, payload, span)
      this.logger.isDebugEnabled && this.logger.debug(`handlePutQuotes is done: ${JSON.stringify(result)}`)
    } catch (err) {
      this.logger.error(`error in handlePutQuotes partition:${requestData.partition}, offset:${requestData.offset}: ${err?.stack}`)
      const fspiopSource = headers[FSPIOP.SOURCE]
      await model.handleException(fspiopSource, quoteId, err, headers, span)
    }

    return true
  }

  async handleGetQuotes(requestData) {
    const { id: quoteId, requestId, headers } = requestData
    const model = this.quotesModelFactory(requestId)
    let span

    try {
      span = await this.createSpan(requestData)
      await model.handleQuoteGet(headers, quoteId, span)
      this.logger.debug('handleGetQuotes is done')
    } catch (err) {
      this.logger.error(`error in handleGetQuotes partition:${requestData.partition}, offset:${requestData.offset}: ${err?.stack}`)
      const fspiopSource = headers[FSPIOP.SOURCE]
      await model.handleException(fspiopSource, quoteId, err, headers, span)
    }

    return true
  }

  async handlePostBulkQuotes(requestData) {
    const { requestId, payload, headers } = requestData
    const model = this.bulkQuotesModelFactory(requestId)
    let span

    try {
      span = await this.createSpan(requestData)
      await model.handleBulkQuoteRequest(headers, payload, span)
      this.logger.debug('handlePostBulkQuotes is done')
    } catch (err) {
      this.logger.error(`error in handlePostBulkQuotes partition:${requestData.partition}, offset:${requestData.offset}: ${err?.stack}`)
      const fspiopError = reformatFSPIOPError(err)
      const fspiopSource = headers[FSPIOP.SOURCE]
      await model.handleException(fspiopSource, payload.bulkQuoteId, fspiopError, headers, span)
    }

    return true
  }

  async handlePutBulkQuotes(requestData) {
    const { id: bulkQuoteId, requestId, payload, headers } = requestData
    const model = this.bulkQuotesModelFactory(requestId)
    const isError = !!payload.errorInformation
    let span

    try {
      span = await this.createSpan(requestData)
      const result = isError
        ? await model.handleBulkQuoteError(headers, bulkQuoteId, payload.errorInformation, span)
        : await model.handleBulkQuoteUpdate(headers, bulkQuoteId, payload, span)
      this.logger.isDebugEnabled && this.logger.debug(`handlePutBulkQuotes is done: ${JSON.stringify(result)}`)
    } catch (err) {
      this.logger.error(`error in handlePutBulkQuotes partition:${requestData.partition}, offset:${requestData.offset}: ${err?.stack}`)
      const fspiopSource = headers[FSPIOP.SOURCE]
      await model.handleException(fspiopSource, bulkQuoteId, err, headers, span)
    }

    return true
  }

  async handleGetBulkQuotes(requestData) {
    const { id: bulkQuoteId, requestId, headers } = requestData
    const model = this.bulkQuotesModelFactory(requestId)
    let span

    try {
      span = await this.createSpan(requestData)
      await model.handleBulkQuoteGet(headers, bulkQuoteId, span)
      this.logger.debug('handleGetBulkQuotes is done')
    } catch (err) {
      this.logger.error(`error in handleGetBulkQuotes partition:${requestData.partition}, offset:${requestData.offset}: ${err?.stack}`)
      const fspiopSource = headers[FSPIOP.SOURCE]
      await model.handleException(fspiopSource, bulkQuoteId, err, headers, span)
    }

    return true
  }

  async createSpan(requestData) {
    const { spanContext, type, action } = requestData

    const span = spanContext
      ? this.tracer.createChildSpanFromContext(spanContext.service, spanContext)
      : this.tracer.createSpan(`${type}-${action}`)

    const spanTags = getSpanTags(requestData, type, action)
    span.setTags(spanTags)

    return span
  }
}

module.exports = QuotingHandler
