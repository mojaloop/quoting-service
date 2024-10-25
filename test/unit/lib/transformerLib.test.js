const { TransformFacades, logger } = require('../../../src/lib')
const mocks = require('../../mocks')

TransformFacades.FSPIOP.configure({ isTestingMode: true, logger })

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

  test('should transform putErrorQuotes payload to ISO format', async () => {
    const fspiopBody = mocks.errorPayloadDto()
    const isoPayload = await TransformFacades.FSPIOP.quotes.putError({
      body: fspiopBody
    })
    expect(isoPayload.body).toBeTruthy()
  })
})
