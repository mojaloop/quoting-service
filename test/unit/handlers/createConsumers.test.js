const { Consumer } = require('@mojaloop/central-services-stream').Kafka
const { Functionalities } = require('../../../src/lib/enum')
const createConsumers = require('../../../src/handlers/createConsumers')

const consumeCalls = []

const consumeMethodMock = jest
  .spyOn(Consumer.prototype, 'consume')
  .mockImplementation((cb) => consumeCalls.push(cb))

describe('createConsumers Tests -->', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('should create consumers', async () => {
    const onMessageFn = jest.fn()
    const handlerList = [Functionalities.QUOTE]

    const consumers = await createConsumers(onMessageFn, handlerList)
    expect(consumeMethodMock).toHaveBeenCalledWith(onMessageFn)
    expect(consumers).toBeTruthy()
    Object.values(consumers).forEach((consumer) => {
      expect(consumer).toBeInstanceOf(Consumer)
    })
  })

  it('should throw error if onMessageFn is not a function', async () => {
    await expect(() => createConsumers({}))
      .rejects.toThrowError()
  })
})
