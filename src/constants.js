const RESOURCES = Object.freeze({
  quotes: 'quotes',
  fxQuotes: 'fxQuotes'
})

const HEADERS = Object.freeze({
  accept: 'Accept',
  contentType: 'Content-Type',
  date: 'Date',
  fspiopSource: 'FSPIOP-Source',
  fspiopDestination: 'FSPIOP-Destination',
  fspiopHttpMethod: 'FSPIOP-HTTP-Method',
  fspiopSignature: 'FSPIOP-Signature',
  fspiopUri: 'FSPIOP-URI'
})

const ERROR_MESSAGES = {
  CALLBACK_UNSUCCESSFUL_HTTP_RESPONSE: 'Got non-success response sending error callback',
  CALLBACK_NETWORK_ERROR: 'network error in sendErrorCallback',
  NO_FX_CALLBACK_ENDPOINT: (fspiopSource, conversionRequestId) => `No FSPIOP_CALLBACK_URL_FX_QUOTES endpoint found for FSP '${fspiopSource}' while processing fxquote ${conversionRequestId}`
}

module.exports = {
  RESOURCES,
  HEADERS,
  ERROR_MESSAGES
}
