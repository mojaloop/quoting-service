/**
 * @typedef {Object} MockKnex
 * @prop {jest.Mock} connect
 * @prop {jest.Mock} destroy
 * @prop {jest.Mock} transaction
 * @prop {jest.Mock} raw
 * @prop {jest.Mock} on - Registers listener and stores it in the `listeners` Map
 * @prop {Map<string, Function>} listeners - Event name to listener map (populated by `on`)
 */

/** @returns {MockKnex} */
const mockKnex = () => {
  const listeners = new Map()
  return {
    connect: jest.fn(),
    destroy: jest.fn(),
    transaction: jest.fn(),
    raw: jest.fn(),
    on: jest.fn((event, fn) => {
      listeners.set(event, fn)
      // fn({ event })
    }),
    listeners
  }
}

const makeDbConfig = (overrides = {}) => ({
  client: 'mysql2',
  connection: {
    host: 'localhost',
    port: 3306,
    database: 'central_ledger',
    ...overrides.connection
  },
  pool: {
    acquireTimeoutMillis: 30_000,
    ...overrides.pool
  }
})

const makeQueryObject = (overrides = {}) => ({
  sql: 'select * from `quoteParty` where `quoteId` = ?',
  bindings: ['abc-123'],
  method: 'select',
  __knexQueryUid: 'uid-001',
  __knexTxId: 'tx-001',
  ...overrides
})

module.exports = {
  mockKnex,
  makeDbConfig,
  makeQueryObject
}
