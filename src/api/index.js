/*****
 License
 --------------
 Copyright © 2017 Bill & Melinda Gates Foundation
 The Mojaloop files are made available by the Bill & Melinda Gates Foundation under the Apache License, Version 2.0 (the "License") and you may not use these files except in compliance with the License. You may obtain a copy of the License at
 http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, the Mojaloop files are distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 Contributors
 --------------
 This is the official list of the Mojaloop project contributors for this file.
 Names of the original copyright holders (individuals or organizations)
 should be listed with a '*' in the first column. People who have
 contributed from an organization can be listed under the organization
 that actually holds the copyright for their contributions (see the
 Gates Foundation organization for an example). Those individuals should have
 their names indented and be marked with a '-'. Email address can be added
 optionally within square brackets <email>.
 * Gates Foundation

 * ModusBox
 - Rajiv Mothilal <rajiv.mothilal@modusbox.com>

 --------------
 ******/

'use strict'

const OpenapiBackend = require('@mojaloop/central-services-shared').Util.OpenapiBackend
const quotes = require('./quotes')
const quotesById = require('./quotes/{id}')
const quotesErrorByID = require('./quotes/{id}/error')
const health = require('./health')
const bulkQuotes = require('./bulkQuotes')
const bulkQuotesById = require('./bulkQuotes/{id}')
const bulkQuotesErrorById = require('./bulkQuotes/{id}/error')
const fxQuotes = require('./fxQuotes')
const fxQuotesById = require('./fxQuotes/{id}')
const fxQuotesErrorById = require('./fxQuotes/{id}/error')
const metrics = require('./metrics')

module.exports = {
  HealthGet: health.get,
  MetricsGet: metrics.get,
  QuotesErrorByIDPut: quotesErrorByID.put,
  QuotesByIdGet: quotesById.get,
  QuotesByIdPut: quotesById.put,
  QuotesPost: quotes.post,
  BulkQuotesErrorByIdPut: bulkQuotesErrorById.put,
  BulkQuotesByIdGet: bulkQuotesById.get,
  BulkQuotesByIdPut: bulkQuotesById.put,
  BulkQuotesPost: bulkQuotes.post,
  FxQuotesByIDAndErrorPut: fxQuotesErrorById.put,
  FxQuotesByIDGet: fxQuotesById.get,
  FxQuotesByIdPut: fxQuotesById.put,
  FxQuotesPost: fxQuotes.post,
  validationFail: OpenapiBackend.validationFail,
  notFound: OpenapiBackend.notFound,
  methodNotAllowed: OpenapiBackend.methodNotAllowed
}
