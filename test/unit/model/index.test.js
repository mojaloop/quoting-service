const modelFactory = require('../../../src/model')
const QuotesModel = require('../../../src/model/quotes')
const BulkQuotesModel = require('../../../src/model/bulkQuotes')
const FxQuotesModel = require('../../../src/model/fxQuotes')

describe('modelFactory Tests -->', () => {
  it('should create models instances', () => {
    const db = {}
    const { quotesModelFactory, bulkQuotesModelFactory, fxQuotesModelFactory } = modelFactory(db)

    const quotesModel = quotesModelFactory('reqId_1')
    expect(quotesModel).toBeInstanceOf(QuotesModel)

    const bulkQuotesModel = bulkQuotesModelFactory('reqId_2')
    expect(bulkQuotesModel).toBeInstanceOf(BulkQuotesModel)

    const fxQuotesModel = fxQuotesModelFactory('reqId_3')
    expect(fxQuotesModel).toBeInstanceOf(FxQuotesModel)
  })
})
