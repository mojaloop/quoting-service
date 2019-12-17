// (C)2018 ModusBox Inc.
/*****
 License
 --------------
 Copyright © 2017 Bill & Melinda Gates Foundation
 The Mojaloop files are made available by the Bill & Melinda Gates Foundation under the Apache License, Version 2.0 (the "License") and you may not use these files except in compliance with the License. You may obtain a copy of the License at
 http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, the Mojaloop files are distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.

 Initial contribution
 --------------------
 The initial functionality and code base was donated by the Mowali project working in conjunction with MTN and Orange as service provides.
 * Project: Mowali

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

 * Henk Kodde <henk.kodde@modusbox.com>
 * Georgi Georgiev <georgi.georgiev@modusbox.com>
 --------------
 ******/
// Ignore coverage for this file as it is only a mock implementation for now
/* istanbul ignore file */

'use strict'
var Mockgen = require('../../../test/util/mockgen.js')
/**
 * Operations on /quotes/{id}
 */
module.exports = {
  /**
     * summary: QuotesById
     * description: The HTTP request GET /quotes/&lt;id&gt; is used to get information regarding an earlier created or requested quote. The &lt;id&gt; in the URI should contain the quoteId that was used for the creation of the quote.
     * parameters: Accept
     * produces: application/json
     * responses: 202, 400, 401, 403, 404, 405, 406, 501, 503
     * operationId: QuotesById
     */
  get: {
    202: function (req, res, callback) {
      /**
             * Using mock data generator module.
             * Replace this by actual data for the api.
             */
      Mockgen().responses({
        path: '/quotes/{id}',
        operation: 'get',
        response: '202'
      }, callback)
    },
    400: function (req, res, callback) {
      /**
             * Using mock data generator module.
             * Replace this by actual data for the api.
             */
      Mockgen().responses({
        path: '/quotes/{id}',
        operation: 'get',
        response: '400'
      }, callback)
    },
    401: function (req, res, callback) {
      /**
             * Using mock data generator module.
             * Replace this by actual data for the api.
             */
      Mockgen().responses({
        path: '/quotes/{id}',
        operation: 'get',
        response: '401'
      }, callback)
    },
    403: function (req, res, callback) {
      /**
             * Using mock data generator module.
             * Replace this by actual data for the api.
             */
      Mockgen().responses({
        path: '/quotes/{id}',
        operation: 'get',
        response: '403'
      }, callback)
    },
    404: function (req, res, callback) {
      /**
             * Using mock data generator module.
             * Replace this by actual data for the api.
             */
      Mockgen().responses({
        path: '/quotes/{id}',
        operation: 'get',
        response: '404'
      }, callback)
    },
    405: function (req, res, callback) {
      /**
             * Using mock data generator module.
             * Replace this by actual data for the api.
             */
      Mockgen().responses({
        path: '/quotes/{id}',
        operation: 'get',
        response: '405'
      }, callback)
    },
    406: function (req, res, callback) {
      /**
             * Using mock data generator module.
             * Replace this by actual data for the api.
             */
      Mockgen().responses({
        path: '/quotes/{id}',
        operation: 'get',
        response: '406'
      }, callback)
    },
    501: function (req, res, callback) {
      /**
             * Using mock data generator module.
             * Replace this by actual data for the api.
             */
      Mockgen().responses({
        path: '/quotes/{id}',
        operation: 'get',
        response: '501'
      }, callback)
    },
    503: function (req, res, callback) {
      /**
             * Using mock data generator module.
             * Replace this by actual data for the api.
             */
      Mockgen().responses({
        path: '/quotes/{id}',
        operation: 'get',
        response: '503'
      }, callback)
    }
  },
  /**
     * summary: QuotesById
     * description: The callback PUT /quotes/&lt;id&gt; is used to inform the client of a requested or created quote. The &lt;id&gt; in the URI should contain the quoteId that was used for the creation of the quote, or the &lt;id&gt; that was used in the GET /quotes/&lt;id&gt;GET /quotes/&lt;id&gt;.
     * parameters: body, Content-Length
     * produces: application/json
     * responses: 200, 400, 401, 403, 404, 405, 406, 501, 503
     * operationId: QuotesById1
     */
  put: {
    200: function (req, res, callback) {
      /**
             * Using mock data generator module.
             * Replace this by actual data for the api.
             */
      Mockgen().responses({
        path: '/quotes/{id}',
        operation: 'put',
        response: '200'
      }, callback)
    },
    400: function (req, res, callback) {
      /**
             * Using mock data generator module.
             * Replace this by actual data for the api.
             */
      Mockgen().responses({
        path: '/quotes/{id}',
        operation: 'put',
        response: '400'
      }, callback)
    },
    401: function (req, res, callback) {
      /**
             * Using mock data generator module.
             * Replace this by actual data for the api.
             */
      Mockgen().responses({
        path: '/quotes/{id}',
        operation: 'put',
        response: '401'
      }, callback)
    },
    403: function (req, res, callback) {
      /**
             * Using mock data generator module.
             * Replace this by actual data for the api.
             */
      Mockgen().responses({
        path: '/quotes/{id}',
        operation: 'put',
        response: '403'
      }, callback)
    },
    404: function (req, res, callback) {
      /**
             * Using mock data generator module.
             * Replace this by actual data for the api.
             */
      Mockgen().responses({
        path: '/quotes/{id}',
        operation: 'put',
        response: '404'
      }, callback)
    },
    405: function (req, res, callback) {
      /**
             * Using mock data generator module.
             * Replace this by actual data for the api.
             */
      Mockgen().responses({
        path: '/quotes/{id}',
        operation: 'put',
        response: '405'
      }, callback)
    },
    406: function (req, res, callback) {
      /**
             * Using mock data generator module.
             * Replace this by actual data for the api.
             */
      Mockgen().responses({
        path: '/quotes/{id}',
        operation: 'put',
        response: '406'
      }, callback)
    },
    501: function (req, res, callback) {
      /**
             * Using mock data generator module.
             * Replace this by actual data for the api.
             */
      Mockgen().responses({
        path: '/quotes/{id}',
        operation: 'put',
        response: '501'
      }, callback)
    },
    503: function (req, res, callback) {
      /**
             * Using mock data generator module.
             * Replace this by actual data for the api.
             */
      Mockgen().responses({
        path: '/quotes/{id}',
        operation: 'put',
        response: '503'
      }, callback)
    }
  }
}
