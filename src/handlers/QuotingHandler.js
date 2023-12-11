/* eslint-disable space-before-function-paren */
const { AuditEventAction } = require('@mojaloop/event-sdk')
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
      this.logger.error(`${ErrorMessages.consumingErrorFromKafka}: ${error.message}`, { error })
      throw reformatFSPIOPError(error)
    }

    const results = await Promise.allSettled(
      messages.map(msg => this.defineHandlerByTopic(msg))
    )
    this.logger.info('handleMessages results:', results)

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
      const result = await model.handleQuoteRequest(headers, payload, span, this.cache)
      this.logger.debug('handlePostQuotes is done:', { result })
    } catch (err) {
      this.logger.error(`error in handlePostQuotes: ${err?.message}`, { requestData })
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
      this.logger.debug('handlePutQuotes is done:', { isError, result })
    } catch (err) {
      this.logger.error(`error in handlePutQuotes: ${err?.message}`, { isError, requestData })
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
      const result = await model.handleQuoteGet(headers, quoteId, span)
      this.logger.debug('handleGetQuotes is done:', { result })
    } catch (err) {
      this.logger.error(`error in handleGetQuotes: ${err?.message}`, { requestData })
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
      const result = await model.handleBulkQuoteRequest(headers, payload, span)
      this.logger.debug('handlePostBulkQuotes is done:', { result })
    } catch (err) {
      this.logger.error(`error in handlePostBulkQuotes: ${err?.message}`, { requestData })
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
      this.logger.debug('handlePutBulkQuotes is done:', { isError, result })
    } catch (err) {
      this.logger.error(`error in handlePutBulkQuotes: ${err?.message}`, { isError, requestData })
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
      const result = await model.handleBulkQuoteGet(headers, bulkQuoteId, span)
      this.logger.debug('handleGetBulkQuotes is done:', { result })
    } catch (err) {
      this.logger.error(`error in handleGetBulkQuotes: ${err?.message}`, { requestData })
      const fspiopSource = headers[FSPIOP.SOURCE]
      await model.handleException(fspiopSource, bulkQuoteId, err, headers, span)
    }

    return true
  }

  async createSpan(requestData) {
    const { spanContext, payload, headers, type, action } = requestData

    const span = spanContext
      ? this.tracer.createChildSpanFromContext(spanContext.service, spanContext)
      : this.tracer.createSpan(`${type}-${action}`)

    const spanTags = getSpanTags(requestData, type, action)
    span.setTags(spanTags)
    await span.audit({ payload, headers }, AuditEventAction.start)

    return span
  }
}

module.exports = QuotingHandler
