/* eslint-disable space-before-function-paren */
const { AuditEventAction } = require('@mojaloop/event-sdk')
const { Enum } = require('@mojaloop/central-services-shared')
const { /* createFSPIOPError, */ reformatFSPIOPError } = require('@mojaloop/central-services-error-handling').Factory

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
    // todo: think, if we need to add Metrics.getHistogram here
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
    const { QUOTES, BULK_QUOTES } = this.config.kafkaConfig.CONSUMER

    switch (topic) {
      case QUOTES.POST.topic:
        return this.handlePostQuotes(requestData)
      case BULK_QUOTES.POST.topic:
        return this.handlePostBulkQuotes(requestData)
        // todo: add the rest of cases

      default:
        this.logger.warn(ErrorMessages.unsupportedKafkaTopic, message)
      // todo: think, if we should throw an error here
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

  async handlePostBulkQuotes(requestData) {
    // todo: add impl.
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
