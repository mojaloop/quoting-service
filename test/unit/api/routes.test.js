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

 --------------
 *****/

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
