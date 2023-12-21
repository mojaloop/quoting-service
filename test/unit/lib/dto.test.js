const dto = require('../../../src/lib/dto')

describe('dto Tests -->', () => {
  test('should provide empty objects, if no payload, params or span in request', () => {
    const request = {
      headers: { 'content-type': 'application/json' }
    }
    const message = dto.messageFromRequestDto(request, 'type', 'action')
    expect(message).toBeDefined()
    expect(message.content.uriParams).toEqual({})
    expect(message.content.spanContext).toBeUndefined()
  })
})
