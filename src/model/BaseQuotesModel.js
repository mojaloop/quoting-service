/*****
 License
 --------------
 Copyright © 2020-2025 Mojaloop Foundation
 The Mojaloop files are made available by the Mojaloop Foundation under the Apache License, Version 2.0 (the "License") and you may not use these files except in compliance with the License. You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, the Mojaloop files are distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.

 Contributors
 --------------
 This is the official list of the Mojaloop project contributors for this file.
 Names of the original copyright holders (individuals or organizations)
 should be listed with a '*' in the first column. People who have
 contributed from an organization can be listed under the organization
 that actually holds the copyright for their contributions (see the
 Mojaloop Foundation for an example). Those individuals should have
 their names indented and be marked with a '-'. Email address can be added
 optionally within square brackets <email>.

 * Mojaloop Foundation
 * Eugen Klymniuk <eugen.klymniuk@infitx.com>

 --------------
 ******/

const Metrics = require('@mojaloop/central-services-metrics')
const EventSdk = require('@mojaloop/event-sdk')
const { Enum, Util } = require('@mojaloop/central-services-shared')
const { RESOURCES } = require('../constants')

/**
 * @typedef {Object} QuotesDeps
 * @prop {Object} db
 * @prop {Object} proxyClient
 * @prop {string} requestId
 * @prop {Object} envConfig
 * @prop {JwsSigner} JwsSigner
 * @prop {Object} httpRequest
 * @prop {Object} libUtil
 * @prop {Object} log
 */

class BaseQuotesModel {
  /** @param {QuotesDeps} deps - The dependencies required by the class instance. */
  constructor (deps) {
    this.db = deps.db
    this.proxyClient = deps.proxyClient
    this.requestId = deps.requestId
    this.JwsSigner = deps.JwsSigner // todo: use factory
    this.envConfig = deps.envConfig
    this.httpRequest = deps.httpRequest // todo: QuotesModel doesn't use httpRequest
    this.libUtil = deps.libUtil
    this.log = deps.log.child({
      component: this.constructor.name,
      requestId: deps.requestId
    })
    this.#initErrorCounter()
  }

  makeErrorCallbackHeaders ({ modifyHeaders, headers, fspiopSource, fspiopUri, resource = RESOURCES.quotes }) {
    const { envConfig } = this
    let fromSwitchHeaders
    // modify/set the headers only in case it is explicitly requested to do so
    // as this part needs to cover two different cases:
    // 1. (do not modify them) when the Switch needs to relay an error, e.g. from a DFSP to another
    // 2. (modify/set them) when the Switch needs to send errors that are originating in the Switch, e.g. to send an error back to the caller
    if (modifyHeaders === true) {
      // Should not forward 'fspiop-signature' header for switch generated messages
      delete headers['fspiop-signature']
      fromSwitchHeaders = Object.assign({}, headers, {
        'fspiop-destination': fspiopSource,
        'fspiop-source': envConfig.hubName,
        'fspiop-http-method': Enum.Http.RestMethods.PUT,
        'fspiop-uri': fspiopUri
      })
    } else {
      fromSwitchHeaders = Object.assign({}, headers)
    }

    // JWS Signer expects headers in lowercase
    let formattedHeaders
    if (envConfig.jws?.jwsSign && fromSwitchHeaders['fspiop-source'] === envConfig.jws.fspiopSourceToSign) {
      formattedHeaders = this.libUtil.generateRequestHeadersForJWS(fromSwitchHeaders, envConfig.protocolVersions, true, resource)
    } else {
      formattedHeaders = this.libUtil.generateRequestHeaders(fromSwitchHeaders, envConfig.protocolVersions, true, resource, null)
    }

    return formattedHeaders
  }

  addFspiopSignatureHeader (opts) {
    const { jws } = this.envConfig
    // If JWS is enabled and the 'fspiop-source' matches the configured jws header value (i.e. the hubName)
    // that means it's a switch generated message and we need to sign it
    if (!opts.headers['fspiop-signature'] &&
      jws?.jwsSign &&
      opts.headers['fspiop-source'] === jws.fspiopSourceToSign
    ) {
      this.log.verbose('Getting the JWS Signer to sign the switch generated message')
      const logger = this.log.child()
      logger.log = logger.info
      const jwsSigner = new this.JwsSigner({
        logger,
        signingKey: jws.jwsSigningKey
      })
      opts.headers['fspiop-signature'] = jwsSigner.getSignature(opts)
    }
  }

  injectSpanContext (span, requestOpts, operationName, tags = {}) {
    requestOpts = span.injectContextToHttpRequest(requestOpts)
    const { data, ...rest } = requestOpts
    const operation = Enum.Tags.QueryTags.operation[operationName]

    const queryTags = Util.EventFramework.Tags.getQueryTags(
      Enum.Tags.QueryTags.serviceName.quotingServiceHandler,
      Enum.Tags.QueryTags.auditType.transactionFlow,
      Enum.Tags.QueryTags.contentType.httpRequest,
      operation,
      {
        httpMethod: requestOpts.method,
        httpUrl: requestOpts.url,
        ...tags
      }
    )
    this.log.debug('injectSpanContext queryTags:', { operation, queryTags })
    span.setTags(queryTags)
    span.audit({ ...rest, payload: data }, EventSdk.AuditEventAction.egress)

    return requestOpts
  }

  #initErrorCounter () {
    try {
      if (!this.envConfig.instrumentationMetricsDisabled) {
        this.errorCounter = Metrics.getCounter('errorCount')
      }
    } catch (err) {
      this.log.error(`error initializing metrics in ${this.constructor.name}: `, err)
    }
  }
}

module.exports = BaseQuotesModel
