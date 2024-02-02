const process = require('node:process')
const startingProcess = require('../../../src/lib/startingProcess')

describe('startingProcess Tests', () => {
  let mockExit

  beforeEach(() => {
    mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {})
  })

  afterEach(() => {
    process.removeAllListeners()
    jest.clearAllMocks()
  })

  test('should exit process in startFn is nopt a function', () => {
    try {
      startingProcess()
    } catch {}
    expect(mockExit).toHaveBeenCalledWith(4)
  })

  test('should exit process in stopFn is nopt a function', () => {
    try {
      startingProcess(async () => {})
    } catch {}
    expect(mockExit).toHaveBeenCalledWith(4)
  })

  test('should exit on uncaughtExceptionMonitor', () => {
    startingProcess(async () => {}, async () => {})
    process.emit('unhandledRejection')
    expect(mockExit).toHaveBeenCalledWith(3)
  })

  test('should exit on uncaughtExceptionMonitor', () => {
    startingProcess(async () => {}, async () => {})
    process.emit('uncaughtExceptionMonitor')
    expect(mockExit).toHaveBeenCalledWith(2)
  })

  test('should call stopFn on SIGTERM', async () => {
    const stopFn = jest.fn(async () => {})
    startingProcess(async () => {}, stopFn)
    process.emit('SIGTERM')

    await new Promise(resolve => setTimeout(resolve, 100))
    expect(stopFn).toHaveBeenCalled()
    expect(mockExit).toHaveBeenCalledWith(0)
  })

  test('should exit with code 5, if stopFn throws an error', async () => {
    const stopFn = jest.fn(async () => { throw new Error('ERROR') })
    startingProcess(async () => {}, stopFn)
    process.emit('SIGTERM')

    await new Promise(resolve => setTimeout(resolve, 100))
    expect(mockExit).toHaveBeenCalledWith(5)
  })

  test('should exit with code 1, if startFn throws an error', async () => {
    const startFn = jest.fn(async () => { throw new Error('ERROR') })
    startingProcess(startFn, async () => {})

    await new Promise(resolve => setTimeout(resolve, 100))
    expect(mockExit).toHaveBeenCalledWith(1)
  })
})
