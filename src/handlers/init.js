const { Cache } = require('memory-cache')
const { Tracer } = require('@mojaloop/event-sdk')

const { logger } = require('../lib/logger')
const Config = require('../lib/config')
const Database = require('../data/cachedDatabase')
const modelFactory = require('../model')
const createConsumers = require('./createConsumers')
const QuotingHandler = require('./QuotingHandler')

let db
let consumersMap

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
    logger,
    cache: new Cache(),
    tracer: Tracer
  })

  consumersMap = await createConsumers(handler.handleMessages, handlerList)
}

const stopFn = async () => {
  if (consumersMap) {
    await Promise.all(Object.values(consumersMap).map(consumer => consumer.disconnect()))
  }
  await db?.disconnect()
}

module.exports = {
  startFn,
  stopFn
}
