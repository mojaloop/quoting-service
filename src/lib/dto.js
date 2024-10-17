const { Enum, Util } = require('@mojaloop/central-services-shared')
const { PAYLOAD_STORAGES, RESOURCES } = require('../constants')
const { TransformFacades, logger } = require('../lib')

const { Headers } = Enum.Http
const {
  decodePayload,
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
  const { headers, params = {}, payload = {}, dataUri = '' } = request
  const { spanContext } = request.span || {}
  const { id: requestId } = request.info || {}
  const isError = request.path?.endsWith('/error')

  return {
    headers,
    params,
    payload,
    dataUri,
    requestId,
    spanContext,
    isError
  }
}

const transformPayloadToFspiopDto = async (payload, type, action, isError) => {
  const resource = type === 'quote' ? RESOURCES.quotes : RESOURCES.fxQuotes
  const operation = isError ? `${action}Error` : action
  logger.verbose('transforming to ISO20022...', { resource, operation })

  const { body } = await TransformFacades.FSPIOPISO20022[resource][operation]({ body: payload })
  return body
}

const makeContentField = ({ type, action, headers, fspiopPayload, params, requestId, spanContext, context }) => {
  const id = params.id || fspiopPayload.quoteId || fspiopPayload.bulkQuoteId || fspiopPayload.conversionRequestId

  const content = {
    requestId,
    headers,
    payload: fspiopPayload,
    uriParams: params,
    spanContext,
    id,
    type,
    action,
    context
  }
  logger.debug('makeContentField is done: ', { content, fspiopPayload })

  return content
}

const storeOriginalPayload = async ({ originalPayloadStorage, dataUri, requestId, context, payloadCache }) => {
  logger.debug('storeOriginalPayload: ', { originalPayloadStorage })

  if (originalPayloadStorage === PAYLOAD_STORAGES.kafka) {
    context.originalRequestPayload = dataUri
  } else if (originalPayloadStorage === PAYLOAD_STORAGES.redis) {
    const isOk = await payloadCache?.setPayload(requestId, dataUri)
    if (!isOk) logger.warn('originalPayload was not stored in cache:', { requestId })
    context.originalRequestId = requestId
  }

  return context
}

const extractOriginalPayload = async (originalPayloadStorage, context, payloadCache) => {
  logger.debug('extractOriginalPayload: ', { originalPayloadStorage })
  let payload

  if (originalPayloadStorage === PAYLOAD_STORAGES.kafka) {
    payload = context?.originalRequestPayload
  }
  if (originalPayloadStorage === PAYLOAD_STORAGES.redis) {
    payload = await payloadCache?.getPayload(context?.originalRequestId)
  }

  return payload ? decodePayload(payload) : null
}

// todo: move to domain folder
const messageFromRequestDto = async ({
  request,
  type,
  action,
  isIsoApi = false,
  originalPayloadStorage = PAYLOAD_STORAGES.none,
  payloadCache = null
}) => {
  const { headers, params, payload, dataUri, requestId, spanContext, isError } = extractInfoFromRequestDto(request)

  const needTransform = isIsoApi && (type !== Enum.Events.Event.Type.BULK_QUOTE)
  logger.info('needTransform:', { needTransform, type, action, isIsoApi })

  const fspiopPayload = needTransform
    ? await transformPayloadToFspiopDto(payload, type, action, isError)
    : payload

  const context = {}
  await storeOriginalPayload({ originalPayloadStorage, dataUri, requestId, context, payloadCache })

  const content = makeContentField({
    type, action, fspiopPayload, headers, params, requestId, spanContext, context
  })

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
  transformPayloadToFspiopDto,
  extractOriginalPayload
}
