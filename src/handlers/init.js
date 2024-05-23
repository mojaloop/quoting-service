const { Cache } = require('memory-cache')
const { Tracer } = require('@mojaloop/event-sdk')
const Logger = require('@mojaloop/central-services-logger')

const Config = require('../lib/config')
const Database = require('../data/cachedDatabase')
const modelFactory = require('../model')
const QuotingHandler = require('./QuotingHandler')
const createConsumers = require('./createConsumers')
const { createMonitoringServer } = require('./monitoringServer')

let db
let consumersMap
let monitoringServer

const startFn = async (handlerList) => {
  const config = new Config()

  db = new Database(config)
  await db.connect()
  const isDbOk = await db.isConnected()
  if (!isDbOk) throw new Error('DB is not connected')

  const { quotesModelFactory, bulkQuotesModelFactory } = modelFactory(db)

  const handler = new QuotingHandler({
    quotesModelFactory,
    bulkQuotesModelFactory,
    config,
    logger: Logger,
    cache: new Cache(),
    tracer: Tracer
  })

  consumersMap = await createConsumers(handler.handleMessages, handlerList)
  monitoringServer = await createMonitoringServer(config.listenPort, consumersMap, db)
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
