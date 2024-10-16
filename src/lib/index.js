const { loggerFactory } = require('@mojaloop/central-services-logger/src/contextLogger')
const { TransformFacades } = require('@mojaloop/ml-schema-transformer-lib')
const { createPayloadCache } = require('./payloadCache')

const logger = loggerFactory('QS') // global logger

module.exports = {
  logger,
  loggerFactory,
  TransformFacades,
  createPayloadCache
}
