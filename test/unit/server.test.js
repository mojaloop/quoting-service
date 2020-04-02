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

 * Crosslake
 - Lewis Daly <lewisd@crosslaketech.com>
 --------------
 ******/

let Hapi
let Logger
let Database

describe('Server', () => {
  beforeEach(() => {
    jest.resetModules()

    jest.mock('@hapi/hapi')
    jest.mock('@mojaloop/central-services-logger')
    jest.mock('../../src/data/cachedDatabase')

    Hapi = require('@hapi/hapi')
    Logger = require('@mojaloop/central-services-logger')
    Database = require('../../src/data/cachedDatabase')
  })

  it('runs the server', async () => {
    // Arrange
    Database.mockImplementationOnce(() => ({
      connect: jest.fn().mockResolvedValueOnce()
    }))
    const mockRegister = jest.fn()
    const mockStart = jest.fn()
    const mockLog = jest.fn()
    Hapi.Server.mockImplementationOnce(() => ({
      app: {
        database: null
      },
      register: mockRegister,
      start: mockStart,
      log: mockLog,
      info: {
        host: 'localhost',
        port: 3333,
        uri: 'http://localhost:3333'
      }
    }))

    // Act
    const server = require('../../src/server')
    await server()

    // Assert
    expect(mockRegister).toHaveBeenCalledTimes(2)
    expect(mockStart).toHaveBeenCalledTimes(1)
    expect(mockLog).toHaveBeenCalledTimes(1)
  })

  it('handles exception when starting', async () => {
    // Arrange
    Database.mockImplementationOnce(() => ({
      connect: jest.fn().mockResolvedValueOnce()
    }))
    const mockRegister = jest.fn().mockImplementationOnce(() => { throw new Error('Test Error') })
    const mockStart = jest.fn()
    const mockLog = jest.fn()
    Hapi.Server.mockImplementationOnce(() => ({
      app: {
        database: null
      },
      register: mockRegister,
      start: mockStart,
      log: mockLog,
      info: {
        host: 'localhost',
        port: 3333,
        uri: 'http://localhost:3333'
      }
    }))

    // Act
    const server = require('../../src/server')
    await server()

    // Assert
    expect(mockRegister).toHaveBeenCalledTimes(1)
    expect(mockStart).not.toHaveBeenCalled()
    expect(mockLog).not.toHaveBeenCalled()
    expect(Logger.error).toHaveBeenCalledTimes(1)
  })
})
