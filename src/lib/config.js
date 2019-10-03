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

 * James Bush <james.bush@modusbox.com
 * Henk Kodde <henk.kodde@modusbox.com>
 * Georgi Georgiev <georgi.georgiev@modusbox.com>
 --------------
 ******/

const RC = require('rc')('QUOTE', require('../../config/default.json'))

/**
 * Loads config from environment
 */
class Config {
  constructor () {
    // load config from environment (or use sensible defaults)
    this.listenAddress = RC.LISTEN_ADDRESS
    this.listenPort = RC.PORT
    this.simpleRoutingMode = RC.SIMPLE_ROUTING_MODE
    this.amount = {
      precision: RC.AMOUNT.PRECISION ? RC.AMOUNT.PRECISION : 18,
      scale: RC.AMOUNT.SCALE ? RC.AMOUNT.SCALE : 4
    }
    this.database = {
      client: RC.DATABASE.DIALECT,
      connection: {
        host: RC.DATABASE.HOST.replace(/\/$/, ''),
        port: RC.DATABASE.PORT,
        user: RC.DATABASE.USER,
        password: RC.DATABASE.PASSWORD,
        database: RC.DATABASE.SCHEMA
      },
      pool: {
        // minimum size
        min: RC.DATABASE.POOL_MINSIZE ? RC.DATABASE.POOL_MINSIZE : 2,

        // maximum size
        max: RC.DATABASE.POOL_MAXSIZE ? RC.DATABASE.POOL_MAXSIZE : 10,
        // acquire promises are rejected after this many milliseconds
        // if a resource cannot be acquired
        acquireTimeoutMillis: RC.DATABASE.ACQUIRETIMEOUTMILLIS ? RC.DATABASE.ACQUIRETIMEOUTMILLIS : 30000,

        // create operations are cancelled after this many milliseconds
        // if a resource cannot be acquired
        createTimeoutMillis: RC.DATABASE.CREATETIMEOUTMILLIS ? RC.DATABASE.CREATETIMEOUTMILLIS : 3000,

        // destroy operations are awaited for at most this many milliseconds
        // new resources will be created after this timeout
        destroyTimeoutMillis: RC.DATABASE.DESTROYTIMEOUTMILLIS ? RC.DATABASE.DESTROYTIMEOUTMILLIS : 5000,

        // free resouces are destroyed after this many milliseconds
        idleTimeoutMillis: RC.DATABASE.IDLETIMEOUTMILLIS ? RC.DATABASE.IDLETIMEOUTMILLIS : 30000,

        // how often to check for idle resources to destroy
        reapIntervalMillis: RC.DATABASE.REAPINTERVALMILLIS ? RC.DATABASE.REAPINTERVALMILLIS : 1000,

        // long long to idle after failed create before trying again
        createRetryIntervalMillis: RC.DATABASE.CREATERETRYINTERVALMILLIS ? RC.DATABASE.CREATERETRYINTERVALMILLIS : 200
        // ping: function (conn, cb) { conn.query('SELECT 1', cb) }
      },
      debug: RC.DATABASE.DEBUG ? RC.DATABASE.DEBUG : false
    }
  }
}

module.exports = Config
