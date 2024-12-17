const Config = new (require('../src/lib/config'))()
const CONTENT_TYPE = 'application/vnd.interoperability.quotes+json;version=1.0'

const config = new Config()

const kafkaMessagePayloadDto = ({
  from = config.hubName,
  to = 'greenbank',
  id = 'aaab9c4d-2aac-42ef-8aad-2e76f2fac95a',
  type = 'quote',
  action = 'put',
  payloadBase64 = 'eyJlcnJvckluZm9ybWF0aW9uIjp7ImVycm9yQ29kZSI6IjUxMDAiLCJlcnJvckRlc2NyaXB0aW9uIjoiRXJyb3IgZGVzY3JpcHRpb24ifX0=',
  createdAtMs = Date.now()
} = {}) => Object.freeze({
  from,
  to,
  id,
  type,
  content: {
    requestId: `${createdAtMs}:4015872a9e16:28:lsunvmzh:10002`,
    headers: {
      'content-type': CONTENT_TYPE,
      accept: CONTENT_TYPE,
      date: new Date(createdAtMs).toUTCString(),
      'fspiop-source': from,
      'fspiop-destination': to,
      traceparent: '00-aabbc4ff1f62cecc899cf5d8d51f42b7-0123456789abcdef0-00',
      'cache-control': 'no-cache',
      host: 'localhost:3002',
      connection: 'keep-alive',
      'content-length': '102'
    },
    payload: `data:${CONTENT_TYPE};base64,${payloadBase64}`,
    uriParams: { id },
    spanContext: {
      service: 'QuotesErrorByIDPut',
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

module.exports = {
  kafkaMessagePayloadDto
}
