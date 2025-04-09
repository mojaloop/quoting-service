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
 * Eugen Klymniuk <eugen.klymniuk@infitx.com>

 --------------
 ******/

const { randomUUID } = require('node:crypto')
const Metrics = require('@mojaloop/central-services-metrics')

const BaseQuotesModel = require('#src/model/BaseQuotesModel')
const { createDeps } = require('#src/model/deps')
const { fxQuoteMocks } = require('#test/mocks')

describe('BaseQuotesModel Tests -->', () => {
  let deps
  let db
  let proxyClient
  let requestId
  let httpRequest

  beforeEach(() => {
    db = fxQuoteMocks.db()
    proxyClient = fxQuoteMocks.proxyClient()
    requestId = randomUUID()
    httpRequest = jest.fn().mockResolvedValue({ status: 200 })
    deps = createDeps({ db, proxyClient, requestId, httpRequest })
  })

  test('should catch and log error if Metrics.getCounter fails', async () => {
    const error = new Error('Metrics Error')
    jest.spyOn(Metrics, 'getCounter').mockImplementation(() => { throw error })
    const logErrorSpy = jest.spyOn(deps.log.mlLogger, 'error')
    const model = new BaseQuotesModel(deps)

    expect(model).toBeInstanceOf(BaseQuotesModel)
    const [errMessage, meta] = logErrorSpy.mock.lastCall
    expect(errMessage).toBe('error initializing metrics in BaseQuotesModel: ')
    expect(meta.stack).toBe(error.stack)
  })
})
