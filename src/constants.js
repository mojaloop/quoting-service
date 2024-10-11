const { API_TYPES } = require('@mojaloop/central-services-shared').Util.Hapi

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
// todo: think, if it's better to use all headers keys in lowercase

const ERROR_MESSAGES = {
  CALLBACK_UNSUCCESSFUL_HTTP_RESPONSE: 'Got non-success response sending error callback',
  CALLBACK_NETWORK_ERROR: 'network error in sendErrorCallback',
  NO_FX_CALLBACK_ENDPOINT: (fspiopSource, conversionRequestId) => `No FSPIOP_CALLBACK_URL_FX_QUOTES endpoint found for FSP '${fspiopSource}' while processing fxquote ${conversionRequestId}`
}

const PAYLOAD_STORAGES = Object.freeze({
  none: '',
  kafka: 'kafka',
  redis: 'redis'
})

module.exports = {
  API_TYPES,
  RESOURCES,
  HEADERS,
  ERROR_MESSAGES,
  PAYLOAD_STORAGES
}
