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
 - Name Surname <name.surname@mojaloop.io>
*****/

/* eslint-disable space-before-function-paren */
const axios = require('axios')
const { RESOURCES } = require('../../src/constants')
const { logger, TransformFacades } = require('../../src/lib')
const mocks = require('../mocks')

axios.defaults.headers.common = {}
TransformFacades.FSPIOP.configure({ isTestingMode: true, logger })

class QSClient {
  constructor ({
    host = 'localhost',
    port
  } = {}) {
    this.baseUrl = `http://${host}:${port}`
    this.log = logger.child(QSClient.constructor.name)
  }

  async postIsoQuotes(params = {}) {
    const url = `${this.baseUrl}/${RESOURCES.quotes}`
    const headers = mocks.headersDto({
      resource: RESOURCES.quotes,
      source: params.from,
      destination: params.to,
      isIsoApi: true
    })
    const fspiopPayload = mocks.postQuotesPayloadDto(params)
    const isoPayload = await TransformFacades.FSPIOP.quotes.post({ body: fspiopPayload })

    return axios.request({
      url,
      method: 'POST',
      headers,
      data: isoPayload.body
    })
  }

  // async putIsoQuotes(id, fspiopPayload, from, to) {
  //   const url = `${this.baseUrl}/${RESOURCES.quotes}/${id}`
  //   const headers = QSClient.makeHeaders({ from, to }, true)
  //   const isoPayload = await TransformFacades.FSPIOP.quotes.put({ body: fspiopPayload })
  //
  //   return axios.request({
  //     url,
  //     method: 'PUT',
  //     headers,
  //     data: isoPayload.body
  //   })
  // }

  async putErrorQuotes(id, payload, from, to) {
    const url = `${this.baseUrl}/${RESOURCES.quotes}/${id}/error`
    const headers = mocks.headersDto({
      resource: RESOURCES.quotes,
      source: from,
      destination: to,
      isIsoApi: true
    })

    return axios.request({
      url,
      method: 'PUT',
      headers,
      data: payload
    })
  }

  async putErrorIsoQuotes(id, fspiopPayload, from, to) {
    const url = `${this.baseUrl}/${RESOURCES.quotes}/${id}/error`
    const headers = mocks.headersDto({
      resource: RESOURCES.quotes,
      source: from,
      destination: to,
      isIsoApi: true
    })
    const isoPayload = await TransformFacades.FSPIOP.quotes.putError({ body: fspiopPayload })

    return axios.request({
      url,
      method: 'PUT',
      headers,
      data: isoPayload.body
    })
  }

  async getIsoQuotes(params) {
    const url = `${this.baseUrl}/${RESOURCES.quotes}/${params.quoteId}`
    const headers = mocks.headersDto({
      resource: RESOURCES.quotes,
      source: params.from,
      destination: params.to,
      isIsoApi: true
    })

    return axios.request({
      url,
      method: 'GET',
      headers
    })
  }

  async postIsoFxQuotes(params = {}) {
    const url = `${this.baseUrl}/${RESOURCES.fxQuotes}`
    const headers = mocks.headersDto({
      resource: RESOURCES.fxQuotes,
      source: params.initiatingFsp,
      destination: params.counterPartyFsp,
      isIsoApi: true
    })
    const fspiopPayload = mocks.postFxQuotesPayloadDto(params)
    const isoPayload = await TransformFacades.FSPIOP.fxQuotes.post({ body: fspiopPayload })

    return axios.request({
      url,
      method: 'POST',
      headers,
      data: isoPayload.body
    })
  }

  async putErrorIsoFxQuotes(id, fspiopPayload, from, to) {
    const url = `${this.baseUrl}/${RESOURCES.fxQuotes}/${id}/error`
    const headers = mocks.headersDto({
      resource: RESOURCES.fxQuotes,
      source: from,
      destination: to,
      isIsoApi: true
    })
    const isoPayload = await TransformFacades.FSPIOP.fxQuotes.putError({ body: fspiopPayload })

    return axios.request({
      url,
      method: 'PUT',
      headers,
      data: isoPayload.body
    })
  }

  async putErrorFxQuotes(id, payload, from, to) {
    const url = `${this.baseUrl}/${RESOURCES.fxQuotes}/${id}/error`
    const headers = mocks.headersDto({
      resource: RESOURCES.fxQuotes,
      source: from,
      destination: to,
      isIsoApi: true
    })

    return axios.request({
      url,
      method: 'PUT',
      headers,
      data: payload
    })
  }
}

module.exports = QSClient
