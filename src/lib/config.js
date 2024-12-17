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

const RC = require('parse-strings-in-object')(require('rc')('QUOTE', require('../../config/default.json')))
const fs = require('fs')

const DEFAULT_PROTOCOL_VERSION = {
  CONTENT: {
    DEFAULT: '1.1',
    VALIDATELIST: [
      '1.0',
      '1.1'
    ]
  },
  ACCEPT: {
    DEFAULT: '1',
    VALIDATELIST: [
      '1',
      '1.0',
      '1.1'
    ]
  }
}

const getProtocolVersions = (defaultProtocolVersions, overrideProtocolVersions) => {
  const T_PROTOCOL_VERSION = {
    ...defaultProtocolVersions,
    ...overrideProtocolVersions
  }

  if (overrideProtocolVersions && overrideProtocolVersions.CONTENT) {
    T_PROTOCOL_VERSION.CONTENT = {
      ...defaultProtocolVersions.CONTENT,
      ...overrideProtocolVersions.CONTENT
    }
  }
  if (overrideProtocolVersions && overrideProtocolVersions.ACCEPT) {
    T_PROTOCOL_VERSION.ACCEPT = {
      ...defaultProtocolVersions.ACCEPT,
      ...overrideProtocolVersions.ACCEPT
    }
  }

  if (T_PROTOCOL_VERSION.CONTENT &&
    T_PROTOCOL_VERSION.CONTENT.VALIDATELIST &&
    (typeof T_PROTOCOL_VERSION.CONTENT.VALIDATELIST === 'string' ||
      T_PROTOCOL_VERSION.CONTENT.VALIDATELIST instanceof String)) {
    T_PROTOCOL_VERSION.CONTENT.VALIDATELIST = JSON.parse(T_PROTOCOL_VERSION.CONTENT.VALIDATELIST)
  }
  if (T_PROTOCOL_VERSION.ACCEPT &&
    T_PROTOCOL_VERSION.ACCEPT.VALIDATELIST &&
    (typeof T_PROTOCOL_VERSION.ACCEPT.VALIDATELIST === 'string' ||
      T_PROTOCOL_VERSION.ACCEPT.VALIDATELIST instanceof String)) {
    T_PROTOCOL_VERSION.ACCEPT.VALIDATELIST = JSON.parse(T_PROTOCOL_VERSION.ACCEPT.VALIDATELIST)
  }
  return T_PROTOCOL_VERSION
}

/**
 * Loads config from environment
 */
class Config {
  getFileContent (path) {
    if (!fs.existsSync(path)) {
      throw new Error(`File ${path} doesn't exist, can't enable JWS signing`)
    }
    return fs.readFileSync(path)
  }

  constructor () {
    // load config from environment (or use sensible defaults)
    this.hubName = RC.HUB_PARTICIPANT.NAME
    this.listenAddress = RC.LISTEN_ADDRESS
    this.listenPort = RC.PORT
    this.monitoringPort = RC.MONITORING_PORT
    this.simpleRoutingMode = RC.SIMPLE_ROUTING_MODE
    this.switchEndpoint = RC.SWITCH_ENDPOINT
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
        min: RC.DATABASE.POOL_MIN_SIZE,
        // maximum size
        max: RC.DATABASE.POOL_MAX_SIZE,
        // acquire promises are rejected after this many milliseconds
        // if a resource cannot be acquired
        acquireTimeoutMillis: RC.DATABASE.ACQUIRE_TIMEOUT_MILLIS,
        // create operations are cancelled after this many milliseconds
        // if a resource cannot be acquired
        createTimeoutMillis: RC.DATABASE.CREATE_TIMEOUT_MILLIS,
        // destroy operations are awaited for at most this many milliseconds
        // new resources will be created after this timeout
        destroyTimeoutMillis: RC.DATABASE.DESTROY_TIMEOUT_MILLIS,
        // free resouces are destroyed after this many milliseconds
        idleTimeoutMillis: RC.DATABASE.IDLE_TIMEOUT_MILLIS,
        // how often to check for idle resources to destroy
        reapIntervalMillis: RC.DATABASE.REAP_INTERVAL_MILLIS,
        // long long to idle after failed create before trying again
        createRetryIntervalMillis: RC.DATABASE.CREATE_RETRY_INTERVAL_MILLIS,
        // ping: function (conn, cb) { conn.query('SELECT 1', cb) }
        propagateCreateError: false
      },
      debug: RC.DATABASE.DEBUG ? RC.DATABASE.DEBUG : false
    }
    this.errorHandling = RC.ERROR_HANDLING
    this.jws = {
      jwsSign: RC.ENDPOINT_SECURITY.JWS.JWS_SIGN,
      fspiopSourceToSign: this.hubName,
      jwsSigningKeyPath: RC.ENDPOINT_SECURITY.JWS.JWS_SIGNING_KEY_PATH,
      jwsSigningKey: RC.ENDPOINT_SECURITY.JWS.JWS_SIGN ? this.getFileContent(RC.ENDPOINT_SECURITY.JWS.JWS_SIGNING_KEY_PATH) : undefined
    }
    this.kafkaConfig = RC.KAFKA
    this.apiDocumentationEndpoints = RC.API_DOCUMENTATION_ENDPOINTS || false
    this.protocolVersions = getProtocolVersions(DEFAULT_PROTOCOL_VERSION, RC.PROTOCOL_VERSIONS)
    this.instrumentationMetricsDisabled = (RC.INSTRUMENTATION.METRICS.DISABLED === true || RC.INSTRUMENTATION.METRICS.DISABLED === 'true')
    this.instrumentationMetricsLabels = RC.INSTRUMENTATION.METRICS.labels
    this.instrumentationMetricsConfig = RC.INSTRUMENTATION.METRICS.config
    this.enumDataCacheExpiresInMs = RC.CACHE.ENUM_DATA_EXPIRES_IN_MS || 4170000
    this.participantDataCacheExpiresInMs = RC.CACHE.PARTICIPANT_DATA_EXPIRES_IN_MS || 60000
    this.proxyCache = RC.PROXY_CACHE
  }
}

module.exports = Config
