const { argv } = require('node:process')
const { Command } = require('commander')
const { version } = require('../../package.json')
const { logger } = require('../lib/logger')
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
  .option('--quotes', 'Start all Handlers')
  .option('--bulk_quotes', 'No Handlers Start')
  .action(async (args) => {
    const handlerList = []

    if (args.quotes) {
      logger.debug('CLI: Executing --quotes')
      handlerList.push(Functionalities.QUOTE)
    }
    if (args.bulk_quotes) {
      logger.debug('CLI: Executing --bulk_quotes')
      handlerList.push(Functionalities.BULK_QUOTE)
    }
    logger.info('handlerList:', handlerList)

    startingProcess(() => startFn(handlerList), stopFn)
  })

if (argv.length > 2) {
  program.parse(argv)
} else {
  program.help()
}
