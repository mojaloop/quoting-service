jest.mock('knex')

const createMysqlQueryBuilder = require('#src/data/createMysqlQueryBuilder')
const { SemConv } = require('#src/data/otelDto')
const { logger } = require('#src/lib/logger')
const { mockKnex, makeDbConfig, makeQueryObject } = require('#test/unit/mocks')

const makeLog = () => {
  const log = logger.child({ component: 'createMysqlQueryBuilder-test' })
  jest.spyOn(log, 'warn')
  jest.spyOn(log, 'error')
  return log
}

describe('createMysqlQueryBuilder Tests -->', () => {
  let qb
  let log

  beforeEach(() => {
    jest.useFakeTimers()
    qb = mockKnex()
    log = makeLog()
    createMysqlQueryBuilder({ dbConfig: makeDbConfig(), log, queryBuilder: qb })
  })

  afterEach(() => {
    jest.useRealTimers()
    jest.restoreAllMocks()
  })

  it('should register all four event listeners', () => {
    expect(qb.listeners.has('start')).toBe(true)
    expect(qb.listeners.has('query')).toBe(true)
    expect(qb.listeners.has('query-response')).toBe(true)
    expect(qb.listeners.has('query-error')).toBe(true)
  })

  it('should use injected queryBuilder instead of creating Knex instance', () => {
    const Knex = require('knex')

    expect(Knex).not.toHaveBeenCalled()
    expect(qb.listeners.size).toBe(4)
  })

  describe('query event', () => {
    it('should silently skip timing for transaction control queries without __knexQueryUid', () => {
      qb.listeners.get('query')({ sql: 'BEGIN;', method: 'raw' })
      qb.listeners.get('query')({ sql: 'COMMIT;', method: 'raw' })

      expect(log.warn).not.toHaveBeenCalled()
      expect(log.error).not.toHaveBeenCalled()
    })

    it('should store timing data in internal map', () => {
      const queryObject = makeQueryObject()
      qb.listeners.get('query')(queryObject)

      // Verify no immediate warn/error (timing is stored internally)
      expect(log.warn).not.toHaveBeenCalled()
    })
  })

  describe('query-response event', () => {
    it('should log WARN for slow queries', () => {
      jest.spyOn(Date, 'now')
        .mockReturnValueOnce(0)
        .mockReturnValueOnce(6000) // 6 seconds - exceeds 5s threshold

      const queryObject = makeQueryObject()
      qb.listeners.get('query')(queryObject)
      qb.listeners.get('query-response')([], queryObject)

      expect(log.warn).toHaveBeenCalledWith(
        expect.stringContaining('knex slow query'),
        expect.objectContaining({
          attributes: expect.objectContaining({
            [SemConv.ATTR_DB_SYSTEM_NAME]: 'mysql',
            [SemConv.ATTR_DB_CLIENT_OPERATION_DURATION]: 6
          }),
          knexTxId: 'tx-001'
        })
      )
    })

    it('should clear the timeout timer on response', () => {
      jest.spyOn(Date, 'now').mockReturnValue(1000)

      const queryObject = makeQueryObject()
      qb.listeners.get('query')(queryObject)
      qb.listeners.get('query-response')([], queryObject)

      // Advance past timeout - should NOT trigger warn
      jest.advanceTimersByTime(35_000)

      // Only the query-response debug log, no timeout warn
      expect(log.warn).not.toHaveBeenCalled()
    })

    it('should not warn or error when response arrives without prior query event', () => {
      const queryObject = makeQueryObject()
      qb.listeners.get('query-response')([{ id: 1 }], queryObject)

      expect(log.warn).not.toHaveBeenCalled()
      expect(log.error).not.toHaveBeenCalled()
    })
  })

  describe('query-error event', () => {
    it('should log WARN for expected ER_DUP_ENTRY errors', () => {
      jest.spyOn(Date, 'now')
        .mockReturnValueOnce(1000)
        .mockReturnValueOnce(1100)

      const error = new Error('Duplicate entry')
      error.code = 'ER_DUP_ENTRY'
      error.errno = 1062

      const queryObject = makeQueryObject()
      qb.listeners.get('query')(queryObject)
      qb.listeners.get('query-error')(error, queryObject)

      expect(log.warn).toHaveBeenCalledWith(
        'knex expected query error: ',
        expect.objectContaining({
          attributes: expect.objectContaining({
            [SemConv.ATTR_ERROR_TYPE]: 'ER_DUP_ENTRY',
            [SemConv.ATTR_DB_RESPONSE_STATUS_CODE]: '1062',
            [SemConv.ATTR_DB_CLIENT_OPERATION_DURATION]: 0.1
          }),
          knexTxId: 'tx-001'
        })
      )
      expect(log.error).not.toHaveBeenCalled()
    })

    it('should clear the timeout timer on error', () => {
      jest.spyOn(Date, 'now').mockReturnValue(1000)

      const queryObject = makeQueryObject()
      qb.listeners.get('query')(queryObject)
      qb.listeners.get('query-error')(new Error('fail'), queryObject)

      jest.advanceTimersByTime(35_000)

      // Only error log, no timeout warn
      expect(log.warn).not.toHaveBeenCalled()
    })

    it('should handle error without prior query event', () => {
      const error = new Error('connection lost')
      const queryObject = makeQueryObject()
      qb.listeners.get('query-error')(error, queryObject)

      expect(log.error).toHaveBeenCalledWith(
        'knex query error: ',
        expect.objectContaining({
          attributes: expect.objectContaining({
            [SemConv.ATTR_ERROR_TYPE]: 'Error'
          }),
          knexTxId: 'tx-001'
        })
      )
      const loggedAttrs = log.error.mock.calls[0][1].attributes
      expect(loggedAttrs).not.toHaveProperty(SemConv.ATTR_DB_CLIENT_OPERATION_DURATION)
    })
  })

  describe('timeout handling', () => {
    it('should log WARN when query times out', () => {
      const queryObject = makeQueryObject()
      qb.listeners.get('query')(queryObject)

      jest.advanceTimersByTime(30_000)

      expect(log.warn).toHaveBeenCalledWith(
        expect.stringContaining('knex query timeout'),
        expect.objectContaining({
          attributes: expect.objectContaining({
            [SemConv.ATTR_DB_SYSTEM_NAME]: 'mysql',
            [SemConv.ATTR_ERROR_TYPE]: 'Error',
            [SemConv.ATTR_DB_CLIENT_OPERATION_DURATION]: 30
          }),
          knexTxId: 'tx-001'
        })
      )
    })

    it('should clean up Map entry on timeout', () => {
      const queryObject = makeQueryObject()
      qb.listeners.get('query')(queryObject)

      jest.advanceTimersByTime(30_000)

      expect(log.warn).toHaveBeenCalledTimes(1) // timeout warn only

      // Subsequent response should not trigger additional warn (Map entry cleaned up)
      qb.listeners.get('query-response')([], queryObject)
      expect(log.warn).toHaveBeenCalledTimes(1)
    })

    it('should use pool.acquireTimeoutMillis from config', () => {
      qb = mockKnex()
      log = makeLog()
      const dbConfig = makeDbConfig({ pool: { acquireTimeoutMillis: 10_000 } })
      createMysqlQueryBuilder({ dbConfig, log, queryBuilder: qb })

      const queryObject = makeQueryObject()
      qb.listeners.get('query')(queryObject)

      jest.advanceTimersByTime(9_999)
      expect(log.warn).not.toHaveBeenCalled()

      jest.advanceTimersByTime(1)
      expect(log.warn).toHaveBeenCalledWith(
        expect.stringContaining('knex query timeout'),
        expect.objectContaining({
          attributes: expect.objectContaining({
            [SemConv.ATTR_DB_CLIENT_OPERATION_DURATION]: 10
          })
        })
      )
    })
  })
})
