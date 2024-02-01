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

const { mockRequest: Mockgen, defaultHeaders } = require('../util/helper')
const Server = require('../../src/server')
const QuotesModel = require('../../src/model/quotes')

jest.setTimeout(10000)

describe('Server Start', () => {
  let server

  afterEach(async () => {
    await server.stop({ timeout: 100 })
  })

  it('runs the server', async () => {
    // Act
    server = await Server({ listenPort: 0 })
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
    server = await Server()
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
    server = await Server()
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
})
