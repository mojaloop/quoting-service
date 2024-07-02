const process = require('node:process')
const Logger = require('@mojaloop/central-services-logger')

const { createProxyCache } = require('@mojaloop/inter-scheme-proxy-cache-lib')

const createProxyClient = async (proxyCacheConfig) => {
  const retryInterval = Number(proxyCacheConfig.retryInterval)
  const proxyClient = createProxyCache(proxyCacheConfig.type, proxyCacheConfig.proxyConfig)

  const timer = setTimeout(() => {
    Logger.isErrorEnabled && Logger.error('Unable to connect to proxy cache. Exiting...', { proxyCacheConfig })
    process.exit(1)
  }, Number(proxyCacheConfig.timeout))

  while (!proxyClient.isConnected) {
    await new Promise(resolve => setTimeout(resolve, retryInterval))
  }

  clearTimeout(timer)

  return proxyClient
}

module.exports = { createProxyClient }
