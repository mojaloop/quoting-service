const { reformatFSPIOPError } = require('@mojaloop/central-services-error-handling').Factory
const { Consumer } = require('@mojaloop/central-services-stream').Util

const { logger } = require('../lib/logger')
const { ErrorMessages } = require('../lib/enum')
const Config = require('../lib/config')

const createConsumers = async (onMessageFn, handlerList = []) => {
  try {
    if (typeof onMessageFn !== 'function') {
      throw new TypeError(ErrorMessages.incorrectOnMessageFnType)
    }
    const { kafkaConfig } = new Config()

    const creating = []
    const topics = []
    for (const [key, value] of Object.entries(kafkaConfig.CONSUMER)) {
      if (handlerList.includes(key)) {
        for (const { topic, config } of Object.values(value)) {
          creating.push(Consumer.createHandler(topic, config, onMessageFn)) // todo: think, if we need to each topic a separate fn
          topics.push(topic)
        }
      }
    }
    await Promise.all(creating)
    logger.info('createConsumers is done', { kafkaConfig })

    // to get reference to all consumers by topic name
    const consumersMap = topics.reduce((acc, topic) => ({
      ...acc,
      [topic]: Consumer.getConsumer(topic)
    }), {})

    return Object.freeze(consumersMap)
  } catch (err) {
    logger.error(`error in createConsumers: ${err.message}`)
    throw reformatFSPIOPError(err)
  }
}

module.exports = createConsumers
