jest.mock('../../../src/handlers/createConsumers')
jest.mock('../../../src/handlers/monitoringServer')
jest.mock('../../../src/lib/proxy')

const init = require('../../../src/handlers/init')
const Database = require('../../../src/data/cachedDatabase')
const { Functionalities } = require('../../../src/lib/enum')

const handlerList = [Functionalities.QUOTE]

describe('init Tests -->', () => {
  let isDbOk
  const mockIsConnected = jest.fn(async () => isDbOk)

  beforeAll(() => {
    Database.prototype.isConnected = mockIsConnected
    Database.prototype.connect = jest.fn()
  })

  test('should execute without error if no deps inited', async () => {
    await expect(init.stopFn()).resolves.toBeUndefined()
  })

  test('should execute startFn without error if DB is connected', async () => {
    isDbOk = true
    await expect(init.startFn(handlerList))
      .resolves.toBeTruthy()
    expect(mockIsConnected).toHaveBeenCalled()
  })

  test('should throw error on startFn if DB is NOT connected', async () => {
    isDbOk = false
    await expect(init.startFn(handlerList))
      .rejects.toThrowError('DB is not connected')
  })
})
