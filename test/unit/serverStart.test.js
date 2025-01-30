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
 * ModusBox
 - Rajiv Mothilal <rajiv.mothilal@modusbox.com>
 --------------
 ******/

jest.mock('@mojaloop/central-services-stream', () => ({
  Util: {
    Producer: {
      connectAll: jest.fn(),
      disconnect: jest.fn(),
      produceMessage: jest.fn()
    }
  }
}))
jest.mock('@mojaloop/central-services-logger')
jest.mock('../../src/model/quotes')
jest.mock('@mojaloop/central-services-stream')

const { mockRequest: Mockgen, defaultHeaders } = require('../util/helper')
const Server = require('../../src/server')
const QuotesModel = require('../../src/model/quotes')
const mocks = require('../mocks')
const uuid = require('crypto').randomUUID

jest.setTimeout(10_000)

describe('Server Start', () => {
  let server

  beforeAll(async () => {
    server = await Server()
  })

  afterAll(async () => {
    await server.stop({ timeout: 100 })
  })

  afterEach(async () => {
    jest.clearAllMocks()
  })

  it('runs the server', async () => {
    // Act

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
    // Act

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
    mock.request.body.payee.personalInfo.complexName = {
      firstName: 'firstName payee',
      middleName: 'middleName payee',
      lastName: 'lastName payee'
    }
    mock.request.body.payer.personalInfo.complexName = {
      firstName: 'firstName payer',
      middleName: 'middleName payer',
      lastName: 'lastName payer'
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

  it('post /quotes with additional asian (Myanmar) unicode characters', async () => {
    // Arrange
    QuotesModel.mockImplementationOnce(() => ({
      handleQuoteRequest: jest.fn().mockResolvedValueOnce()
    }))
    // Act

    const mock = await Mockgen().requestsAsync('/quotes', 'post')

    mock.request.body.payee.personalInfo.complexName = {
      firstName: 'firstName payee',
      middleName: 'middleName payee',
      lastName: 'lastName payee'
    }
    mock.request.body.payer.personalInfo.complexName = {
      firstName: 'firstName payer',
      middleName: 'ကောင်းထက်စံ', // Myanmar unicode characters
      lastName: 'lastName payer'
    }

    // Arrange
    const headers = defaultHeaders()

    const options = {
      method: 'post',
      url: '' + mock.request.path,
      headers,
      payload: mock.request.body
    }

    // Act
    const response = await server.inject(options)
    expect(response.statusCode).toBe(202)
  })

  it('get /quotes/{id} calls QuotesByIdGet handler', async () => {
    // Act

    const mock = await Mockgen().requestsAsync('/quotes/{id}', 'get')

    // Arrange
    const headers = defaultHeaders()

    const options = {
      method: 'get',
      url: '' + mock.request.path,
      headers
    }

    // Act
    const response = await server.inject(options)
    expect(response.statusCode).toBe(202)
  })

  it('get /quotes/{id} throws error when missing mandatory header', async () => {
    // Act

    const requests = Mockgen().requestsAsync('/quotes/{id}', 'get')
    const mock = await requests

    // Arrange
    const headers = defaultHeaders()
    delete headers.date
    const expectedResult = {
      errorInformation: {
        errorCode: '3102',
        errorDescription: 'Missing mandatory element - Missing required date header'
      }
    }

    const options = {
      method: 'get',
      url: '' + mock.request.path,
      headers
    }
    // Act
    const response = await server.inject(options)
    expect(response.statusCode).toBe(400)
    expect(response.result).toEqual(expectedResult)
  })

  it('post /quotes calls QuotesPost handler', async () => {
    // Act
    const payload = mocks.postQuotesPayloadDto()

    // Arrange
    const headers = defaultHeaders()
    const options = {
      method: 'post',
      url: '/quotes',
      headers,
      payload
    }

    // Act
    const response = await server.inject(options)
    expect(response.statusCode).toBe(202)
  })

  it('put /quotes/{id} calls QuotesByIdPut handler', async () => {
    // Act
    const payload = mocks.putQuotesPayloadDto()
    payload.expiration = new Date().toISOString()
    payload.condition = 'aAGyvOxOr4yvZo3TalJwvhdWelZp5JNC0MRqwK4DXQI'

    // Arrange
    const headers = defaultHeaders()

    const options = {
      method: 'put',
      url: '/quotes/' + uuid(),
      headers,
      payload
    }

    // Act
    const response = await server.inject(options)
    expect(response.statusCode).toBe(200)
  })

  it('put /quotes/{id}/error calls QuotesErrorByIDPut handler', async () => {
    // Act
    const mock = await Mockgen().requestsAsync('/quotes/{id}/error', 'put')

    // Arrange
    const headers = defaultHeaders()

    const options = {
      method: 'put',
      url: '' + mock.request.path,
      headers,
      payload: mock.request.body
    }

    // Act
    const response = await server.inject(options)
    expect(response.statusCode).toBe(200)
  })

  it('put /bulkQuotes/{id}/error calls BulkQuotesErrorByIdPut handler', async () => {
    // Act
    const mock = await Mockgen().requestsAsync('/bulkQuotes/{id}/error', 'put')

    // Arrange
    const headers = defaultHeaders()

    const options = {
      method: 'put',
      url: '' + mock.request.path,
      headers,
      payload: mock.request.body
    }

    // Act
    const response = await server.inject(options)
    expect(response.statusCode).toBe(200)
  })

  it('get /bulkQuotes/{id} calls BulkQuotesByIdGet handler', async () => {
    // Act
    const mock = await Mockgen().requestsAsync('/bulkQuotes/{id}', 'get')

    // Arrange
    const headers = defaultHeaders()

    const options = {
      method: 'get',
      url: '' + mock.request.path,
      headers
    }

    // Act
    const response = await server.inject(options)
    expect(response.statusCode).toBe(202)
  })

  it('put /bulkQuotes/{id} calls BulkQuotesByIdPut handler', async () => {
    // Act
    const payload = mocks.putBulkQuotesPayloadDto()
    payload.individualQuoteResults[0].condition = 'aAGyvOxOr4yvZo3TalJwvhdWelZp5JNC0MRqwK4DXQI'

    // Arrange
    const headers = defaultHeaders()

    const options = {
      method: 'put',
      url: `/bulkQuotes/${uuid()}`,
      headers,
      payload
    }

    // Act
    const response = await server.inject(options)
    expect(response.statusCode).toBe(200)
  })

  it('post /bulkQuotes calls BulkQuotesPost handler', async () => {
    // Act
    const payload = mocks.postBulkQuotesPayloadDto()

    // Arrange
    const headers = defaultHeaders()

    const options = {
      method: 'post',
      url: '/bulkQuotes',
      headers,
      payload
    }

    // Act
    const response = await server.inject(options)
    expect(response.statusCode).toBe(202)
  })

  it('put /fxQuotes/{id}/error calls FxQuotesByIDAndErrorPut handler', async () => {
    // Act
    const mock = await Mockgen().requestsAsync('/fxQuotes/{id}/error', 'put')

    // Arrange
    const headers = defaultHeaders()

    const options = {
      method: 'put',
      url: mock.request.path,
      headers,
      payload: mock.request.body
    }

    // Act
    const response = await server.inject(options)
    expect(response.statusCode).toBe(200)
  })

  it('get /fxQuotes/{id} calls FxQuotesByIDGet handler', async () => {
    // Act
    const mock = await Mockgen().requestsAsync('/fxQuotes/{id}', 'get')

    // Arrange
    const headers = defaultHeaders()

    const options = {
      method: 'get',
      url: '' + mock.request.path,
      headers
    }

    // Act
    const response = await server.inject(options)
    expect(response.statusCode).toBe(202)
  })

  it('put /fxQuotes/{id} calls FxQuotesByIdPut handler', async () => {
    // Act
    const payload = mocks.putFxQuotesPayloadDto()
    payload.condition = 'aAGyvOxOr4yvZo3TalJwvhdWelZp5JNC0MRqwK4DXQI'
    // Arrange
    const headers = defaultHeaders()

    const options = {
      method: 'put',
      url: '/fxQuotes/' + uuid(),
      headers,
      payload
    }

    // Act
    const response = await server.inject(options)
    expect(response.statusCode).toBe(200)
  })

  it('post /fxQuotes calls FxQuotesPost handler', async () => {
    // Act
    const payload = mocks.postFxQuotesPayloadDto()

    // Arrange
    const headers = defaultHeaders()

    const options = {
      method: 'post',
      url: '/fxQuotes',
      headers,
      payload
    }

    // Act
    const response = await server.inject(options)
    expect(response.statusCode).toBe(202)
  })
})
