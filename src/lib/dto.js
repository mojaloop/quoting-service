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

const { Enum, Util } = require('@mojaloop/central-services-shared')
const { PAYLOAD_STORAGES, RESOURCES } = require('../constants')
const { TransformFacades, logger } = require('../lib')
const util = require('./util')

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

const extractOriginalPayload = async (context, payloadCache) => {
  let payload

  if (context?.originalRequestPayload) {
    payload = context.originalRequestPayload
  }
  if (context?.originalRequestId) {
    payload = await payloadCache?.getPayload(context?.originalRequestId)
  }

  const result = payload ? decodePayload(payload) : null
  logger.debug('extractOriginalPayload result: ', { result, context })

  return result
}

const messageFromRequestDto = async ({
  request,
  type,
  action,
  isIsoApi = false,
  originalPayloadStorage = PAYLOAD_STORAGES.none,
  payloadCache = null
}) => {
  const { headers, params, payload, dataUri, requestId, spanContext, isError } = extractInfoFromRequestDto(request)

  const fspiopPayload = isTransformNeeded(type, action, isIsoApi)
    ? await transformPayloadToFspiopDto(payload, type, action, isError)
    : payload

  const context = { isIsoApi }
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

const isTransformNeeded = (type, action, isIsoApi) => {
  const isNeeded = isIsoApi &&
    (action !== Enum.Events.Event.Action.GET) &&
    (type !== Enum.Events.Event.Type.BULK_QUOTE)
  logger.info('isTransformNeeded:', { isNeeded, type, action, isIsoApi })
  return isNeeded
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

const makeErrorPayloadDto = async (errObject, headers, resource, log = logger) => {
  const isIsoApi = util.isIso20022ApiRequest(headers)
  log.debug('makeErrorPayload from errObject:', { errObject, isIsoApi })

  const errPayload = isIsoApi
    ? (await TransformFacades.FSPIOP[resource].putError({ body: errObject })).body
    : errObject
  log.verbose('makeErrorPayload is done', { errPayload })

  return errPayload
}

module.exports = {
  messageFromRequestDto,
  requestDataFromMessageDto,
  topicConfigDto,
  transformPayloadToFspiopDto,
  makeErrorPayloadDto,
  extractOriginalPayload
}
