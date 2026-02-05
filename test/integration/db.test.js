/*****
 License
 --------------
 Copyright © 2020-2025 Mojaloop Foundation
 The Mojaloop files are made available by the Mojaloop Foundation under the Apache License, Version 2.0 (the "License") and you may not use these files except in compliance with the License. You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, the Mojaloop files are distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.

 Contributors
 --------------
 This is the official list of the Mojaloop project contributors for this file.
 Names of the original copyright holders (individuals or organizations)
 should be listed with a '*' in the first column. People who have
 contributed from an organization can be listed under the organization
 that actually holds the copyright for their contributions (see the
 Mojaloop Foundation for an example). Those individuals should have
 their names indented and be marked with a '-'. Email address can be added
 optionally within square brackets <email>.

 * Mojaloop Foundation
 - Name Surname <name.surname@mojaloop.io>

*****/

const MLNumber = require('@mojaloop/ml-number')
const { Producer } = require('@mojaloop/central-services-stream').Util
const Config = require('../../src/lib/config')
const dto = require('../../src/lib/dto')
const mocks = require('../mocks')
const Database = require('../../src/data/testDatabase')

const TEST_TIMEOUT = 20_000
const WAIT_TIMEOUT = 3_000

jest.setTimeout(TEST_TIMEOUT)

