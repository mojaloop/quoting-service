const {
  ATTR_DB_SYSTEM_NAME,
  ATTR_DB_NAMESPACE,
  ATTR_DB_COLLECTION_NAME,
  ATTR_DB_OPERATION_NAME,
  ATTR_DB_QUERY_TEXT,
  ATTR_DB_QUERY_SUMMARY,
  ATTR_DB_RESPONSE_STATUS_CODE,
  ATTR_SERVER_ADDRESS,
  ATTR_SERVER_PORT,
  ATTR_ERROR_TYPE
} = require('@opentelemetry/semantic-conventions')

const SemConv = Object.freeze({
  ATTR_DB_SYSTEM_NAME,
  ATTR_DB_NAMESPACE,
  ATTR_DB_COLLECTION_NAME,
  ATTR_DB_OPERATION_NAME,
  ATTR_DB_QUERY_TEXT,
  ATTR_DB_QUERY_SUMMARY,
  ATTR_DB_RESPONSE_STATUS_CODE,
  ATTR_SERVER_ADDRESS,
  ATTR_SERVER_PORT,
  ATTR_ERROR_TYPE,
  // experimental attrs - use string literals to avoid importing from incubating
  ATTR_DB_CLIENT_OPERATION_DURATION: 'db.client.operation.duration',
  ATTR_DB_RESPONSE_RETURNED_ROWS: 'db.response.returned_rows'
})

/**
 * @typedef {Object} OTelAttributes
 * @prop {Record<string, string|number>} attributes
 */

/**
 * @param {Object} params
 * @param {DbConfig} params.dbConfig
 * @param {KnexQueryObject} params.queryObject
 * @param {number} [params.durationSec] - Query duration in seconds
 * @param {number} [params.returnedRows] - Row count from response
 * @returns {OTelAttributes}
 */
const queryAttributesDto = ({
  dbConfig, queryObject, durationSec, returnedRows
}) => {
  const operation = toOtelOperation(queryObject.method)
  const tableName = extractTableName(queryObject.sql)

  return {
    attributes: {
      [SemConv.ATTR_DB_SYSTEM_NAME]: 'mysql',
      [SemConv.ATTR_DB_NAMESPACE]: dbConfig.connection.database,
      [SemConv.ATTR_DB_OPERATION_NAME]: operation,
      [SemConv.ATTR_DB_QUERY_TEXT]: queryObject.sql,
      [SemConv.ATTR_SERVER_ADDRESS]: dbConfig.connection.host,
      [SemConv.ATTR_SERVER_PORT]: dbConfig.connection.port,
      ...(tableName && {
        [SemConv.ATTR_DB_COLLECTION_NAME]: tableName,
        [SemConv.ATTR_DB_QUERY_SUMMARY]: `${operation} ${tableName}`
      }),
      ...(durationSec != null && {
        [SemConv.ATTR_DB_CLIENT_OPERATION_DURATION]: durationSec
      }),
      ...(returnedRows != null && {
        [SemConv.ATTR_DB_RESPONSE_RETURNED_ROWS]: returnedRows
      })
    }
  }
}

/**
 * @param {Object} params
 * @param {Error} params.error
 * @param {KnexQueryObject} params.queryObject
 * @param {number} [params.durationSec]
 * @param {DbConfig} params.dbConfig
 * @returns {OTelAttributes}
 */
const queryErrorAttributesDto = ({ error, queryObject, durationSec, dbConfig }) => {
  const { attributes } = queryAttributesDto({ queryObject, durationSec, dbConfig })

  return {
    attributes: {
      ...attributes,
      [SemConv.ATTR_ERROR_TYPE]: error.code || error.name || 'UnknownError',
      ...(error.errno != null && {
        [SemConv.ATTR_DB_RESPONSE_STATUS_CODE]: String(error.errno)
      })
    }
  }
}

const KNEX_METHOD_MAP = Object.freeze({
  del: 'DELETE',
  first: 'SELECT'
})
const toOtelOperation = (method) => KNEX_METHOD_MAP[method] || method?.toUpperCase()

const TABLE_NAME_RE = /(?:FROM|INTO|UPDATE|JOIN)\s+`?(\w+)`?/i
const extractTableName = (sql) => {
  const match = sql?.match(TABLE_NAME_RE)
  return match?.[1] || null
}

module.exports = {
  SemConv,
  queryAttributesDto,
  queryErrorAttributesDto
}
