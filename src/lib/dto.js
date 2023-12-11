const { Headers } = require('@mojaloop/central-services-shared').Enum.Http

const messageFromRequestDto = (request, type, action) => {
  const { headers, payload, params } = request
  const { spanContext } = request.span || {}
  const id = params.id || payload.quoteId || payload.bulkQuoteId

  return Object.freeze({
    content: {
      requestId: request.info?.id,
      headers,
      payload,
      params, // think, if we need this field (we have id)
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
      ...value.content
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
