'use strict'

const Config = require('../src/lib/config')

module.exports = {
  client: Config.DATABASE_DIALECT,
  version: '5.5',
  listenAddress: Config.LISTEN_ADDRESS,
  host: Config.DATABASE_HOST,
  port: Config.DATABASE_PORT,
  user: Config.DATABASE_USER,
  password: Config.DATABASE_PASSWORD,
  database: Config.DATABASE_SCHEMA,
  min: Config.DATABASE_POOL_MINSIZE,
  max: Config.DATABASE_POOL_MAXSIZE
}
