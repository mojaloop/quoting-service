const { Cache } = require('memory-cache')
const { Tracer } = require('@mojaloop/event-sdk')
const Logger = require('@mojaloop/central-services-logger')
const { createProxyCache } = require('@mojaloop/inter-scheme-proxy-cache-lib')

const Config = require('../lib/config')
const Database = require('../data/cachedDatabase')
const modelFactory = require('../model')
const QuotingHandler = require('./QuotingHandler')
const createConsumers = require('./createConsumers')
const { createMonitoringServer } = require('./monitoringServer')

let db
let proxyClient
let consumersMap
let monitoringServer

const startFn = async (handlerList) => {
  const config = new Config()

  db = new Database(config)
  await db.connect()
  const isDbOk = await db.isConnected()
  if (!isDbOk) throw new Error('DB is not connected')

  // initialize proxy client
  if (config.proxyCache.enabled) {
    proxyClient = createProxyCache(config.proxyCache.type, config.proxyCache.proxyConfig)

    const retryInterval = Number(config.proxyCache.retryInterval)

    const timer = setTimeout(() => {
      Logger.error('Unable to connect to proxy cache. Exiting...')
      process.exit(1)
    }, Number(config.proxyCache.timeout))

    while (!proxyClient.isConnected) await new Promise(resolve => setTimeout(resolve, retryInterval))

    clearTimeout(timer)
  }

  const { quotesModelFactory, bulkQuotesModelFactory, fxQuotesModelFactory } = modelFactory(db, proxyClient)

  const handler = new QuotingHandler({
    quotesModelFactory,
    bulkQuotesModelFactory,
    fxQuotesModelFactory,
    config,
    logger: Logger,
    cache: new Cache(),
    tracer: Tracer
  })

  consumersMap = await createConsumers(handler.handleMessages, handlerList)
  monitoringServer = await createMonitoringServer(config.monitoringPort, consumersMap, db)
  return handler
}

const stopFn = async () => {
  await monitoringServer?.stop()
  /* istanbul ignore next */
  if (consumersMap) {
    await Promise.all(Object.values(consumersMap).map(consumer => consumer.disconnect()))
  }
  await db?.disconnect()
}

module.exports = {
  startFn,
  stopFn
}
