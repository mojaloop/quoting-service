const { createHealthCheckServer, defaultHealthHandler } = require('@mojaloop/central-services-health')
const { HealthCheck, HealthCheckEnums } = require('@mojaloop/central-services-shared').HealthCheck
const { getSubServiceHealthDatastore } = require('../api/health')
const packageJson = require('../../package.json')

const { statusEnum, serviceName } = HealthCheckEnums

const createHealthCheck = (consumersMap, db) => {
  const checkKafkaBroker = async () => {
    const isAllConnected = await Promise.all(
      Object.values(consumersMap).map(consumer => consumer.isConnected())
    )
    const status = isAllConnected.every(Boolean)
      ? statusEnum.OK
      : statusEnum.DOWN

    return {
      name: serviceName.broker,
      status
    }
  }

  return new HealthCheck(packageJson, [
    checkKafkaBroker,
    () => getSubServiceHealthDatastore(db)
  ])
}

const startHealthServer = async (port, consumersMap, db) => {
  const checker = createHealthCheck(consumersMap, db)
  return createHealthCheckServer(port, defaultHealthHandler(checker))
}

module.exports = {
  startHealthServer,
  createHealthCheck
}
