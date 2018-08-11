'use strict';

const util = require('util');

const Hapi = require('hapi');
const HapiOpenAPI = require('hapi-openapi');
const Path = require('path');
const Good = require('good');

const Config = require('./config/config.js');
const Database = require('./data/database.js');


/**
 * Initializes a database connection pool
 */
const initDb = function(config) {
    //try open a db connection pool
    let database = new Database(config);
    return database.connect();
};


/**
 * Initializes a Hapi server
 *
 * @param db - database instance
 * @param config - configuration object
 */
const initServer = async function(db, config) {
    //init a server
    const server = new Hapi.Server({
        address: config.listenAddress,
        host: config.listenAddress,
        port: config.listenPort,
        routes: {
            validate: {
                failAction: async (request, h, err) => {
                    console.log(`request: ${util.inspect(request)}`);
                    console.log(`validation failure: ${err.stack || util.inspect(err)}`);
                    throw err;
                }
            }
        }
    });

    //put the database pool somewhere handlers can use it
    server.app.database = db;

    //add plugins to the server
    await server.register([{
        plugin: HapiOpenAPI,
        options: {
            api: Path.resolve('./config/swagger.json'),
            handlers: Path.resolve('./handlers'),
        },
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
                    module: 'good-console'
                }, 'stdout']
            }
        }
    }]);

    //add a health endpoint on /
    server.route({
        method: 'GET',
        path: '/',
        handler: (request, h) => {
            return h.response().code(200);
        }
    });

    //start the server
    await server.start();

    return server;
};


//load config
const config = new Config();

//initialise database connection pool and start the api server
initDb(config.database).then(db => {
    return initServer(db, config);
}).then(server => {
    server.plugins.openapi.setHost(server.info.host + ':' + server.info.port);
    server.log(['info'], `Server running on ${server.info.host}:${server.info.port}`);
}).catch(err => {
    console.log(`Error initializing server: ${err.stack || util.inspect(err)}`);
});
