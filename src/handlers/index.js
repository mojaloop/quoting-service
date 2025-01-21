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

const { argv } = require('node:process')
const Logger = require('@mojaloop/central-services-logger')
const { Command } = require('commander')
const { version } = require('../../package.json')
const { Functionalities } = require('../lib/enum')
const startingProcess = require('../lib/startingProcess')
const { startFn, stopFn } = require('./init')

const program = new Command()

program
  .description('CLI to manage Handlers')
  .version(version)

program.command('handler') // sub-command name, required
  .alias('h')
  .description('Start quoting Handlers')
  .option('--quotes', 'Start quotes handler')
  .option('--bulk_quotes', 'Start bulk quotes handler')
  .option('--fx_quotes', 'Start fx quotes handler')
  .action(async (args) => {
    const handlerList = []

    /* istanbul ignore next */
    if (args.quotes) {
      Logger.debug('CLI: Executing --quotes')
      handlerList.push(Functionalities.QUOTE)
    }
    /* istanbul ignore next */
    if (args.bulk_quotes) {
      Logger.debug('CLI: Executing --bulk_quotes')
      handlerList.push(Functionalities.BULK_QUOTE)
    }
    /* istanbul ignore next */
    if (args.fx_quotes) {
      Logger.debug('CLI: Executing --fx_quotes')
      handlerList.push(Functionalities.FX_QUOTE)
    }

    Logger.info(`handlerList: ${handlerList}`)

    startingProcess(() => startFn(handlerList), stopFn)
  })

/* istanbul ignore next */
if (argv.length > 2) {
  program.parse(argv)
} else {
  program.help()
}
