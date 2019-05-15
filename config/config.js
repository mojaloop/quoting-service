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

const util = require('util')

/**
 * Loads config from environment
 */
class Config {
  constructor () {
    // load config from environment (or use sensible defaults)
    this.listenAddress = process.env['LISTEN_ADDRESS'] || '0.0.0.0'
    this.listenPort = process.env['LISTEN_PORT'] || 3000

    this.database = {
      client: process.env['DATABASE_DIALECT'] || 'mysql',
      connection: {
        host: process.env['DATABASE_HOST'] || 'localhost',
        port: process.env['DATABASE_PORT'] || '3306',
        user: process.env['DATABASE_USER'] || 'central_ledger',
        password: process.env['DATABASE_PASSWORD'] || 'password',
        database: process.env['DATABASE_SCHEMA'] || 'central_ledger'
      },
      pool: {
        min: process.env['DATABASE_POOL_MINSIZE'] || 10,
        max: process.env['DATABASE_POOL_MAXSIZE'] || 10
      }
    }
    // eslint-disable-next-line no-console
    console.log('Config loaded: %s', util.inspect(this))
  }
}

module.exports = Config
