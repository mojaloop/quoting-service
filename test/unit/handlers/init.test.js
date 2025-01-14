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

jest.mock('../../../src/handlers/createConsumers')
jest.mock('../../../src/handlers/monitoringServer')
jest.mock('../../../src/lib/proxy')

const Metrics = require('@mojaloop/central-services-metrics')
const Config = require('../../../src/lib/config')
const fileConfig = new Config()

Metrics.setup(fileConfig.instrumentationMetricsConfig)

const init = require('../../../src/handlers/init')
const Database = require('../../../src/data/cachedDatabase')
const { Functionalities } = require('../../../src/lib/enum')
const { createProxyClient } = require('../../../src/lib/proxy')

const handlerList = [Functionalities.QUOTE]

describe('init Tests -->', () => {
  let isDbOk
  const mockIsConnected = jest.fn(async () => isDbOk)

  beforeAll(() => {
    Database.prototype.isConnected = mockIsConnected
    Database.prototype.connect = jest.fn()
  })

  test('should execute without error if no deps inited', async () => {
    await expect(init.stopFn()).resolves.toBeUndefined()
  })

  test('should disconnect proxyCache if enabled', async () => {
    isDbOk = true
    const config = new Config()
    config.proxyCache.enabled = true
    const mockProxyCache = {
      isConnected: true,
      connect: jest.fn().mockResolvedValue(true),
      disconnect: jest.fn().mockResolvedValue(true)
    }
    createProxyClient.mockReturnValue(mockProxyCache)
    await init.startFn(handlerList, config)

    await expect(init.stopFn()).resolves.toBeUndefined()
    expect(mockProxyCache.disconnect).toHaveBeenCalled()
  })

  test('should execute startFn without error if DB is connected', async () => {
    isDbOk = true
    await expect(init.startFn(handlerList))
      .resolves.toBeTruthy()
    expect(mockIsConnected).toHaveBeenCalled()
  })

  test('should throw error on startFn if DB is NOT connected', async () => {
    isDbOk = false
    await expect(init.startFn(handlerList))
      .rejects.toThrowError('DB is not connected')
  })

  test('should connect proxyCache if enabled', async () => {
    isDbOk = true
    const config = new Config()
    config.proxyCache.enabled = true
    const mockProxyCache = { connect: jest.fn().mockResolvedValue(true) }
    createProxyClient.mockReturnValue(mockProxyCache)

    await expect(init.startFn(handlerList, config)).resolves.toBeTruthy()
    expect(mockProxyCache.connect).toHaveBeenCalled()
  })

  test('should throw error if proxyCache is not connected', async () => {
    isDbOk = true
    const config = new Config()
    config.proxyCache.enabled = true
    const mockProxyCache = { connect: jest.fn().mockResolvedValue(false) }
    createProxyClient.mockReturnValue(mockProxyCache)

    await expect(init.startFn(handlerList, config)).rejects.toThrowError('Proxy is not connected')
  })
})
