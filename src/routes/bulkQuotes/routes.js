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
 - Name Surname <name.surname@gatesfoundation.com>

 * ModusBox
 - Rajiv Mothilal <rajiv.mothilal@modusbox.com>

 --------------
 ******/
'use strict'

const Enum = require('@mojaloop/central-services-shared').Enum
const postBulkQuotes = require('../../handlers/bulkQuotes').post
const bulkQuotesById = require('../../handlers/bulkQuotes/{id}')
const bulkQuotesByIdError = require('../../handlers/bulkQuotes/{id}/error')
const Validator = require('@mojaloop/ml-schema-validator').Validators
const Joi = require('@hapi/joi')
const tags = ['api', 'quotes', Enum.Tags.RouteTags.SAMPLED]

module.exports = [
  {
    method: Enum.Http.RestMethods.POST,
    path: '/bulkQuotes',
    handler: postBulkQuotes,
    config: {
      id: 'post_bulkQuotes',
      tags: tags,
      description: 'POST Bulk Quotes',
      validate: {
        headers: Validator.HeadersValidator.postHeadersSchema.append({
          traceparent: Joi.string().optional(),
          tracestate: Joi.string().optional()
        }).unknown(true),
        payload: Validator.QuoteValidator.postBulkQuoteSchema
      }
    }
  },
  {
    method: Enum.Http.RestMethods.GET,
    path: '/bulkQuotes/{id}',
    handler: bulkQuotesById.get,
    config: {
      id: 'get_bulk_quotes_by_id',
      tags: tags,
      description: 'Get Bulk Quotes By Id',
      validate: {
        headers: Validator.HeadersValidator.getHeadersSchema.append({
          traceparent: Joi.string().optional(),
          tracestate: Joi.string().optional()
        }).unknown(true),
        params: Joi.object({
          id: Joi.string().guid().required().description('path').label('Supply a valid bulk quote Id to continue.')
        })
      }
    }
  },
  {
    method: Enum.Http.RestMethods.PUT,
    path: '/bulkQuotes/{id}',
    handler: bulkQuotesById.put,
    config: {
      id: 'put_bulk_quotes_by_id',
      tags: tags,
      description: 'Put Bulk Quotes By Id',
      validate: {
        headers: Validator.HeadersValidator.putHeadersSchema.append({
          traceparent: Joi.string().optional(),
          tracestate: Joi.string().optional()
        }).unknown(true),
        params: Joi.object({
          id: Joi.string().guid().required().description('path').label('Supply a valid bulk quote Id to continue.')
        }),
        payload: Validator.QuoteValidator.putBulkQuoteSchema
      }
    }
  },
  {
    method: Enum.Http.RestMethods.PUT,
    path: '/bulkQuotes/{id}/error',
    handler: bulkQuotesByIdError.put,
    config: {
      id: 'put_bulk_quotes_by_id_error',
      tags: tags,
      description: 'Put Bulk Quotes By Id Error',
      validate: {
        headers: Validator.HeadersValidator.putHeadersSchema.append({
          traceparent: Joi.string().optional(),
          tracestate: Joi.string().optional()
        }).unknown(true),
        params: Joi.object({
          id: Joi.string().guid().required().description('path').label('Supply a valid quote Id to continue.')
        }),
        payload: Validator.QuoteValidator.putQuoteErrorSchema
      }
    }
  }
]
