const {
  SemConv,
  queryAttributesDto,
  queryErrorAttributesDto
} = require('#src/data/otelDto')

const { makeDbConfig, makeQueryObject } = require('#test/unit/mocks')

describe('otelDto Tests -->', () => {
  describe('queryAttributesDto', () => {
    it('should produce correct attributes for a SELECT query', () => {
      const queryObject = makeQueryObject()
      const dbConfig = makeDbConfig()

      const { attributes } = queryAttributesDto({
        queryObject, durationSec: 0.123, returnedRows: 5, dbConfig
      })

      expect(attributes).toEqual({
        [SemConv.ATTR_DB_SYSTEM_NAME]: 'mysql',
        [SemConv.ATTR_DB_NAMESPACE]: 'central_ledger',
        [SemConv.ATTR_DB_OPERATION_NAME]: 'SELECT',
        [SemConv.ATTR_DB_QUERY_TEXT]: queryObject.sql,
        [SemConv.ATTR_SERVER_ADDRESS]: 'localhost',
        [SemConv.ATTR_SERVER_PORT]: 3306,
        [SemConv.ATTR_DB_COLLECTION_NAME]: 'quoteParty',
        [SemConv.ATTR_DB_QUERY_SUMMARY]: 'SELECT quoteParty',
        [SemConv.ATTR_DB_CLIENT_OPERATION_DURATION]: 0.123,
        [SemConv.ATTR_DB_RESPONSE_RETURNED_ROWS]: 5
      })
    })

    it('should include server.port when non-default', () => {
      const dbConfig = makeDbConfig({ connection: { port: 3307 } })
      const { attributes } = queryAttributesDto({
        queryObject: makeQueryObject(), dbConfig
      })

      expect(attributes[SemConv.ATTR_SERVER_PORT]).toBe(3307)
    })

    it('should include server.port even when default 3306', () => {
      const dbConfig = makeDbConfig()
      const { attributes } = queryAttributesDto({
        queryObject: makeQueryObject(), dbConfig
      })

      expect(attributes[SemConv.ATTR_SERVER_PORT]).toBe(3306)
    })

    it('should omit duration when not provided', () => {
      const { attributes } = queryAttributesDto({
        queryObject: makeQueryObject(), dbConfig: makeDbConfig()
      })

      expect(attributes).not.toHaveProperty(SemConv.ATTR_DB_CLIENT_OPERATION_DURATION)
    })

    it('should omit returnedRows when not provided', () => {
      const { attributes } = queryAttributesDto({
        queryObject: makeQueryObject(), dbConfig: makeDbConfig()
      })

      expect(attributes).not.toHaveProperty(SemConv.ATTR_DB_RESPONSE_RETURNED_ROWS)
    })

    it('should include duration of 0', () => {
      const { attributes } = queryAttributesDto({
        queryObject: makeQueryObject(), durationSec: 0, dbConfig: makeDbConfig()
      })

      expect(attributes[SemConv.ATTR_DB_CLIENT_OPERATION_DURATION]).toBe(0)
    })

    it('should map "del" method to DELETE operation', () => {
      const queryObject = makeQueryObject({
        method: 'del',
        sql: 'delete from `quote` where `id` = ?'
      })
      const { attributes } = queryAttributesDto({
        queryObject, dbConfig: makeDbConfig()
      })

      expect(attributes[SemConv.ATTR_DB_OPERATION_NAME]).toBe('DELETE')
      expect(attributes[SemConv.ATTR_DB_QUERY_SUMMARY]).toBe('DELETE quote')
    })

    it('should handle INSERT query', () => {
      const queryObject = makeQueryObject({
        method: 'insert',
        sql: 'insert into `quote` (`id`, `amount`) values (?, ?)'
      })
      const { attributes } = queryAttributesDto({
        queryObject, dbConfig: makeDbConfig()
      })

      expect(attributes[SemConv.ATTR_DB_OPERATION_NAME]).toBe('INSERT')
      expect(attributes[SemConv.ATTR_DB_COLLECTION_NAME]).toBe('quote')
      expect(attributes[SemConv.ATTR_DB_QUERY_SUMMARY]).toBe('INSERT quote')
    })

    it('should omit collection and summary when table cannot be extracted', () => {
      const queryObject = makeQueryObject({
        method: 'raw',
        sql: 'BEGIN TRANSACTION'
      })
      const { attributes } = queryAttributesDto({
        queryObject, dbConfig: makeDbConfig()
      })

      expect(attributes).not.toHaveProperty(SemConv.ATTR_DB_COLLECTION_NAME)
      expect(attributes).not.toHaveProperty(SemConv.ATTR_DB_QUERY_SUMMARY)
    })
  })

  describe('queryErrorAttributesDto', () => {
    it('should include error.type from error.code', () => {
      const error = new Error('Duplicate entry')
      error.code = 'ER_DUP_ENTRY'
      error.errno = 1062

      const { attributes } = queryErrorAttributesDto({
        error,
        queryObject: makeQueryObject(),
        durationSec: 0.05,
        dbConfig: makeDbConfig()
      })

      expect(attributes[SemConv.ATTR_ERROR_TYPE]).toBe('ER_DUP_ENTRY')
      expect(attributes[SemConv.ATTR_DB_RESPONSE_STATUS_CODE]).toBe('1062')
      expect(attributes[SemConv.ATTR_DB_CLIENT_OPERATION_DURATION]).toBe(0.05)
    })

    it('should fall back to error.name when code is absent', () => {
      const error = new TypeError('invalid input')

      const { attributes } = queryErrorAttributesDto({
        error,
        queryObject: makeQueryObject(),
        dbConfig: makeDbConfig()
      })

      expect(attributes[SemConv.ATTR_ERROR_TYPE]).toBe('TypeError')
    })

    it('should use "UnknownError" when no code or name', () => {
      const error = { message: 'something failed' }

      const { attributes } = queryErrorAttributesDto({
        error,
        queryObject: makeQueryObject(),
        dbConfig: makeDbConfig()
      })

      expect(attributes[SemConv.ATTR_ERROR_TYPE]).toBe('UnknownError')
    })

    it('should omit db.response.status_code when errno is absent', () => {
      const error = new Error('connection lost')

      const { attributes } = queryErrorAttributesDto({
        error,
        queryObject: makeQueryObject(),
        dbConfig: makeDbConfig()
      })

      expect(attributes).not.toHaveProperty(SemConv.ATTR_DB_RESPONSE_STATUS_CODE)
    })

    it('should include base query attributes', () => {
      const error = new Error('fail')
      error.code = 'ER_LOCK_WAIT_TIMEOUT'

      const { attributes } = queryErrorAttributesDto({
        error,
        queryObject: makeQueryObject(),
        dbConfig: makeDbConfig()
      })

      expect(attributes[SemConv.ATTR_DB_SYSTEM_NAME]).toBe('mysql')
      expect(attributes[SemConv.ATTR_DB_OPERATION_NAME]).toBe('SELECT')
      expect(attributes[SemConv.ATTR_DB_QUERY_TEXT]).toBe('select * from `quoteParty` where `quoteId` = ?')
    })
  })
})
