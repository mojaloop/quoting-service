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

 * Crosslake
 - Lewis Daly <lewisd@crosslaketech.com>

 --------------
 ******/
'use strict'

jest.mock('axios')

const axios = require('axios')
const { httpRequest, httpRequestBase } = require('../../../src/lib/http')

describe('httpRequest', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('performs a successful http request', async () => {
    // Arrange
    axios.request.mockReturnValueOnce({
      status: 200,
      data: Promise.resolve({})
    })
    const options = {}

    // Act
    await httpRequest(options, 'payeefsp')

    // Assert
    expect(axios.request).toHaveBeenCalledTimes(1)
  })

  it('handles a http exception', async () => {
    // Arrange
    axios.request.mockImplementationOnce(() => { throw new Error('Network error') })
    const options = {}

    // Act
    const action = async () => httpRequest(options, 'payeefsp')

    // Assert
    await expect(action()).rejects.toThrow('Network error')
    expect(axios.request).toHaveBeenCalledTimes(1)
  })

  it('handles a bad response', async () => {
    // Arrange
    axios.request.mockReturnValueOnce({
      status: 400,
      data: Promise.resolve({})
    })
    const options = {}

    // Act
    const action = async () => httpRequest(options, 'payeefsp')

    // Assert
    await expect(action()).rejects.toThrow('Non-success response in HTTP request')
    expect(axios.request).toHaveBeenCalledTimes(1)
  })

  it('httpRequestBase performs a successful request', async () => {
    // Arrange
    axios.request.mockResolvedValueOnce({ status: 200, data: 'response-data' })
    const options = { url: 'http://example.com', method: 'GET' }

    // Act
    const result = await httpRequestBase(options)

    // Assert
    expect(axios.request).toHaveBeenCalledWith(expect.objectContaining(options))
    expect(result).toEqual({ status: 200, data: 'response-data' })
  })

  it('httpRequestBase uses custom axios instance', async () => {
    // Arrange
    const customAxios = { request: jest.fn().mockResolvedValue({ status: 201, data: 'custom' }) }
    const options = { url: 'http://custom.com', method: 'POST' }

    // Act
    const result = await httpRequestBase(options, customAxios)

    // Assert
    expect(customAxios.request).toHaveBeenCalledWith(expect.objectContaining(options))
    expect(result).toEqual({ status: 201, data: 'custom' })
  })

  it('httpRequestBase propagates errors from axios', async () => {
    // Arrange
    const error = new Error('axios failed')
    axios.request.mockRejectedValueOnce(error)
    const options = { url: 'http://fail.com', method: 'GET' }

    // Act & Assert
    await expect(httpRequestBase(options)).rejects.toThrow('axios failed')
    expect(axios.request).toHaveBeenCalledWith(expect.objectContaining(options))
  })
})
