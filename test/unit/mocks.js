const { randomUUID } = require('node:crypto')

const mockHttpRequest = ({
  requestId = randomUUID(),
  payload = {},
  params = {},
  headers = {
    'fspiop-source': 'payerFsp',
    'content-type': 'application/vnd.interoperability.quotes+json;version=1.0'
  }
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

const createMockHapiHandler = () => {
  const code = jest.fn()
  const handler = {
    response: jest.fn(() => ({ code }))
  }

  return { handler, code }
}

module.exports = {
  mockHttpRequest,
  createMockHapiHandler
}
