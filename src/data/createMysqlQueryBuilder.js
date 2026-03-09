const {
  QUERY_TIMEOUT_MS = '20000',
  SLOW_QUERY_THRESHOLD_MS = '5000'
} = require('node:process').env

const Knex = require('knex')
const dto = require('./otelDto')

/**
 * @typedef {Object} KnexQueryObject
 * @prop {string} sql - Parameterized SQL (uses ? placeholders)
 * @prop {any[]} bindings - Query parameter values
 * @prop {string} method - Knex method: 'select', 'insert', 'update', 'del', 'raw', 'first'
 * @prop {string} __knexQueryUid - Unique query ID (nanoid)
 * @prop {string} [__knexTxId] - Transaction ID (present only inside transactions)
 */

/**
 * @typedef {Object} DbConfig
 * @prop {string} client - DB dialect (e.g. 'mysql2')
 * @prop {{ host: string, port: number, database: string }} connection
 * @prop {{ acquireTimeoutMillis: number }} [pool]
 */

/**
 * @typedef {Object} QBDeps
 * @prop {DbConfig} dbConfig - Db config (Knex)
 * @prop {Object} log - ContextLogger instance
 * @prop {Object} [queryBuilder] - Injected query builder (test DI seam)
 */

/** @param {QBDeps} deps */
const createMysqlQueryBuilder = ({
  dbConfig,
  log,
  queryBuilder = null
}) => {
  const qb = queryBuilder || new Knex(dbConfig)
  const queryTimeoutMs = dbConfig?.pool?.acquireTimeoutMillis || Number(QUERY_TIMEOUT_MS)
  const queryTimeoutSec = queryTimeoutMs / 1000
  const slowQueryThresholdSec = Number(SLOW_QUERY_THRESHOLD_MS) / 1000

  const queryTimings = new Map()

  const toLogMeta = (attributes, queryObject) => ({ attributes, knexTxId: queryObject.__knexTxId })

  const consumeTiming = (queryUid) => {
    const timing = queryTimings.get(queryUid)
    if (!timing) return null

    clearTimeout(timing.timer)
    queryTimings.delete(queryUid)

    return (Date.now() - timing.startTime) / 1000
  }

  /** @param {KnexQueryObject} queryObject */
  const onQuery = (queryObject) => {
    if (!queryObject?.__knexQueryUid) {
      return // transaction control queries (BEGIN/COMMIT/ROLLBACK) have no __knexQueryUid
    }

    const startTime = Date.now()
    const timer = setTimeout(() => {
      const error = new Error('Knex query timeout - no response received') // throw custom DbError (with Prometheus metric)
      const { attributes } = dto.queryErrorAttributesDto({
        error,
        queryObject,
        durationSec: queryTimeoutSec,
        dbConfig
      })
      log.warn(`knex query timeout  [${queryTimeoutSec} sec]: `, toLogMeta(attributes, queryObject))
      queryTimings.delete(queryObject.__knexQueryUid)
    }, queryTimeoutMs)
    timer.unref() // to NOT prevent process exit

    queryTimings.set(queryObject.__knexQueryUid, { startTime, timer })
  }

  /**
   * @param {any[] | number} response - SELECT: row array, INSERT: [insertId], UPDATE/DELETE: affectedRows
   * @param {KnexQueryObject} queryObject
   */
  const onQueryResponse = (response, queryObject) => {
    if (!queryObject) return

    const durationSec = consumeTiming(queryObject.__knexQueryUid)
    const returnedRows = Array.isArray(response) ? response.length : undefined

    const { attributes } = dto.queryAttributesDto({ queryObject, durationSec, returnedRows, dbConfig })

    if (durationSec != null && durationSec > slowQueryThresholdSec) {
      log.warn(`knex slow query response  [${durationSec} sec]: `, toLogMeta(attributes, queryObject))
    } else {
      log.debug('knex query response: ', toLogMeta(attributes, queryObject))
    }
  }

  /**
   * @param {Error} error
   * @param {KnexQueryObject} queryObject
   */
  const onQueryError = (error, queryObject) => {
    // think if we need to send DB error metrics to Prometheus
    if (!queryObject) return
    const durationSec = consumeTiming(queryObject.__knexQueryUid)
    const { attributes } = dto.queryErrorAttributesDto({ error, dbConfig, queryObject, durationSec })

    if (error.code === 'ER_DUP_ENTRY') {
      log.warn('knex expected query error: ', toLogMeta(attributes, queryObject))
    } else {
      log.error('knex query error: ', toLogMeta(attributes, queryObject))
    }
  }

  qb.on?.('query', onQuery)
  qb.on?.('query-response', onQueryResponse)
  qb.on?.('query-error', onQueryError)
  qb.on?.('start', () => { log.silly('knex query start...') })

  return qb
}

module.exports = createMysqlQueryBuilder
