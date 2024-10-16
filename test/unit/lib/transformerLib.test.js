const { TransformFacades } = require('../../../src/lib')
const mocks = require('../../mocks')

describe('transformerLib Tests -->', () => {
  test('should transform postQuotes payload to ISO format', async () => {
    const fspiopBody = mocks.postQuotesPayloadDto()
    const isoPayload = await TransformFacades.FSPIOP.quotes.post({
      body: fspiopBody
    })
    expect(isoPayload.body).toBeTruthy()
    expect(isoPayload.body.GrpHdr).toBeTruthy()
    expect(isoPayload.body.CdtTrfTxInf).toBeTruthy()
    // todo: add validation of required fields
  })

  test('should transform putQuotes payload to ISO format', async () => {
    const fspiopBody = mocks.putQuotesPayloadDto()
    const isoPayload = await TransformFacades.FSPIOP.quotes.put({
      body: fspiopBody,
      params: { ID: mocks.generateULID() },
      headers: mocks.headersDto()
    })
    expect(isoPayload.body).toBeTruthy()
    expect(isoPayload.body.GrpHdr).toBeTruthy()
    expect(isoPayload.body.CdtTrfTxInf).toBeTruthy()
  })
})
