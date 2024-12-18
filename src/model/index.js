const QuotesModel = require('./quotes')
const BulkQuotesModel = require('./bulkQuotes')
const FxQuotesModel = require('./fxQuotes')

module.exports = (db, proxyClient) => ({
  quotesModelFactory: (requestId) => new QuotesModel({ db, requestId, proxyClient }),
  bulkQuotesModelFactory: (requestId) => new BulkQuotesModel({ db, requestId, proxyClient }),
  fxQuotesModelFactory: (requestId) => new FxQuotesModel({ db, requestId, proxyClient })
})
