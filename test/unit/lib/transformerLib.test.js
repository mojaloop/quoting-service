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
