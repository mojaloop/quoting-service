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

*****/

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
    this.fxQuotesModelFactory = deps.fxQuotesModelFactory
    this.logger = deps.logger
    this.config = deps.config
    this.cache = deps.cache
    this.payloadCache = deps.payloadCache
    this.tracer = deps.tracer
    this.handleMessages = this.handleMessages.bind(this)
  }

  async handleMessages(error, messages) {
    if (error) {
      this.logger.error(ErrorMessages.consumingErrorFromKafka, error)
      throw reformatFSPIOPError(error)
    }

    await Promise.allSettled(
      messages.map(msg => this.defineHandlerByTopic(msg))
    )
    this.logger.info('handleMessages is done')

    return true
  }

  async defineHandlerByTopic(message) {
    const { QUOTE, BULK_QUOTE, FX_QUOTE } = this.config.kafkaConfig.CONSUMER
    const { topic, requestData } = this.extractRequestData(message)
    await this.addOriginalPayload(requestData)

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
      case FX_QUOTE.POST.topic:
        return this.handlePostFxQuotes(requestData)
      case FX_QUOTE.PUT.topic:
        return this.handlePutFxQuotes(requestData)
      case FX_QUOTE.GET.topic:
        return this.handleGetFxQuotes(requestData)
      default:
        this.logger.warn(ErrorMessages.unsupportedKafkaTopic, message)
    }
  }

  async handlePostQuotes(requestData) {
    const { requestId, headers, payload, originalPayload } = requestData
    const model = this.quotesModelFactory(requestId)
    let span

    try {
      span = await this.createSpan(requestData)
      await model.handleQuoteRequest(headers, payload, span, this.cache, originalPayload)
      this.logger.debug('handlePostQuotes is done')
    } catch (err) {
      this.logger.error(`error in handlePostQuotes partition:${requestData.partition}, offset:${requestData.offset}:`, err)
      const fspiopError = reformatFSPIOPError(err)
      const fspiopSource = headers[FSPIOP.SOURCE]
      await model.handleException(fspiopSource, payload.quoteId, fspiopError, headers, span)
    } finally {
      if (span && !span.isFinished) {
        await span.finish()
      }
    }

    return true
  }

  async handlePutQuotes(requestData) {
    const { id: quoteId, requestId, headers, payload, originalPayload } = requestData
    const model = this.quotesModelFactory(requestId)
    const isError = !!payload.errorInformation
    let span

    try {
      span = await this.createSpan(requestData)
      const result = isError
        ? await model.handleQuoteError(headers, quoteId, payload.errorInformation, span, originalPayload)
        : await model.handleQuoteUpdate(headers, quoteId, payload, span, originalPayload)
      this.logger.debug('handlePutQuotes is done', { result })
    } catch (err) {
      this.logger.error(`error in handlePutQuotes partition:${requestData.partition}, offset:${requestData.offset}:`, err)
      const fspiopSource = headers[FSPIOP.SOURCE]
      await model.handleException(fspiopSource, quoteId, err, headers, span)
    } finally {
      /* istanbul ignore next */
      if (span && !span.isFinished) {
        await span.finish()
      }
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
      this.logger.error(`error in handleGetQuotes partition:${requestData.partition}, offset:${requestData.offset}:`, err)
      const fspiopSource = headers[FSPIOP.SOURCE]
      await model.handleException(fspiopSource, quoteId, err, headers, span)
    } finally {
      /* istanbul ignore next */
      if (span && !span.isFinished) {
        await span.finish()
      }
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
      this.logger.error(`error in handlePostBulkQuotes partition:${requestData.partition}, offset:${requestData.offset}:`, err)
      const fspiopError = reformatFSPIOPError(err)
      const fspiopSource = headers[FSPIOP.SOURCE]
      await model.handleException(fspiopSource, payload.bulkQuoteId, fspiopError, headers, span)
    } finally {
      /* istanbul ignore next */
      if (span && !span.isFinished) {
        await span.finish()
      }
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
      this.logger.error(`error in handlePutBulkQuotes partition:${requestData.partition}, offset:${requestData.offset}:`, err)
      const fspiopSource = headers[FSPIOP.SOURCE]
      await model.handleException(fspiopSource, bulkQuoteId, err, headers, span)
    } finally {
      if (span && !span.isFinished) {
        await span.finish()
      }
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
      this.logger.error(`error in handleGetBulkQuotes partition:${requestData.partition}, offset:${requestData.offset}:`, err)
      const fspiopSource = headers[FSPIOP.SOURCE]
      await model.handleException(fspiopSource, bulkQuoteId, err, headers, span)
    } finally {
      if (span && !span.isFinished) {
        await span.finish()
      }
    }

    return true
  }

  async handlePostFxQuotes(requestData) {
    const { requestId, headers, payload, originalPayload } = requestData
    const model = this.fxQuotesModelFactory(requestId)
    let span

    try {
      span = await this.createSpan(requestData)
      await model.handleFxQuoteRequest(headers, payload, span, originalPayload, this.cache)
      this.logger.debug('handlePostFxQuotes is done')
    } catch (err) {
      this.logger.error('error in handlePostFxQuotes:', err)
      const fspiopError = reformatFSPIOPError(err)
      const fspiopSource = headers[FSPIOP.SOURCE]
      await model.handleException(fspiopSource, payload.conversionRequestId, fspiopError, headers, span)
    } finally {
      if (span && !span.isFinished) {
        await span.finish()
      }
    }

    return true
  }

  async handlePutFxQuotes(requestData) {
    const { id: conversionRequestId, requestId, headers, payload, originalPayload } = requestData
    const model = this.fxQuotesModelFactory(requestId)
    const isError = !!payload.errorInformation
    let span

    try {
      span = await this.createSpan(requestData)
      const result = isError
        ? await model.handleFxQuoteError(headers, conversionRequestId, payload.errorInformation, span, originalPayload)
        : await model.handleFxQuoteUpdate(headers, conversionRequestId, payload, span, originalPayload)
      this.logger.debug('handlePutFxQuotes is done: ', { result })
    } catch (err) {
      this.logger.error('error in handlePutFxQuotes:', err)
      const fspiopSource = headers[FSPIOP.SOURCE]
      await model.handleException(fspiopSource, conversionRequestId, err, headers, span)
    } finally {
      if (span && !span.isFinished) {
        await span.finish()
      }
    }

    return true
  }

  async handleGetFxQuotes(requestData) {
    const { id: conversionRequestId, requestId, headers } = requestData
    const model = this.fxQuotesModelFactory(requestId)
    let span

    try {
      span = await this.createSpan(requestData)
      await model.handleFxQuoteGet(headers, conversionRequestId, span)
      this.logger.debug('handleGetBulkQuotes is done')
    } catch (err) {
      this.logger.error('error in handleGetBulkQuotes:', err)
      const fspiopSource = headers[FSPIOP.SOURCE]
      await model.handleException(fspiopSource, conversionRequestId, err, headers, span)
    } finally {
      if (span && !span.isFinished) {
        await span.finish()
      }
    }

    return true
  }

  extractRequestData(message) {
    return dto.requestDataFromMessageDto(message)
  }

  async addOriginalPayload(requestData) {
    requestData.originalPayload = await dto.extractOriginalPayload(requestData.context, this.payloadCache) || requestData.payload
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
