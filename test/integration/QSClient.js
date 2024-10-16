/* eslint-disable space-before-function-paren */
const axios = require('axios')
const { RESOURCES } = require('../../src/constants')
const { logger, TransformFacades } = require('../../src/lib')
const mocks = require('../mocks')

axios.defaults.headers.common = {}

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

  // todo: add other methods
}

module.exports = QSClient
