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

  // todo: add other methods

  // static makeHeaders(fspiopPayload, resource, isIsoApi = false) {
  //   return mocks.headersDto({
  //     resource,
  //     source: fspiopPayload.from,
  //     destination: fspiopPayload.to,
  //     isIsoApi
  //   })
  // }
}

module.exports = QSClient