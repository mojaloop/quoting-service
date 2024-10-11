const dto = require('../../../src/lib/dto')
const { TransformFacades } = require('../../../src/lib')
const mocks = require('../../mocks')

describe('dto Tests -->', () => {
  test('should provide empty objects, if no payload, params or span in request', async () => {
    const request = {
      headers: { 'content-type': 'application/json' }
    }
    const message = await dto.messageFromRequestDto({ request, type: 't', action: 'a' })
    expect(message).toBeDefined()
    expect(message.content.uriParams).toEqual({})
    expect(message.content.spanContext).toBeUndefined()
  })

  describe('transformPayloadToFspiopDto Tests -->', () => {
    test.skip('should transform POST /quotes ISO payload to FSPIOP format', async () => {
      const postQuotes = mocks.postQuotesPayloadDto()

      const { body: isoPayload } = await TransformFacades.FSPIOP.quotes.post({ body: postQuotes })

      const fspiopPayload = await dto.transformPayloadToFspiopDto(isoPayload, 'quote', 'post')
      expect(fspiopPayload).toEqual(postQuotes)
    })

    test('should transform PUT /quotes/{id} ISO payload to FSPIOP format', async () => {
      const { ilpPacket, condition } = mocks.mockIlp4Combo()
      const putQuotes = mocks.putQuotesPayloadDto({ ilpPacket, condition })

      const { body: isoPayload } = await TransformFacades.FSPIOP.quotes.put({ body: putQuotes })

      const fspiopPayload = await dto.transformPayloadToFspiopDto(isoPayload, 'quote', 'put')
      expect(fspiopPayload).toEqual(putQuotes)
    })

    test('should transform PUT /quotes/{id}/error ISO payload to FSPIOP format', async () => {
      const putErrorQuotes = mocks.errorPayloadDto()

      const { body: isoPayload } = await TransformFacades.FSPIOP.quotes.putError({ body: putErrorQuotes })

      const fspiopPayload = await dto.transformPayloadToFspiopDto(isoPayload, 'quote', 'put', true)
      expect(fspiopPayload).toEqual(putErrorQuotes)
    })

    test.skip('should transform POST /fxQuotes ISO payload to FSPIOP format', async () => {
      const postFxQuotes = mocks.postFxQuotesPayloadDto()

      const { body: isoPayload } = await TransformFacades.FSPIOP.fxQuotes.post({ body: postFxQuotes })

      const fspiopPayload = await dto.transformPayloadToFspiopDto(isoPayload, 'fx-quote', 'post')
      expect(fspiopPayload).toEqual(postFxQuotes)
    })
  })
})
