const mockKnex = () => ({
  connect: jest.fn(),
  destroy: jest.fn(),
  transaction: jest.fn(),
  raw: jest.fn(),
  on: jest.fn((event, listener) => { listener({ event }) })
})

module.exports = {
  mockKnex
}
