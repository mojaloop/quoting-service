/*****
 License
 --------------
 Copyright © 2017 Bill & Melinda Gates Foundation
 The Mojaloop files are made available by the Bill & Melinda Gates Foundation under the Apache License, Version 2.0 (the "License") and you may not use these files except in compliance with the License. You may obtain a copy of the License at
 http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, the Mojaloop files are distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
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

 * Crosslake
 - Lewis Daly <lewisd@crosslaketech.com>

 --------------
 ******/
'use strict'

jest.mock('axios')

const axios = require('axios')
const { httpRequest } = require('../../../src/lib/http')

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

  it('performs a unsuccessful http request Not found', async () => {
    // Arrange
    const error = new Error('Not Found')
    error.response = {
      status: 404
    }
    axios.request.mockImplementationOnce(() => { throw error })
    const options = {}

    // Act
    const action = async () => httpRequest(options, 'payeefsp')
    await expect(action()).rejects.toThrow('Not found')
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
})
