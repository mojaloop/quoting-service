/* eslint-disable no-process-exit  */
const v8 = require('v8')
const { name, version } = require('../../package.json')
const { logger } = require('./logger')

const processName = `${name}@${version}`
const SIGNALS = ['SIGINT', 'SIGTERM']

// todo: add JS Docs
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

  if (typeof startFn !== 'function') {
    logger.error('startFn should be async function!')
    process.exit(4)
  }
  if (typeof stopFn !== 'function') {
    logger.error('stopFn should be async function!')
    process.exit(5)
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
        process.exit(1)
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
