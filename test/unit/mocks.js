const { randomUUID } = require('node:crypto')
// const dto = require('../../src/lib/dto')

const mockHttpRequest = ({
  payload = {},
  params = {},
  headers = { 'fspiop-source': 'payerFsp' },
  requestId = randomUUID()
} = {}) => ({
  payload,
  params,
  headers,
  info: {
    id: requestId
  },
  server: {
    app: {
      database: jest.fn()
    },
    log: jest.fn()
  },
  span: {
    setTags: jest.fn(),
    audit: jest.fn()
  }
})

// const toKafkaMessageFormat = ({
//   topic = 'topic',
//   messageData = {}
// } = {}) => Object.freeze({
//   topic,
//   value: messageData
// })

const createMockHapiHandler = () => {
  const code = jest.fn()
  const handler = {
    response: jest.fn(() => ({ code }))
  }

  return { handler, code }
}

module.exports = {
  // toKafkaMessageFormat,
  mockHttpRequest,
  createMockHapiHandler
}
