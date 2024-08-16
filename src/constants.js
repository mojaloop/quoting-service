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

module.exports = {
  RESOURCES,
  HEADERS
}
