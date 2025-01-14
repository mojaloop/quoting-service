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
    Logger.error(`uncaughtExceptionMonitor in ${processName}: ${err?.stack}`, { err, stack: err?.stack })
    process.exit(2)
  })

  process.on('unhandledRejection', (err) => {
    Logger.error(`unhandledRejection in ${processName}: ${err?.stack}`, { err, stack: err?.stack })
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
        Logger.warn(`${processName} was stopped with error: ${err?.stack}`, { err, stack: err?.stack })
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
      Logger.error(`error on ${processName} start: ${err?.stack}`, { err, stack: err?.stack })
      process.exit(1)
    })
}

module.exports = startingProcess
