jest.mock('@mojaloop/inter-scheme-proxy-cache-lib', () => ({
  createProxyCache: jest.fn()
}))
const { createProxyCache } = require('@mojaloop/inter-scheme-proxy-cache-lib')
const { createProxyClient } = require('../../../src/lib/proxy')

describe('createProxyClient', () => {
  let mockProxyClient
  let proxyCacheConfig
  let logger

  beforeEach(() => {
    proxyCacheConfig = {
      retryInterval: 200,
      timeout: 5000,
      type: 'redis',
      proxyConfig: {
        host: 'localhost',
        port: 6379,
        lazyConnect: true
      }
    }

    logger = {
      isErrorEnabled: true,
      error: jest.fn()
    }

    mockProxyClient = {
      isConnected: true
    }

    createProxyCache.mockReturnValue(mockProxyClient)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('should create a proxy client and return it', async () => {
    const proxyClient = await createProxyClient({ proxyCacheConfig, logger })

    expect(proxyClient).toBeDefined()
    expect(proxyClient.isConnected).toBe(true)
  })

  it('should log an error and exit if unable to connect to proxy cache', async () => {
    const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => { })
    mockProxyClient.isConnected = false
    const modifiedConfig = { ...proxyCacheConfig, proxyConfig: { ...proxyCacheConfig.proxyConfig, lazyConnect: false } }

    await createProxyClient({ proxyCacheConfig: modifiedConfig, logger })

    expect(logger.error).toHaveBeenCalledWith('Unable to connect to proxy cache. Exiting...', {
      proxyCacheConfig: modifiedConfig
    })
    expect(mockExit).toHaveBeenCalledWith(1)

    mockExit.mockRestore()
  }, 10_000)
})
