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
 - Steven Oderayi <steven.oderayi@modusbox.com>
 --------------
 ******/

'use strict'

/**
 * Request handler
 *
 * @param {object} api OpenAPIBackend instance
 * @param {object} req Request
 * @param {object} h   Response handle
 */
const handleRequest = (api, req, h) => api.handleRequest(
  {
    method: req.method,
    path: req.path,
    body: req.payload,
    query: req.query,
    headers: req.headers
  }, req, h)

/**
 * Core API Routes
 *
 * @param {object} api OpenAPIBackend instance
 */
const APIRoutes = (api) => [
  {
    method: 'PUT',
    path: '/quotes/{id}/error',
    handler: (req, h) => handleRequest(api, req, h),
    config: {
      tags: ['api', 'quotes', 'sampled'],
      description: 'PUT Quote error by ID'
    }
  },
  {
    method: 'GET',
    path: '/quotes/{id}',
    handler: (req, h) => handleRequest(api, req, h),
    config: {
      tags: ['api', 'quotes', 'sampled'],
      description: 'GET Quote by ID'
    }
  },
  {
    method: 'PUT',
    path: '/quotes/{id}',
    handler: (req, h) => handleRequest(api, req, h),
    config: {
      tags: ['api', 'quotes', 'sampled'],
      description: 'PUT Quote error by ID'
    }
  },
  {
    method: 'POST',
    path: '/quotes',
    handler: (req, h) => handleRequest(api, req, h),
    config: {
      tags: ['api', 'quotes', 'sampled'],
      description: 'POST Quote'
    }
  },
  {
    method: 'PUT',
    path: '/bulkQuotes/{id}/error',
    handler: (req, h) => handleRequest(api, req, h),
    config: {
      tags: ['api', 'bulkQuotes', 'sampled'],
      description: 'PUT Bulk Quotes error by ID'
    }
  },
  {
    method: 'GET',
    path: '/bulkQuotes/{id}',
    handler: (req, h) => handleRequest(api, req, h),
    config: {
      tags: ['api', 'bulkQuotes', 'sampled'],
      description: 'GET Bulk Quotes by ID'
    }
  },
  {
    method: 'PUT',
    path: '/bulkQuotes/{id}',
    handler: (req, h) => handleRequest(api, req, h),
    config: {
      tags: ['api', 'bulkQuotes', 'sampled'],
      description: 'PUT Bulk Quotes by ID'
    }
  },
  {
    method: 'POST',
    path: '/bulkQuotes',
    handler: (req, h) => handleRequest(api, req, h),
    config: {
      tags: ['api', 'bulkQuotes', 'sampled'],
      description: 'POST Bulk Quotes'
    }
  },
  {
    method: 'PUT',
    path: '/fxQuotes/{id}/error',
    handler: (req, h) => handleRequest(api, req, h),
    config: {
      tags: ['api', 'fxQuotes', 'sampled'],
      description: 'PUT FX Quotes error by ID'
    }
  },
  {
    method: 'GET',
    path: '/fxQuotes/{id}',
    handler: (req, h) => handleRequest(api, req, h),
    config: {
      tags: ['api', 'fxQuotes', 'sampled'],
      description: 'GET FX Quotes by ID'
    }
  },
  {
    method: 'PUT',
    path: '/fxQuotes/{id}',
    handler: (req, h) => handleRequest(api, req, h),
    config: {
      tags: ['api', 'fxQuotes', 'sampled'],
      description: 'PUT FX Quotes by ID'
    }
  },
  {
    method: 'POST',
    path: '/fxQuotes',
    handler: (req, h) => handleRequest(api, req, h),
    config: {
      tags: ['api', 'fxQuotes', 'sampled'],
      description: 'POST FX Quotes'
    }
  },
  {
    method: 'GET',
    path: '/health',
    handler: (req, h) => handleRequest(api, req, h),
    config: {
      tags: ['api', 'health'],
      description: 'GET health'
    }
  },
  {
    method: 'GET',
    path: '/metrics',
    handler: (req, h) => handleRequest(api, req, h),
    config: {
      tags: ['api', 'metrics'],
      description: 'Prometheus metrics endpoint',
      id: 'metrics'
    }
  }
]

module.exports = { APIRoutes }