describe('Database Integration Tests --> ', () => {
  let db
  const config = new Config()
  const { kafkaConfig } = config

  beforeAll(async () => {
    db = new Database(config)
    await db.connect()
    const isDbOk = await db.isConnected()
    expect(isDbOk).toBe(true)
  })

  afterAll(async () => {
    await db?.disconnect()
    await Producer.disconnect()
  })

  const base64Encode = (data) => Buffer.from(data).toString('base64')
  const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms))

  const createQuote = async ({
    from = 'pinkbank',
    to = 'greenbank',
    amount = { amount: '100', currency: 'USD' },
    amountType = 'SEND'
  } = {}) => {
    const { topic, config } = kafkaConfig.PRODUCER.QUOTE.POST
    const topicConfig = dto.topicConfigDto({ topicName: topic })
    const payload = mocks.postQuotesPayloadDto({ from, to, amount, amountType })
    const message = mocks.kafkaMessagePayloadPostDto({ from, to, id: payload.quoteId, payloadBase64: base64Encode(JSON.stringify(payload)) })
    const isOk = await Producer.produceMessage(message, topicConfig, config)
    expect(isOk).toBe(true)
    return payload
  }

  describe('POST /quotes database entries --> ', () => {
    test('should create quote entry in database on POST /quotes request', async () => {
      const quotePayload = await createQuote()
      await wait(WAIT_TIMEOUT)

      const quote = await db.getQuote(quotePayload.quoteId)
      expect(quote).toBeDefined()
      expect(quote.quoteId).toBe(quotePayload.quoteId)
    })

    test('should create transaction reference in database on POST /quotes request', async () => {
      const quotePayload = await createQuote()
      await wait(WAIT_TIMEOUT)

      const txnRef = await db.getTransactionReference(quotePayload.quoteId)
      expect(txnRef).toBeDefined()
      expect(txnRef.quoteId).toBe(quotePayload.quoteId)
    })

    test('should create payer and payee quote party entries in database', async () => {
      const from = 'pinkbank'
      const to = 'greenbank'
      const quotePayload = await createQuote({ from, to })
      await wait(WAIT_TIMEOUT)

      const quoteParties = await db.getQuoteParties(quotePayload.quoteId)
      expect(quoteParties).toBeDefined()
      expect(quoteParties.length).toBe(2)

      const payer = quoteParties.find(p => p.transferParticipantRoleTypeId === 1)
      const payee = quoteParties.find(p => p.transferParticipantRoleTypeId === 2)

      expect(payer).toBeDefined()
      expect(payer.fspId).toBe(from)
      expect(payer.amount).toBe('100.0000')
      expect(payer.partyName).toBe('Jane Doe')

      expect(payee).toBeDefined()
      expect(payee.fspId).toBe(to)
      expect(payee.amount).toBe('-100.0000')
      expect(payee.partyName).toBe('John Doe')

      // Test for party table entries
      const payerPartyDetails = await db.getParty(payer.quotePartyId)
      expect(payerPartyDetails).toBeDefined()
      expect(payerPartyDetails.quotePartyId).toBe(payer.quotePartyId)
      expect(payerPartyDetails.firstName).toBe('Jane')
      expect(payerPartyDetails.lastName).toBe('Doe')

      const payeePartyDetails = await db.getParty(payee.quotePartyId)
      expect(payeePartyDetails).toBeDefined()
      expect(payeePartyDetails.quotePartyId).toBe(payee.quotePartyId)
      expect(payeePartyDetails.firstName).toBe('John')
      expect(payeePartyDetails.lastName).toBe('Doe')
    })

    test('should create quote duplicate check entry in database', async () => {
      const quotePayload = await createQuote()
      await wait(WAIT_TIMEOUT)

      const duplicateCheck = await db.getQuoteDuplicateCheck(quotePayload.quoteId)
      expect(duplicateCheck).toBeDefined()
      expect(duplicateCheck.quoteId).toBe(quotePayload.quoteId)
    })

    test('should store correct amount and currency in database', async () => {
      const amount = { amount: '250.50', currency: 'USD' }
      const quotePayload = await createQuote({ amount })
      await wait(WAIT_TIMEOUT)

      const quote = await db.getQuote(quotePayload.quoteId)
      expect(quote).toBeDefined()
      expect(quote.amount).toBe(new MLNumber(amount.amount).toFixed(config.amount.scale))
      expect(quote.currencyId).toBe(amount.currency)
    })
  })

  describe('PUT /quotes database updates --> ', () => {
    test('should create quote response duplicate check entry on PUT /quotes callback', async () => {
      const quotePayload = await createQuote()
      await wait(WAIT_TIMEOUT)

      const { topic, config } = kafkaConfig.PRODUCER.QUOTE.PUT
      const topicConfig = dto.topicConfigDto({ topicName: topic })
      const putPayload = mocks.putQuotesPayloadDto()
      const message = mocks.kafkaMessagePayloadDto({
        id: quotePayload.quoteId,
        payloadBase64: base64Encode(JSON.stringify(putPayload))
      })
      await Producer.produceMessage(message, topicConfig, config)
      await wait(WAIT_TIMEOUT)

      const responseDuplicateCheck = await db.getQuoteResponseDuplicateCheck(quotePayload.quoteId)
      expect(responseDuplicateCheck).toBeDefined()
    })

    test('should update quote with response data on PUT /quotes callback', async () => {
      const quotePayload = await createQuote()
      await wait(WAIT_TIMEOUT)

      const { topic, config } = kafkaConfig.PRODUCER.QUOTE.PUT
      const topicConfig = dto.topicConfigDto({ topicName: topic })
      const putPayload = mocks.putQuotesPayloadDto()
      const message = mocks.kafkaMessagePayloadDto({
        from: 'greenbank',
        to: 'pinkbank',
        id: quotePayload.quoteId,
        payloadBase64: base64Encode(JSON.stringify(putPayload))
      })
      delete message.content.headers.accept
      await Producer.produceMessage(message, topicConfig, config)
      await wait(WAIT_TIMEOUT)

      const quoteResponse = await db.getQuoteResponse(quotePayload.quoteId)
      expect(quoteResponse).toBeDefined()
      expect(quoteResponse.transferAmount).toBeDefined()
    })
  })

  describe('POST /fxQuotes database entries --> ', () => {
    const createFxQuote = async ({
      initiatingFsp = 'pinkbank',
      counterPartyFsp = 'greenbank'
    } = {}) => {
      const { topic, config } = kafkaConfig.PRODUCER.FX_QUOTE.POST
      const topicConfig = dto.topicConfigDto({ topicName: topic })
      const payload = mocks.postFxQuotesPayloadDto({ initiatingFsp, counterPartyFsp })
      const message = mocks.kafkaMessagePayloadPostDto({
        from: initiatingFsp,
        to: counterPartyFsp,
        id: payload.conversionRequestId,
        payloadBase64: base64Encode(JSON.stringify(payload))
      })
      const isOk = await Producer.produceMessage(message, topicConfig, config)
      expect(isOk).toBe(true)
      return payload
    }

    test('should create fx quote entry in database on POST /fxQuotes request', async () => {
      const fxQuotePayload = await createFxQuote()
      await wait(WAIT_TIMEOUT)

      const fxQuote = await db._getFxQuoteDetails(fxQuotePayload.conversionRequestId)
      expect(fxQuote).toBeDefined()
      expect(fxQuote.conversionRequestId).toBe(fxQuotePayload.conversionRequestId)
      expect(fxQuote.conversionId).toBe(fxQuotePayload.conversionTerms.conversionId)
    })

    test('should store source and target amounts correctly in database', async () => {
      const fxQuotePayload = await createFxQuote()
      await wait(WAIT_TIMEOUT)

      const fxQuote = await db._getFxQuoteDetails(fxQuotePayload.conversionRequestId)
      expect(fxQuote).toBeDefined()
      expect(fxQuote.sourceAmount).toBe(new MLNumber(fxQuotePayload.conversionTerms.sourceAmount.amount).toFixed(config.amount.scale))
      expect(fxQuote.sourceCurrency).toBe(fxQuotePayload.conversionTerms.sourceAmount.currency)
      expect(fxQuote.targetAmount).toBe(new MLNumber(fxQuotePayload.conversionTerms.targetAmount.amount).toFixed(config.amount.scale))
      expect(fxQuote.targetCurrency).toBe(fxQuotePayload.conversionTerms.targetAmount.currency)
    })
  })
})
