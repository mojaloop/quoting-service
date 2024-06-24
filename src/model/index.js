const QuotesModel = require('./quotes')
const BulkQuotesModel = require('./bulkQuotes')
const FxQuotesModel = require('./fxQuotes')

// todo: get models only through these factories
module.exports = db => ({
  quotesModelFactory: (requestId) => new QuotesModel({ db, requestId }),
  bulkQuotesModelFactory: (requestId) => new BulkQuotesModel({ db, requestId }),
  fxQuotesModelFactory: (requestId) => new FxQuotesModel({ db, requestId })
})
