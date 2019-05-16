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
 * Original Author: James Bush

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

'use strict'

const Test = require('tape')
const Hapi = require('hapi')
const HapiOpenAPI = require('hapi-openapi')
const Path = require('path')
const Mockgen = require('../data/mockgen.js')

/**
 * Test for /bulkQuotes
 */
Test('/bulkQuotes', function (t) {
  /**
     * summary: BulkQuotes
     * description: The HTTP request POST /bulkQuotes is used to request the creation of a bulk quote for the provided financial transactions in the server.
     * parameters: body, Accept, Content-Length, Content-Type, Date, X-Forwarded-For, FSPIOP-Source, FSPIOP-Destination, FSPIOP-Encryption, FSPIOP-Signature, FSPIOP-URI, FSPIOP-HTTP-Method
     * produces: application/json
     * responses: 202, 400, 401, 403, 404, 405, 406, 501, 503
     */
  t.test('test BulkQuotes post operation', async function (t) {
    const server = new Hapi.Server()

    await server.register({
      plugin: HapiOpenAPI,
      options: {
        api: Path.resolve(__dirname, '../src/interface/swagger.json'),
        handlers: Path.join(__dirname, '../handlers'),
        outputvalidation: true
      }
    })

    const requests = new Promise((resolve, reject) => {
      Mockgen().requests({
        path: '/bulkQuotes',
        operation: 'post'
      }, function (error, mock) {
        return error ? reject(error) : resolve(mock)
      })
    })

    const mock = await requests

    t.ok(mock)
    t.ok(mock.request)
    // Get the resolved path from mock request
    // Mock request Path templates({}) are resolved using path parameters
    const options = {
      method: 'post',
      url: '/fsp' + mock.request.path
    }
    if (mock.request.body) {
      // Send the request body
      options.payload = mock.request.body
    } else if (mock.request.formData) {
      // Send the request form data
      options.payload = mock.request.formData
      // Set the Content-Type as application/x-www-form-urlencoded
      options.headers = options.headers || {}
      options.headers['Content-Type'] = 'application/x-www-form-urlencoded'
    }
    // If headers are present, set the headers.
    if (mock.request.headers && mock.request.headers.length > 0) {
      options.headers = mock.request.headers
    }

    const response = await server.inject(options)

    t.equal(response.statusCode, 202, 'Ok response status')
    t.end()
  })
})
