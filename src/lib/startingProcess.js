/* eslint-disable no-process-exit  */
const process = require('node:process')
const v8 = require('node:v8')
const { name, version } = require('../../package.json')
const { logger } = require('./logger')

const processName = `${name}@${version}`
const SIGNALS = ['SIGINT', 'SIGTERM']

const startingProcess = (startFn, stopFn) => {
  const startTime = Date.now()
  logger.verbose(`starting ${processName}...`, { startTime })

  process.on('uncaughtExceptionMonitor', (err) => {
    logger.error(`uncaughtExceptionMonitor in ${processName}: ${err?.message}`, { err })
    process.exit(2)
  })

  process.on('unhandledRejection', (err) => {
    logger.error(`unhandledRejection in ${processName}: ${err?.message}`, { err })
    process.exit(3)
  })

  if (typeof startFn !== 'function' || typeof stopFn !== 'function') {
    logger.error('startFn and stopFn should be async functions!')
    process.exit(4)
  }

  SIGNALS.forEach(sig => process.on(sig, () => {
    logger.info(`${sig}: stopping ${processName}`, { sig })

    stopFn()
      .then(() => {
        logger.info(`${processName} was stopped`, { heapStats: v8.getHeapStatistics() })
        process.exit(0)
      })
      .catch((err) => {
        logger.warn(`${processName} was stopped with error: ${err?.message}`)
        process.exit(5)
      })
  }))

  startFn()
    .then((info) => {
      const startDurationSec = Math.round((Date.now() - startTime) / 1000)
      logger.info(`${processName} is started  [start duration, sec: ${startDurationSec.toFixed(1)}]`, {
        info,
        startDurationSec,
        heapStats: v8.getHeapStatistics()
      })
    })
    .catch((err) => {
      logger.error(`error on ${processName} start: ${err?.message}`, { err })
      process.exit(1)
    })
}

module.exports = startingProcess
