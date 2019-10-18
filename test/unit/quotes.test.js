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

'use strict'

const ErrorHandler = require('@mojaloop/central-services-error-handling')
const Hapi = require('@hapi/hapi')
const HapiOpenAPI = require('hapi-openapi')
const Path = require('path')
const Mockgen = require('../util/mockgen.js')
const helper = require('../util/helper')

/**
 * Test for /quotes
 */
describe('/quotes', function () {
  /**
   * summary: Quotes
   * description: The HTTP request PUT /quotes/{ID}/error is used to request the creation of a quote for the provided financial transaction in the server.
   * parameters: body, Accept, Content-Length, Content-Type, Date, X-Forwarded-For, FSPIOP-Source, FSPIOP-Destination, FSPIOP-Encryption, FSPIOP-Signature, FSPIOP-URI, FSPIOP-HTTP-Method
   * produces: application/json
   * responses: 202, 400, 401, 403, 404, 405, 406, 501, 503
   */
  test('test Bulk Error by ID put operation', async () => {
    const server = new Hapi.Server()

    await server.register([{
      plugin: HapiOpenAPI,
      options: {
        api: Path.resolve(__dirname, '../../src/interface/swagger.json'),
        handlers: Path.join(__dirname, '../../src/handlers'),
        outputvalidation: true
      }
    }, ErrorHandler])

    const requests = new Promise((resolve, reject) => {
      Mockgen().requests({
        path: '/quotes/{ID}/error',
        operation: 'put'
      }, function (error, mock) {
        return error ? reject(error) : resolve(mock)
      })
    })

    const mock = await requests

    expect(mock).toBeTruthy()
    expect(mock.request).toBeTruthy()
    // Get the resolved path from mock request
    // Mock request Path templates({}) are resolved using path parameters
    const options = {
      method: 'put',
      url: mock.request.path,
      headers: helper.defaultHeaders()
    }
    if (mock.request.body) {
      // Send the request body
      options.payload = mock.request.body
    } else if (mock.request.formData) {
      // Send the request form data
      options.payload = mock.request.formData
      // Set the Content-Type as application/x-www-form-urlencoded
      options.headers = helper.defaultHeaders()
    }

    const response = await server.inject(options)

    expect(response.statusCode).toBe(200)
  })
  /**
     * summary: Quotes
     * description: The HTTP request POST /quotes is used to request the creation of a quote for the provided financial transaction in the server.
     * parameters: body, Accept, Content-Length, Content-Type, Date, X-Forwarded-For, FSPIOP-Source, FSPIOP-Destination, FSPIOP-Encryption, FSPIOP-Signature, FSPIOP-URI, FSPIOP-HTTP-Method
     * produces: application/json
     * responses: 202, 400, 401, 403, 404, 405, 406, 501, 503
     */
  test('test Quotes post operation', async () => {
    const server = new Hapi.Server()

    await server.register([{
      plugin: HapiOpenAPI,
      options: {
        api: Path.resolve(__dirname, '../../src/interface/swagger.json'),
        handlers: Path.join(__dirname, '../../src/handlers'),
        outputvalidation: true
      }
    }, ErrorHandler])

    const requests = new Promise((resolve, reject) => {
      Mockgen().requests({
        path: '/quotes',
        operation: 'post'
      }, function (error, mock) {
        return error ? reject(error) : resolve(mock)
      })
    })

    const mock = await requests

    expect(mock).toBeTruthy()
    expect(mock.request).toBeTruthy()
    // Get the resolved path from mock request
    // Mock request Path templates({}) are resolved using path parameters
    const options = {
      method: 'post',
      url: mock.request.path,
      headers: helper.defaultHeaders()
    }
    if (mock.request.body) {
      // Send the request body
      options.payload = mock.request.body
    } else if (mock.request.formData) {
      // Send the request form data
      options.payload = mock.request.formData
      // Set the Content-Type as application/x-www-form-urlencoded
      options.headers = helper.defaultHeaders()
    }

    const response = await server.inject(options)

    expect(response.statusCode).toBe(202)
  })
  /**
   * summary: Quotes
   * description: The HTTP request GET /quotes/{ID} is used to request the retrieval of a quote for the provided financial transaction in the server.
   * parameters: Accept, Content-Length, Content-Type, Date, X-Forwarded-For, FSPIOP-Source, FSPIOP-Destination, FSPIOP-Encryption, FSPIOP-Signature, FSPIOP-URI, FSPIOP-HTTP-Method
   * produces: application/json
   * responses: 202, 400, 401, 403, 404, 405, 406, 501, 503
   */
  test('test Quotes by ID get operation', async () => {
    const server = new Hapi.Server()

    await server.register([{
      plugin: HapiOpenAPI,
      options: {
        api: Path.resolve(__dirname, '../../src/interface/swagger.json'),
        handlers: Path.join(__dirname, '../../src/handlers'),
        outputvalidation: true
      }
    }, ErrorHandler])

    const requests = new Promise((resolve, reject) => {
      Mockgen().requests({
        path: '/quotes/{ID}',
        operation: 'get'
      }, function (error, mock) {
        return error ? reject(error) : resolve(mock)
      })
    })

    const mock = await requests

    expect(mock).toBeTruthy()
    expect(mock.request).toBeTruthy()
    // Get the resolved path from mock request
    // Mock request Path templates({}) are resolved using path parameters
    const options = {
      method: 'get',
      url: mock.request.path,
      headers: helper.defaultHeaders()
    }

    const response = await server.inject(options)

    expect(response.statusCode).toBe(202)
  })
  /**
   * summary: Quotes
   * description: The HTTP request PUT /quotes/{ID} is used to request the creation of a quote for the provided financial transaction in the server.
   * parameters: body, Accept, Content-Length, Content-Type, Date, X-Forwarded-For, FSPIOP-Source, FSPIOP-Destination, FSPIOP-Encryption, FSPIOP-Signature, FSPIOP-URI, FSPIOP-HTTP-Method
   * produces: application/json
   * responses: 202, 400, 401, 403, 404, 405, 406, 501, 503
   */
  test('test Quotes by ID put operation', async () => {
    const server = new Hapi.Server()

    await server.register([{
      plugin: HapiOpenAPI,
      options: {
        api: Path.resolve(__dirname, '../../src/interface/swagger.json'),
        handlers: Path.join(__dirname, '../../src/handlers'),
        outputvalidation: true
      }
    }, ErrorHandler])

    const requests = new Promise((resolve, reject) => {
      Mockgen().requests({
        path: '/quotes/{ID}',
        operation: 'put'
      }, function (error, mock) {
        return error ? reject(error) : resolve(mock)
      })
    })

    const mock = await requests

    expect(mock).toBeTruthy()
    expect(mock.request).toBeTruthy()
    // Get the resolved path from mock request
    // Mock request Path templates({}) are resolved using path parameters
    const options = {
      method: 'put',
      url: mock.request.path,
      headers: helper.defaultHeaders()
    }
    if (mock.request.body) {
      // Send the request body
      options.payload = mock.request.body
    } else if (mock.request.formData) {
      // Send the request form data
      options.payload = mock.request.formData
      // Set the Content-Type as application/x-www-form-urlencoded
      options.headers = helper.defaultHeaders()
    }

    const response = await server.inject(options)

    expect(response.statusCode).toBe(202)
  })
  /**
   * summary: Quotes
   * description: The HTTP request PUT /bulkQuotes/{ID}/error is used to request the creation of a quote for the provided financial transaction in the server.
   * parameters: body, Accept, Content-Length, Content-Type, Date, X-Forwarded-For, FSPIOP-Source, FSPIOP-Destination, FSPIOP-Encryption, FSPIOP-Signature, FSPIOP-URI, FSPIOP-HTTP-Method
   * produces: application/json
   * responses: 202, 400, 401, 403, 404, 405, 406, 501, 503
   */
  test('test Bulk Quotes Error by ID put operation', async () => {
    const server = new Hapi.Server()

    await server.register([{
      plugin: HapiOpenAPI,
      options: {
        api: Path.resolve(__dirname, '../../src/interface/swagger.json'),
        handlers: Path.join(__dirname, '../../src/handlers'),
        outputvalidation: true
      }
    }, ErrorHandler])

    const requests = new Promise((resolve, reject) => {
      Mockgen().requests({
        path: '/bulkQuotes/{ID}/error',
        operation: 'put'
      }, function (error, mock) {
        return error ? reject(error) : resolve(mock)
      })
    })

    const mock = await requests

    expect(mock).toBeTruthy()
    expect(mock.request).toBeTruthy()
    // Get the resolved path from mock request
    // Mock request Path templates({}) are resolved using path parameters
    const options = {
      method: 'put',
      url: mock.request.path,
      headers: helper.defaultHeaders()
    }
    if (mock.request.body) {
      // Send the request body
      options.payload = mock.request.body
    } else if (mock.request.formData) {
      // Send the request form data
      options.payload = mock.request.formData
      // Set the Content-Type as application/x-www-form-urlencoded
      options.headers = helper.defaultHeaders()
    }

    const response = await server.inject(options)

    expect(response.statusCode).toBe(501)
  })
  /**
   * summary: Quotes
   * description: The HTTP request GET /bulkQuotes/{ID} is used to request the retrieval of a quote for the provided financial transaction in the server.
   * parameters: Accept, Content-Length, Content-Type, Date, X-Forwarded-For, FSPIOP-Source, FSPIOP-Destination, FSPIOP-Encryption, FSPIOP-Signature, FSPIOP-URI, FSPIOP-HTTP-Method
   * produces: application/json
   * responses: 202, 400, 401, 403, 404, 405, 406, 501, 503
   */
  test('test Bulk Quotes by ID get operation', async () => {
    const server = new Hapi.Server()

    await server.register([{
      plugin: HapiOpenAPI,
      options: {
        api: Path.resolve(__dirname, '../../src/interface/swagger.json'),
        handlers: Path.join(__dirname, '../../src/handlers'),
        outputvalidation: true
      }
    }, ErrorHandler])

    const requests = new Promise((resolve, reject) => {
      Mockgen().requests({
        path: '/bulkQuotes/{ID}',
        operation: 'get'
      }, function (error, mock) {
        return error ? reject(error) : resolve(mock)
      })
    })

    const mock = await requests

    expect(mock).toBeTruthy()
    expect(mock.request).toBeTruthy()
    // Get the resolved path from mock request
    // Mock request Path templates({}) are resolved using path parameters
    const options = {
      method: 'get',
      url: mock.request.path,
      headers: helper.defaultHeaders()
    }

    const response = await server.inject(options)

    expect(response.statusCode).toBe(501)
  })
  /**
   * summary: Quotes
   * description: The HTTP request PUT /bulkQuotes{ID} is used to request the creation of a quote for the provided financial transaction in the server.
   * parameters: body, Accept, Content-Length, Content-Type, Date, X-Forwarded-For, FSPIOP-Source, FSPIOP-Destination, FSPIOP-Encryption, FSPIOP-Signature, FSPIOP-URI, FSPIOP-HTTP-Method
   * produces: application/json
   * responses: 202, 400, 401, 403, 404, 405, 406, 501, 503
   */
  test('test Bulk Quotes by ID put operation', async () => {
    const server = new Hapi.Server()

    await server.register([{
      plugin: HapiOpenAPI,
      options: {
        api: Path.resolve(__dirname, '../../src/interface/swagger.json'),
        handlers: Path.join(__dirname, '../../src/handlers'),
        outputvalidation: true
      }
    }, ErrorHandler])

    const requests = new Promise((resolve, reject) => {
      Mockgen().requests({
        path: '/bulkQuotes/{ID}',
        operation: 'put'
      }, function (error, mock) {
        return error ? reject(error) : resolve(mock)
      })
    })

    const mock = await requests

    expect(mock).toBeTruthy()
    expect(mock.request).toBeTruthy()
    // Get the resolved path from mock request
    // Mock request Path templates({}) are resolved using path parameters
    const options = {
      method: 'put',
      url: mock.request.path,
      headers: helper.defaultHeaders()
    }
    if (mock.request.body) {
      // Send the request body
      options.payload = mock.request.body
    } else if (mock.request.formData) {
      // Send the request form data
      options.payload = mock.request.formData
      // Set the Content-Type as application/x-www-form-urlencoded
      options.headers = helper.defaultHeaders()
    }

    const response = await server.inject(options)

    expect(response.statusCode).toBe(501)
  })
  /**
   * summary: Quotes
   * description: The HTTP request POST /bulkQuotes is used to request the creation of a quote for the provided financial transaction in the server.
   * parameters: body, Accept, Content-Length, Content-Type, Date, X-Forwarded-For, FSPIOP-Source, FSPIOP-Destination, FSPIOP-Encryption, FSPIOP-Signature, FSPIOP-URI, FSPIOP-HTTP-Method
   * produces: application/json
   * responses: 202, 400, 401, 403, 404, 405, 406, 501, 503
   */
  test('test Bulk Quotes post operation', async () => {
    const server = new Hapi.Server()

    await server.register([{
      plugin: HapiOpenAPI,
      options: {
        api: Path.resolve(__dirname, '../../src/interface/swagger.json'),
        handlers: Path.join(__dirname, '../../src/handlers'),
        outputvalidation: true
      }
    }, ErrorHandler])

    const requests = new Promise((resolve, reject) => {
      Mockgen().requests({
        path: '/bulkQuotes',
        operation: 'post'
      }, function (error, mock) {
        return error ? reject(error) : resolve(mock)
      })
    })

    const mock = await requests

    expect(mock).toBeTruthy()
    expect(mock.request).toBeTruthy()
    // Get the resolved path from mock request
    // Mock request Path templates({}) are resolved using path parameters
    const options = {
      method: 'post',
      url: mock.request.path,
      headers: helper.defaultHeaders()
    }
    if (mock.request.body) {
      // Send the request body
      options.payload = mock.request.body
    } else if (mock.request.formData) {
      // Send the request form data
      options.payload = mock.request.formData
      // Set the Content-Type as application/x-www-form-urlencoded
      options.headers = helper.defaultHeaders()
    }

    const response = await server.inject(options)

    expect(response.statusCode).toBe(501)
  })
  /**
   * summary: Quotes
   * description: The HTTP request GET /health is used to request the retrieval of a quote for the provided financial transaction in the server.
   * parameters: Accept, Content-Length, Content-Type, Date, X-Forwarded-For, FSPIOP-Source, FSPIOP-Destination, FSPIOP-Encryption, FSPIOP-Signature, FSPIOP-URI, FSPIOP-HTTP-Method
   * produces: application/json
   * responses: 202, 400, 401, 403, 404, 405, 406, 501, 503
   */
  test('test health get operation', async () => {
    const server = new Hapi.Server()

    await server.register([{
      plugin: HapiOpenAPI,
      options: {
        api: Path.resolve(__dirname, '../../src/interface/swagger.json'),
        handlers: Path.join(__dirname, '../../src/handlers'),
        outputvalidation: true
      }
    }, ErrorHandler])

    const requests = new Promise((resolve, reject) => {
      Mockgen().requests({
        path: '/health',
        operation: 'get'
      }, function (error, mock) {
        return error ? reject(error) : resolve(mock)
      })
    })

    const mock = await requests

    expect(mock).toBeTruthy()
    expect(mock.request).toBeTruthy()
    // Get the resolved path from mock request
    // Mock request Path templates({}) are resolved using path parameters
    const options = {
      method: 'get',
      url: mock.request.path,
      headers: helper.defaultHeaders()
    }

    const response = await server.inject(options)

    expect(response.statusCode).toBe(502)
  })
})
