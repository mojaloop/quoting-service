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

*****/

const { Cache } = require('memory-cache')
const { Tracer } = require('@mojaloop/event-sdk')

const Config = require('../lib/config')
const Database = require('../data/cachedDatabase')
const modelFactory = require('../model')
const QuotingHandler = require('./QuotingHandler')
const createConsumers = require('./createConsumers')
const { createMonitoringServer } = require('./monitoringServer')
const { createProxyClient } = require('../lib/proxy')
const { logger, initPayloadCache } = require('../lib')
const { version } = require('../../package.json')
const Metrics = require('@mojaloop/central-services-metrics')

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
    logger.info('Proxy cache is connected')
  }

  initializeInstrumentation(config)

  const { quotesModelFactory, bulkQuotesModelFactory, fxQuotesModelFactory } = modelFactory(db, proxyClient)

  const handler = new QuotingHandler({
    quotesModelFactory,
    bulkQuotesModelFactory,
    fxQuotesModelFactory,
    config,
    logger,
    cache: new Cache(),
    payloadCache: await initPayloadCache(config),
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

const initializeInstrumentation = (config) => {
  /* istanbul ignore next */
  if (!config.instrumentationMetricsDisabled) {
    if (config.instrumentationMetricsConfig.defaultLabels) {
      config.instrumentationMetricsConfig.defaultLabels.serviceVersion = version
    }
    Metrics.setup(config.instrumentationMetricsConfig)
  }
}

module.exports = {
  startFn,
  stopFn
}
