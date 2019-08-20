'use strict'

const Hapi = require('@hapi/hapi')
const HapiOpenAPI = require('hapi-openapi')
const Path = require('path')
const Good = require('@hapi/good')
const Blipp = require('blipp')
const ErrorHandler = require('@mojaloop/central-services-error-handling')

const Config = require('./lib/config.js')
const Database = require('./data/cachedDatabase.js')

/**
 * Initializes a database connection pool
 */
const initDb = function (config) {
  // try open a db connection pool
  let database = new Database(config)
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
        failAction: async (request, h, err) => {
          // eslint-disable-next-line no-console
          // console.log(`validation failure: ${err.stack || util.inspect(err)}`)
          throw err
        }
      }
    }
  })

  // put the database pool somewhere handlers can use it
  server.app.database = db

  // add plugins to the server
  await server.register([{
    plugin: HapiOpenAPI,
    options: {
      api: Path.resolve('./src/interface/swagger.json'),
      handlers: Path.resolve('./src/handlers')
    }
  }, {
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
  Blipp,
  ErrorHandler])

  // start the server
  await server.start()

  return server
}

// load config
const config = new Config()

// initialise database connection pool and start the api server
initDb(config.database).then(db => {
  return initServer(db, config)
}).then(server => {
  process.on('SIGTERM', () => {
    server.log(['info'], 'Received SIGTERM, closing server...')
    server.stop({ timeout: 10000 }).then(err => {
      // eslint-disable-next-line no-console
      // console.log(`server stopped. ${err ? (err.stack || util.inspect(err)) : ''}`)
      process.exit((err) ? 1 : 0)
    })
  })

  server.plugins.openapi.setHost(server.info.host + ':' + server.info.port)
  server.log(['info'], `Server running on ${server.info.uri}`)
// eslint-disable-next-line no-unused-vars
}).catch(err => {
  // eslint-disable-next-line no-console
  //console.log(`Error initializing server: ${err.stack || util.inspect(err)}`)
})
