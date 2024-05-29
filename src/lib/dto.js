const { Enum, Util } = require('@mojaloop/central-services-shared')

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

const messageFromRequestDto = (request, type, action) => {
  const { headers, payload = {}, params = {} } = request
  const { spanContext } = request.span || {}
  const id = params.id || payload.quoteId || payload.bulkQuoteId || payload.conversionRequestId
  const encodedJson = encodePayload(JSON.stringify(payload), headers[Headers.GENERAL.CONTENT_TYPE.value])

  return Object.freeze({
    content: {
      requestId: request.info?.id,
      headers,
      payload: encodedJson,
      uriParams: params,
      spanContext,
      id,
      type,
      action
    },
    from: headers[Headers.FSPIOP.SOURCE],
    to: headers[Headers.FSPIOP.DESTINATION],
    id,
    type,
    metadata: makeMessageMetadata(id, type, action)
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
  topicConfigDto
}
