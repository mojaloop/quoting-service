const Knex = require('knex')

// const LOG_PREFIX = (event) => `knex on ${event}`

const createMysqlQueryBuilder = ({
  config, log, queryBuilder = null
} = {}) => {
  const qb = queryBuilder || new Knex(config.database)

  qb.on?.('query-error', (err) => {
    log.warn('knex on query-error: ', err)
    // todo: rethrow DB error here (with metrics)
  })

  qb.on?.('query', (data) => {
    log.debug('knex on query: ', { data })
  })

  qb.on?.('query-response', (response) => {
    log.debug('knex on query-response: ', { response })
  })

  qb.on?.('start', () => {
    log.debug('knex on start')
  })

  return qb
}

module.exports = createMysqlQueryBuilder
