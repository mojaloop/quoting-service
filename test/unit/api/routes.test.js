const { handleRequest } = require('../../../src/api/routes')

describe('routes', () => {
  let api
  let h

  beforeEach(() => {
    jest.resetModules()
    api = {
      handleRequest: jest.fn().mockReturnValue(200)
    }
    h = jest.fn()
  })

  const testCase = (method, path) => {
    it(`should return 200 for ${method} ${path}`, async () => {
      const req = { method, path, payload: {}, query: {}, headers: {} }
      const result = handleRequest(api, req, h)

      expect(api.handleRequest).toHaveBeenCalled()
      expect(result).toEqual(200)
      const [args] = api.handleRequest.mock.calls[0]
      expect(args.path).toEqual(req.path)
      expect(args.method).toEqual(req.method)
    })
  }

  testCase('PUT', '/quotes/{id}/error')
  testCase('GET', '/quotes/{id}')
  testCase('PUT', '/quotes/{id}')
  testCase('POST', '/quotes')
  testCase('PUT', '/bulkQuotes/{id}/error')
  testCase('GET', '/bulkQuotes/{id}')
  testCase('PUT', '/bulkQuotes/{id}')
  testCase('POST', '/bulkQuotes')
  testCase('GET', '/fxQuotes/{id}/error')
  testCase('PUT', '/fxQuotes/{id}')
  testCase('GET', '/fxQuotes/{id}')
  testCase('POST', '/fxQuotes')
  testCase('GET', '/health')
  testCase('GET', '/metrics')
})
