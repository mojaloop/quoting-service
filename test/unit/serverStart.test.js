/*****
 License
 --------------
 Copyright © 2017 Bill & Melinda Gates Foundation
 The Mojaloop files are made available by the Bill & Melinda Gates Foundation under the Apache License, Version 2.0 (the 'License') and you may not use these files except in compliance with the License. You may obtain a copy of the License at
 http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, the Mojaloop files are distributed on an 'AS IS' BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.

 Initial contribution
 --------------------
 The initial functionality and code base was donated by the Mowali project working in conjunction with MTN and Orange as service provides.
 * Project: Mowali

 Contributors
 --------------
 This is the official list of the Mojaloop project contributors for this file.
 Names of the original copyright holders (individuals or organizations)
 should be listed with a '*' in the first column. People who have
 contributed from an organization can be listed under the organization
 that actually holds the copyright for their contributions (see the
 Gates Foundation organization for an example). Those individuals should have
 their names indented and be marked with a '-'. Email address can be added
 optionally within square brackets <email>.
 * Gates Foundation
 - Name Surname <name.surname@gatesfoundation.com>

 * ModusBox
 - Rajiv Mothilal <rajiv.mothilal@modusbox.com>
 --------------
 ******/

const { mockRequest: Mockgen, defaultHeaders } = require('../util/helper')

let Database
let server

describe('Server Start', () => {
  beforeEach(() => {
    jest.resetModules()
    jest.mock('../../src/data/cachedDatabase')
    Database = require('../../src/data/cachedDatabase')
  })

  afterEach(() => {
    server.stop()
  })

  it('runs the server', async () => {
    // Arrange
    Database.mockImplementationOnce(() => ({
      connect: jest.fn().mockResolvedValueOnce()
    }))

    // Act
    const initialize = require('../../src/server')
    server = await initialize()
    const requests = Mockgen().requestsAsync('/health', 'get')
    // Arrange
    const mock = await requests
    const options = {
      method: 'get',
      url: '' + mock.request.path,
      headers: {
        ...mock.request.headers
      }
    }

    // Act
    const response = await server.inject(options)
    expect(response.statusCode).toBe(200)
  })

  it('post /quotes throws error when missing mandatory header', async () => {
    // Arrange
    Database.mockImplementationOnce(() => ({
      connect: jest.fn().mockResolvedValueOnce()
    }))

    // Act
    const initialize = require('../../src/server')
    server = await initialize()
    const requests = Mockgen().requestsAsync('/quotes', 'post')
    const mock = await requests

    // Arrange
    const headers = defaultHeaders()
    delete headers['fspiop-destination']
    const expectedResult = {
      errorInformation: {
        errorCode: '3102',
        errorDescription: 'Missing mandatory element - /header must have required property \'fspiop-destination\''
      }
    }

    const options = {
      method: 'post',
      url: '' + mock.request.path,
      headers,
      payload: mock.request.body
    }
    // Act
    const response = await server.inject(options)
    expect(response.statusCode).toBe(400)
    expect(response.result).toEqual(expectedResult)
  })
})
