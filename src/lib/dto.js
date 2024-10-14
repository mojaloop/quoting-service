const { Enum, Util } = require('@mojaloop/central-services-shared')
const { PAYLOAD_STORAGES } = require('../constants')
const { TransformFacades, logger } = require('../lib')

const { Headers } = Enum.Http
const {
  decodePayload,
  encodePayload,
  createEventState,
  createEventMetadata,
  createMetadata
} = Util.StreamingProtocol

const makeMessageMetadata = (id, type, action) => {
  const { SUCCESS } = Enum.Events.EventStatus
  const state = createEventState(SUCCESS.status, SUCCESS.code, SUCCESS.description)
  const event = createEventMetadata(type, action, state)

  return createMetadata(id, event)
}

const extractInfoFromRequestDto = (request = {}) => {
  const { headers, payload = {}, params = {} } = request
  const { spanContext } = request.span || {}
  const { id: requestId } = request.info || {}
  const isError = request.path?.endsWith('/error')

  return {
    headers,
    originalPayload: payload,
    params,
    requestId,
    spanContext,
    isError
  }
}

const transformPayloadToFspiopDto = async (payload, type, action, isError) => {
  const resource = type === 'quote' ? 'quotes' : 'fxQuotes'
  const operation = isError ? `${action}Error` : action
  logger.verbose('transforming to ISO20022...', { resource, operation })

  const { body } = await TransformFacades.FSPIOPISO20022[resource][operation]({ body: payload })
  return body
}

const makeContentField = ({ headers, payload, params, requestId, spanContext, type, action }) => {
  const id = params.id || payload.quoteId || payload.bulkQuoteId || payload.conversionRequestId
  const encodedJson = encodePayload(JSON.stringify(payload), headers[Headers.GENERAL.CONTENT_TYPE.value])

  return {
    requestId,
    headers,
    payload: encodedJson,
    uriParams: params,
    spanContext,
    id,
    type,
    action
  }
}

const storeOriginalPayload = async ({ originalPayloadStorage, originalPayload, content, payloadCache }) => {
  logger.debug('originalPayloadStorage: ', { originalPayloadStorage })

  if (originalPayloadStorage === PAYLOAD_STORAGES.kafka) {
    content.originalPayload = originalPayload // or add it to data field?
  } else if (originalPayloadStorage === PAYLOAD_STORAGES.redis) {
    const { requestId } = content
    const isOk = await payloadCache?.setPayload(requestId, originalPayload)
    if (!isOk) logger.warn('originalPayload was not stored in cache:', { requestId })
    content.originalPayload = { requestId }
  }

  return content
}

// todo: move to domain folder
const messageFromRequestDto = async ({
  request,
  type,
  action,
  isIsoPayload = false,
  originalPayloadStorage = PAYLOAD_STORAGES.none,
  payloadCache = null
}) => {
  const { headers, originalPayload, params, requestId, spanContext, isError } = extractInfoFromRequestDto(request)

  const needTransform = isIsoPayload && (type !== Enum.Events.Event.Type.BULK_QUOTE)
  logger.debug('needTransform:', { needTransform, type, action, isIsoPayload })

  const payload = needTransform
    ? await transformPayloadToFspiopDto(originalPayload, type, action, isError)
    : originalPayload

  const content = makeContentField({
    type, action, headers, payload, params, requestId, spanContext
  })

  await storeOriginalPayload({ originalPayloadStorage, originalPayload, content, payloadCache })

  return Object.freeze({
    content,
    type,
    from: headers[Headers.FSPIOP.SOURCE],
    to: headers[Headers.FSPIOP.DESTINATION],
    id: content.id,
    metadata: makeMessageMetadata(content.id, type, action)
  })
}

const requestDataFromMessageDto = (message) => {
  const { topic, value, offset, partition } = message

  return Object.freeze({
    topic,
    requestData: {
      ...value.content,
      offset,
      partition,
      payload: decodePayload(value.content?.payload)
      // see messageFromRequestDto for details of "content" field
    }
  })
}

const topicConfigDto = ({
  topicName,
  key = null,
  partition = null,
  opaqueKey = null
}) => Object.freeze({
  topicName,
  key,
  partition,
  opaqueKey
})

module.exports = {
  messageFromRequestDto,
  requestDataFromMessageDto,
  topicConfigDto,
  transformPayloadToFspiopDto
}
