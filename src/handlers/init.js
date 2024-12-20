const { Cache } = require('memory-cache')
const { Tracer } = require('@mojaloop/event-sdk')
const Logger = require('@mojaloop/central-services-logger')

const Config = require('../lib/config')
const Database = require('../data/cachedDatabase')
const modelFactory = require('../model')
const QuotingHandler = require('./QuotingHandler')
const createConsumers = require('./createConsumers')
const { createMonitoringServer } = require('./monitoringServer')
const { createProxyClient } = require('../lib/proxy')

let db
let proxyClient
let consumersMap
let monitoringServer

const startFn = async (handlerList, appConfig = undefined) => {
  const config = appConfig || new Config()

  db = new Database(config)
  await db.connect()
  const isDbOk = await db.isConnected()
  if (!isDbOk) throw new Error('DB is not connected')

  if (config.proxyCache.enabled) {
    proxyClient = createProxyClient({ proxyCacheConfig: config.proxyCache })
    const isProxyOk = await proxyClient.connect()
    if (!isProxyOk) throw new Error('Proxy is not connected')
    Logger.isInfoEnabled && Logger.info('Proxy cache is connected')
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

  proxyClient?.isConnected && await proxyClient.disconnect()

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
