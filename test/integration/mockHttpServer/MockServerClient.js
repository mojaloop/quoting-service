/* eslint-disable space-before-function-paren */
const axios = require('axios')
const { HOST, PORT, Routes } = require('./config')

class MockServerClient {
  #httpClient
  #historyUrl

  constructor (httpClient = axios) {
    this.#httpClient = httpClient
    this.#historyUrl = `http://${HOST}:${PORT}${Routes.HISTORY}`
  }

  async getHistory() {
    return this.#httpClient.get(this.#historyUrl)
  }

  async clearHistory() {
    return this.#httpClient.delete(this.#historyUrl)
  }
}

module.exports = MockServerClient
