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
 ******/

const process = require('node:process')
const startingProcess = require('#src/lib/startingProcess')

describe('startingProcess Tests', () => {
  let mockExit

  beforeEach(() => {
    mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {})
  })

  afterEach(() => {
    process.removeAllListeners()
    jest.clearAllMocks()
  })

  test('should exit process in startFn is not a function', () => {
    try {
      startingProcess()
    } catch {}
    expect(mockExit).toHaveBeenCalledWith(4)
  })

  test('should exit process in stopFn is not a function', () => {
    try {
      startingProcess(async () => {})
    } catch {}
    expect(mockExit).toHaveBeenCalledWith(4)
  })

  test('should call stopFn on unhandledRejection', () => {
    const stopFn = jest.fn(async () => {})
    startingProcess(async () => {}, stopFn)
    process.emit('unhandledRejection')
    expect(stopFn).toHaveBeenCalledTimes(1)
  })

  test('should call stopFn on uncaughtExceptionMonitor', () => {
    const stopFn = jest.fn(async () => {})
    startingProcess(async () => {}, stopFn)
    process.emit('uncaughtExceptionMonitor')
    expect(stopFn).toHaveBeenCalledTimes(1)
  })

  test('should call stopFn on SIGTERM', async () => {
    const stopFn = jest.fn(async () => {})
    startingProcess(async () => {}, stopFn)
    process.emit('SIGTERM')

    await new Promise(resolve => setTimeout(resolve, 100))
    expect(stopFn).toHaveBeenCalled()
    expect(mockExit).toHaveBeenCalledWith(0)
  })

  test('should exit with code 5, if stopFn throws an error', async () => {
    const stopFn = jest.fn(async () => { throw new Error('ERROR') })
    startingProcess(async () => {}, stopFn)
    process.emit('SIGTERM')

    await new Promise(resolve => setTimeout(resolve, 100))
    expect(mockExit).toHaveBeenCalledWith(5)
  })

  test('should exit with code 1, if startFn throws an error', async () => {
    const startFn = jest.fn(async () => { throw new Error('ERROR') })
    startingProcess(startFn, async () => {})

    await new Promise(resolve => setTimeout(resolve, 100))
    expect(mockExit).toHaveBeenCalledWith(1)
  })
})
