/*****
 License
 --------------
 Copyright © 2020-2025 Mojaloop Foundation
 The Mojaloop files are made available by the Mojaloop Foundation under the Apache License, Version 2.0 (the "License") and you may not use these files except in compliance with the License. You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, the Mojaloop files are distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.

 Contributors
 --------------
 This is the official list of the Mojaloop project contributors for this file.
 Names of the original copyright holders (individuals or organizations)
 should be listed with a '*' in the first column. People who have
 contributed from an organization can be listed under the organization
 that actually holds the copyright for their contributions (see the
 Mojaloop Foundation for an example). Those individuals should have
 their names indented and be marked with a '-'. Email address can be added
 optionally within square brackets <email>.

 * Mojaloop Foundation
 - Name Surname <name.surname@mojaloop.io>

 --------------
 ******/

const { Consumer } = require('@mojaloop/central-services-stream').Kafka
const { Functionalities } = require('../../../src/lib/enum')
const createConsumers = require('../../../src/handlers/createConsumers')

const connectMethodMock = jest
  .spyOn(Consumer.prototype, 'connect')
  .mockImplementation(() => {})

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
    expect(connectMethodMock).toHaveBeenCalledTimes(Object.keys(consumers).length)

    // QUOTE has 3 topics (POST, PUT, GET), so consume should be called 3 times
    const expectedConsumerCount = 3
    expect(consumeMethodMock).toHaveBeenCalledTimes(expectedConsumerCount)

    // Test that each wrapped function properly calls the original onMessageFn
    for (let i = 0; i < expectedConsumerCount; i++) {
      expect(typeof consumeMethodMock.mock.calls[i][0]).toBe('function')

      const wrappedCommand = consumeMethodMock.mock.calls[i][0]
      const testError = new Error(`test error ${i}`)
      const testMessages = [{ value: `test message ${i}` }]

      // Test with error (should still call onMessageFn)
      wrappedCommand(testError, testMessages)
      expect(onMessageFn).toHaveBeenCalledWith(testError, testMessages)

      // Test with success
      wrappedCommand(null, testMessages)
      expect(onMessageFn).toHaveBeenCalledWith(null, testMessages)
    }

    expect(consumers).toBeTruthy()
    Object.values(consumers).forEach((consumer) => {
      // Check that consume was called with a function for each consumer
      expect(consumeMethodMock).toHaveBeenCalledWith(expect.any(Function))
      expect(consumer).toBeInstanceOf(Consumer)
    })
    expect(consumers).toBeTruthy()
  })

  it('should throw error if onMessageFn is not a function', async () => {
    await expect(() => createConsumers({}))
      .rejects.toThrowError()
  })
})
