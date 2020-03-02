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

const Hapi = require('@hapi/hapi')
const HapiOpenAPI = require('hapi-openapi')
const Path = require('path')
const Good = require('@hapi/good')
const Blipp = require('blipp')
const ErrorHandler = require('@mojaloop/central-services-error-handling')
const CentralServices = require('@mojaloop/central-services-shared')
const HeaderValidation = require('@mojaloop/central-services-shared').Util.Hapi.FSPIOPHeaderValidation
const Logger = require('@mojaloop/central-services-logger')
const { getStackOrInspect, failActionHandler } = require('../src/lib/util')

const Config = require('./lib/config.js')
const Database = require('./data/cachedDatabase')

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

  // add plugins to the server
  await server.register([
    {
      plugin: HapiOpenAPI,
      options: {
        api: Path.resolve('./src/interface/swagger.json'),
        handlers: Path.resolve('./src/handlers')
      }
    },
    {
      plugin: Good,
      options: {
        ops: {
          interval: 1000
        },
        reporters: {
          console: [{
            module: 'good-squeeze',
            name: 'Squeeze',
            args: [{ log: '*', response: '*' }]
          }, {
            module: 'good-console',
            args: [{ format: '' }]
          }, 'stdout']
        }
      }
    },
    {
      plugin: HeaderValidation
    },
    Blipp,
    ErrorHandler,
    CentralServices.Util.Hapi.HapiEventPlugin
  ])

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

      server.plugins.openapi.setHost(server.info.host + ':' + server.info.port)
      server.log(['info'], `Server running on ${server.info.uri}`)
    // eslint-disable-next-line no-unused-vars
    }).catch(err => {
      Logger.error(`Error initializing server: ${getStackOrInspect(err)}`)
    })
}

module.exports = start
