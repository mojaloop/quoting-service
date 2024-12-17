const idGenerator = require('@mojaloop/central-services-shared').Util.id
const Config = require('../src/lib/config')

const config = new Config()

const CONTENT_TYPE = 'application/vnd.interoperability.quotes+json;version={{API_VERSION}}'
const contentTypeFn = ({ fspiopVersion = 1.0 }) => CONTENT_TYPE.replace('{{API_VERSION}}', fspiopVersion)

const generateULID = idGenerator({ type: 'ulid' })

const kafkaMessagePayloadDto = ({
  action = 'put',
  from = config.hubName,
  to = 'greenbank',
  id = 'aaab9c4d-2aac-42ef-8aad-2e76f2fac95a',
  type = 'quote',
  payloadBase64 = 'eyJlcnJvckluZm9ybWF0aW9uIjp7ImVycm9yQ29kZSI6IjUxMDAiLCJlcnJvckRlc2NyaXB0aW9uIjoiRXJyb3IgZGVzY3JpcHRpb24ifX0=',
  createdAtMs = Date.now(),
  fspiopVersion = '1.0',
  operationId = 'QuotesByID'
} = {}) => Object.freeze({
  from,
  to,
  id,
  type,
  content: {
    requestId: `${createdAtMs}:4015872a9e16:28:lsunvmzh:10002`,
    headers: {
      'content-type': contentTypeFn({ fspiopVersion }),
      accept: contentTypeFn({ fspiopVersion }),
      date: new Date(createdAtMs).toUTCString(),
      'fspiop-source': from,
      'fspiop-destination': to,
      traceparent: '00-aabbc4ff1f62cecc899cf5d8d51f42b7-0123456789abcdef0-00',
      'cache-control': 'no-cache',
      host: 'localhost:3002',
      connection: 'keep-alive',
      'content-length': '102'
    },
    payload: `data:${contentTypeFn({ fspiopVersion })};base64,${payloadBase64}`,
    uriParams: { id },
    spanContext: {
      service: operationId,
      traceId: 'aabbc4ff1f62cecc899cf5d8d51f42b7',
      spanId: '3aa852c7fa9edfbc',
      sampled: 0,
      flags: '00',
      startTimestamp: new Date(createdAtMs).toISOString(),
      tags: {
        tracestate: 'acmevendor=eyJzcGFuSWQiOiIzYWE4NTJjN2ZhOWVkZmJjIn0='
      },
      tracestates: {
        acmevendor: {
          spanId: '3aa852c7fa9edfbc'
        }
      }
    },
    id,
    type,
    action
  },
  metadata: {
    correlationId: id,
    event: {
      type,
      action,
      createdAt: new Date(createdAtMs).toISOString(),
      state: {
        status: 'success',
        code: 0,
        description: 'action successful'
      }
    },
    'protocol.createdAt': createdAtMs
  }
})

const kafkaMessagePayloadPostDto = (params = {}) => kafkaMessagePayloadDto({
  ...params,
  action: 'post',
  operationId: 'Quotes'
})

const postQuotesPayloadDto = ({
  from = 'payer',
  to = 'payee',
  quoteId = generateULID(),
  transactionId = generateULID(),
  amountType = 'SEND',
  amount = { amount: '100', currency: 'USD' },
  transactionType = transactionTypeDto(),
  payer = { partyIdInfo: { partyIdType: 'MSISDN', partyIdentifier: '987654321', fspId: from } },
  payee = { partyIdInfo: { partyIdType: 'MSISDN', partyIdentifier: '123456789', fspId: to } }
} = {}) => ({
  quoteId,
  transactionId,
  amountType,
  amount,
  transactionType,
  payer,
  payee
})

const transactionTypeDto = ({
  scenario = 'DEPOSIT',
  initiator = 'PAYER',
  initiatorType = 'CONSUMER'
} = {}) => Object.freeze({
  scenario,
  initiator,
  initiatorType
})

module.exports = {
  kafkaMessagePayloadDto,
  postQuotesPayloadDto,
  kafkaMessagePayloadPostDto,
  transactionTypeDto
}
