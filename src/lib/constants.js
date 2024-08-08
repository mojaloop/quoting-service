const ERROR_MESSAGES = {
  CALLBACK_UNSUCCESSFUL_HTTP_RESPONSE: 'Got non-success response sending error callback',
  CALLBACK_NETWORK_ERROR: 'network error in sendErrorCallback',
  NO_FX_CALLBACK_ENDPOINT: (fspiopSource, conversionRequestId) => `No FSPIOP_CALLBACK_URL_FX_QUOTES endpoint found for FSP '${fspiopSource}' while processing fxquote ${conversionRequestId}`
}

module.exports = { ERROR_MESSAGES }
