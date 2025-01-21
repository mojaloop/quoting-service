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
const Metrics = require('@mojaloop/central-services-metrics')

const Config = require('../../../src/lib/config')
const fileConfig = new Config()

Metrics.setup(fileConfig.instrumentationMetricsConfig)
const modelFactory = require('../../../src/model')
const QuotesModel = require('../../../src/model/quotes')
const BulkQuotesModel = require('../../../src/model/bulkQuotes')
const FxQuotesModel = require('../../../src/model/fxQuotes')

describe('modelFactory Tests -->', () => {
  it('should create models instances', () => {
    const db = {}
    const { quotesModelFactory, bulkQuotesModelFactory, fxQuotesModelFactory } = modelFactory(db)

    const quotesModel = quotesModelFactory('reqId_1')
    expect(quotesModel).toBeInstanceOf(QuotesModel)

    const bulkQuotesModel = bulkQuotesModelFactory('reqId_2')
    expect(bulkQuotesModel).toBeInstanceOf(BulkQuotesModel)

    const fxQuotesModel = fxQuotesModelFactory('reqId_3')
    expect(fxQuotesModel).toBeInstanceOf(FxQuotesModel)
  })
})
