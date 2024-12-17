/*****
 License
 --------------
 Copyright © 2020 Mojaloop Foundation

 The Mojaloop files are made available by the Mojaloop Foundation under the Apache License, Version 2.0
 (the "License") and you may not use these files except in compliance with the [License](http://www.apache.org/licenses/LICENSE-2.0).

 You may obtain a copy of the License at [http://www.apache.org/licenses/LICENSE-2.0](http://www.apache.org/licenses/LICENSE-2.0)

 Unless required by applicable law or agreed to in writing, the Mojaloop files are distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the [License](http://www.apache.org/licenses/LICENSE-2.0).

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

 * Steven Oderayi <steven.oderayi@infitx.com>
 --------------
 ******/

jest.mock('@mojaloop/inter-scheme-proxy-cache-lib', () => ({
  createProxyCache: jest.fn()
}))

const { createProxyCache } = require('@mojaloop/inter-scheme-proxy-cache-lib')
const { createProxyClient } = require('../../../src/lib/proxy')
const mocks = require('../../mocks')

describe('createProxyClient', () => {
  const proxyCacheConfig = mocks.proxyCacheConfigDto()
  let mockProxyClient

  beforeEach(() => {
    mockProxyClient = {
      isConnected: true,
      connect: jest.fn()
    }

    createProxyCache.mockReturnValue(mockProxyClient)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('should create a proxy client and return it', async () => {
    const proxyClient = createProxyClient({ proxyCacheConfig })

    expect(proxyClient).toBeDefined()
    expect(proxyClient.isConnected).toBe(true)
  })
})
