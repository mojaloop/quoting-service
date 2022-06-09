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

 * ModusBox
 - Georgi Georgiev <georgi.georgiev@modusbox.com>
 - Henk Kodde <henk.kodde@modusbox.com>
 - Matt Kingston <matt.kingston@modusbox.com>
 - Vassilis Barzokas <vassilis.barzokas@modusbox.com>
 --------------
 ******/

'use strict'
const Path = require('path')
const Hapi = require('@hapi/hapi')
const Inert = require('@hapi/inert')
const Vision = require('@hapi/vision')
const Good = require('@hapi/good')
const Blipp = require('blipp')
const ErrorHandler = require('@mojaloop/central-services-error-handling')
const CentralServices = require('@mojaloop/central-services-shared')
const HeaderValidation = require('@mojaloop/central-services-shared').Util.Hapi.FSPIOPHeaderValidation
const OpenapiBackend = require('@mojaloop/central-services-shared').Util.OpenapiBackend
const OpenapiBackendValidator = require('@mojaloop/central-services-shared').Util.Hapi.OpenapiBackendValidator
const Logger = require('@mojaloop/central-services-logger')
const APIDocumentation = require('@mojaloop/central-services-shared').Util.Hapi.APIDocumentation

const { getStackOrInspect, failActionHandler } = require('../src/lib/util')
const Config = require('./lib/config.js')
const Database = require('./data/cachedDatabase')
const Handlers = require('./handlers')
const Routes = require('./handlers/routes')

const OpenAPISpecPath = Path.resolve(__dirname, './interface/QuotingService-swagger.yaml')

/**
 * Initializes a database connection pool
 */
const initDb = function (config) {
  // try open a db connection pool
  const database = new Database(config)
  return database.connect()
}

/**
 * Initializes a Hapi server
 *
 * @param db - database instance
 * @param config - configuration object
 */
const initServer = async function (db, config) {
  // init a server
  const server = new Hapi.Server({
    address: config.listenAddress,
    host: config.listenAddress,
    port: config.listenPort,
    routes: {
      validate: {
        failAction: failActionHandler
      }
    }
  })

  // put the database pool somewhere handlers can use it
  server.app.database = db

  if (config.apiDocumentationEndpoints) {
    await server.register({
      plugin: APIDocumentation,
      options: {
        documentPath: OpenAPISpecPath
      }
    })
  }

  const api = await OpenapiBackend.initialise(OpenAPISpecPath, Handlers)
  await server.register(OpenapiBackendValidator)
  await server.register({
    plugin: {
      name: 'openapi',
      version: '1.0.0',
      multiple: true,
      register: function (server, options) {
        server.expose('openapi', options.openapi)
      }
    },
    options: {
      openapi: api
    }
  })

  // Helper to construct FSPIOPHeaderValidation option configuration
  const getOptionsForFSPIOPHeaderValidation = () => {
    // configure supported FSPIOP Content-Type versions
    const supportedProtocolContentVersions = []
    for (const version of config.protocolVersions.CONTENT.VALIDATELIST) {
      supportedProtocolContentVersions.push(version.toString())
    }

    // configure supported FSPIOP Accept version
    const supportedProtocolAcceptVersions = []
    for (const version of config.protocolVersions.ACCEPT.VALIDATELIST) {
      supportedProtocolAcceptVersions.push(version.toString())
    }

    // configure FSPIOP resources
    const resources = [
      'quotes'
    ]

    // return FSPIOPHeaderValidation plugin options
    return {
      resources,
      supportedProtocolContentVersions,
      supportedProtocolAcceptVersions
    }
  }

  // add plugins to the server
  await server.register([
    {
      plugin: Good,
      options: {
        ops: {
          interval: 1000
        }
        // TODO: hapi good is deprecated per https://www.npmjs.com/package/@hapi/good/v/9.0.1 and is
        // suggesting we consider another plugin from https://hapi.dev/plugins/#logging
        // reporters: {
        //   console: [{
        //     module: 'good-squeeze',
        //     name: 'Squeeze',
        //     args: [{ log: '*', response: '*' }]
        //   }, {
        //     module: 'good-console',
        //     args: [{ format: '' }]
        //   }, 'stdout']
        // }
      }
    },
    {
      plugin: HeaderValidation,
      options: getOptionsForFSPIOPHeaderValidation()
    },
    Inert,
    Vision,
    Blipp,
    ErrorHandler,
    CentralServices.Util.Hapi.HapiEventPlugin
  ])

  server.route(Routes.APIRoutes(api))
  // TODO: follow instructions https://github.com/anttiviljami/openapi-backend/blob/master/DOCS.md#postresponsehandler-handler

  // start the server
  await server.start()

  return server
}

// load config
const config = new Config()

/**
 * @function start
 * @description Starts the web server
 */
async function start () {
  // initialise database connection pool and start the api server
  return initDb(config)
    .then(db => initServer(db, config))
    .then(server => {
      // Ignore coverage here as simulating `process.on('SIGTERM'...)` kills jest
      /* istanbul ignore next */
      process.on('SIGTERM', () => {
        server.log(['info'], 'Received SIGTERM, closing server...')
        server.stop({ timeout: 10000 })
          .then(err => {
            Logger.warn(`server stopped. ${err ? (getStackOrInspect(err)) : ''}`)
            process.exit((err) ? 1 : 0)
          })
      })
      server.log(['info'], `Server running on ${server.info.uri}`)
      return server
      // eslint-disable-next-line no-unused-vars
    }).catch(err => {
      Logger.error(`Error initializing server: ${getStackOrInspect(err)}`)
    })
}

module.exports = start
