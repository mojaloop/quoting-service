/* eslint-disable no-process-exit  */
const process = require('node:process')
const v8 = require('node:v8')
const Logger = require('@mojaloop/central-services-logger')
const { name, version } = require('../../package.json')

const processName = `${name}@${version}`
const SIGNALS = ['SIGINT', 'SIGTERM']

const startingProcess = (startFn, stopFn) => {
  const startTime = Date.now()
  Logger.verbose(`starting ${processName}...`, { startTime })

  process.on('uncaughtExceptionMonitor', (err) => {
    Logger.error(`uncaughtExceptionMonitor in ${processName}: ${err?.message}`, { err })
    process.exit(2)
  })

  process.on('unhandledRejection', (err) => {
    Logger.error(`unhandledRejection in ${processName}: ${err?.message}`, { err })
    process.exit(3)
  })

  if (typeof startFn !== 'function' || typeof stopFn !== 'function') {
    Logger.error('startFn and stopFn should be async functions!')
    process.exit(4)
  }

  SIGNALS.forEach(sig => process.on(sig, () => {
    Logger.info(`${sig}: stopping ${processName}`, { sig })

    stopFn()
      .then(() => {
        Logger.info(`${processName} was stopped`, { heapStats: v8.getHeapStatistics() })
        process.exit(0)
      })
      .catch((err) => {
        Logger.warn(`${processName} was stopped with error: ${err?.message}`)
        process.exit(5)
      })
  }))

  startFn()
    .then((info) => {
      const startDurationSec = Math.round((Date.now() - startTime) / 1000)
      Logger.info(`${processName} is started  [start duration, sec: ${startDurationSec.toFixed(1)}]`, {
        info,
        startDurationSec,
        heapStats: v8.getHeapStatistics()
      })
    })
    .catch((err) => {
      Logger.error(`error on ${processName} start: ${err?.message}`, { err })
      process.exit(1)
    })
}

module.exports = startingProcess
