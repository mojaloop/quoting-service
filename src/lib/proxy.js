const process = require('node:process')
const { createProxyCache } = require('@mojaloop/inter-scheme-proxy-cache-lib')

const createProxyClient = async ({ proxyCacheConfig, logger }) => {
  const timeout = Number(proxyCacheConfig.timeout)
  const retryInterval = Number(proxyCacheConfig.retryInterval)
  const proxyClient = createProxyCache(proxyCacheConfig.type, proxyCacheConfig.proxyConfig)
  let timedOut = false

  if (Object.prototype.hasOwnProperty.call(proxyCacheConfig.proxyConfig, 'lazyConnect') && !proxyCacheConfig.proxyConfig.lazyConnect) {
    const timer = setTimeout(() => {
      timedOut = true
      logger.isErrorEnabled && logger.error('Unable to connect to proxy cache. Exiting...', { proxyCacheConfig })
    }, timeout)

    while (!proxyClient.isConnected) {
      if (timedOut) break
      await new Promise(resolve => setTimeout(resolve, retryInterval))
    }

    clearTimeout(timer)

    if (timedOut) process.exit(1)
  }

  return proxyClient
}

module.exports = { createProxyClient }
