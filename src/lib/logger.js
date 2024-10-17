const { loggerFactory } = require('@mojaloop/central-services-logger/src/contextLogger')

const logger = loggerFactory('QS') // global logger

module.exports = {
  logger,
  loggerFactory
}
