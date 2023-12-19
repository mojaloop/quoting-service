const { Enum, Util } = require('@mojaloop/central-services-shared')

const { Headers } = Enum.Http
const { decodePayload, encodePayload } = Util.StreamingProtocol

const messageFromRequestDto = (request, type, action) => {
  const { headers, payload = {}, params } = request
  const { spanContext } = request.span || {}
  const id = params.id || payload.quoteId || payload.bulkQuoteId
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
    metadata: {}
  })
}

const requestDataFromMessageDto = (message) => {
  const { topic, value } = message

  return Object.freeze({
    topic,
    requestData: {
      ...value.content,
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
