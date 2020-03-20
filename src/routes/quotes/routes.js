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
const postQuotes = require('../../handlers/quotes').post
const quotesById = require('../../handlers/quotes/{id}')
const quotesByIdError = require('../../handlers/quotes/{id}/error')
const Validator = require('@mojaloop/ml-schema-validator').Validators
const Joi = require('@hapi/joi')
const tags = ['api', 'quotes', Enum.Tags.RouteTags.SAMPLED]

module.exports = [
  {
    method: Enum.Http.RestMethods.POST,
    path: '/quotes',
    handler: postQuotes,
    config: {
      id: 'post_quotes',
      tags: tags,
      description: 'POST Quotes',
      validate: {
        headers: Validator.HeadersValidator.postHeadersSchema.append({
          traceparent: Joi.string().optional(),
          tracestate: Joi.string().optional()
        }).unknown(true),
        payload: Validator.QuoteValidator.postQuoteSchema
      }
    }
  },
  {
    method: Enum.Http.RestMethods.GET,
    path: '/quotes/{id}',
    handler: quotesById.get,
    config: {
      id: 'get_quotes_by_id',
      tags: tags,
      description: 'Get Quotes By Id',
      validate: {
        headers: Validator.HeadersValidator.getHeadersSchema.append({
          traceparent: Joi.string().optional(),
          tracestate: Joi.string().optional()
        }).unknown(true),
        params: Joi.object({
          id: Joi.string().guid().required().description('path').label('Supply a valid quote Id to continue.')
        })
      }
    }
  },
  {
    method: Enum.Http.RestMethods.PUT,
    path: '/quotes/{id}',
    handler: quotesById.put,
    config: {
      id: 'put_quotes_by_id',
      tags: tags,
      description: 'Put Quotes By Id',
      validate: {
        headers: Validator.HeadersValidator.putHeadersSchema.append({
          traceparent: Joi.string().optional(),
          tracestate: Joi.string().optional()
        }).unknown(true),
        params: Joi.object({
          id: Joi.string().guid().required().description('path').label('Supply a valid quote Id to continue.')
        }),
        payload: Validator.QuoteValidator.putQuoteSchema
      }
    }
  },
  {
    method: Enum.Http.RestMethods.PUT,
    path: '/quotes/{id}/error',
    handler: quotesByIdError.put,
    config: {
      id: 'put_quotes_by_id_error',
      tags: tags,
      description: 'Put Quotes By Id Error',
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
