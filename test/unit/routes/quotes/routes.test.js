/*****
 License
 --------------
 Copyright © 2017 Bill & Melinda Gates Foundation
 The Mojaloop files are made available by the Bill & Melinda Gates Foundation under the Apache License, Version 2.0 (the "License") and you may not use these files except in compliance with the License. You may obtain a copy of the License at
 http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, the Mojaloop files are distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 Contributors
 --------------
 This is the official list of the Mojaloop project contributors for this file.
 Names of the original copyright holders (individuals or organizations)
 should be listed with a '*' in the first column. People who have
 contributed from an organization can be listed under the organization
 that actually holds the copyright for their contributions (see the
 Gates Foundation organization for an example). Those individuals should have
 their names indented and be marked with a '-'. Email address can be added
 optionally within square brackets <email>.
 * Gates Foundation
 - Name Surname <name.surname@gatesfoundation.com>

 * ModusBox
 - Rajiv Mothilal <rajiv.mothilal@modusbox.com>

 * Crosslake
 - Lewis Daly <lewisd@crosslaketech.com>

 --------------
 ******/

'use strict'

jest.mock('../../../../src/model/quotes')

const Helper = require('../../../util/helper')
const QuotesModel = require('../../../../src/model/quotes')
const initServer = require('../../../../src/server')

let server
let sandbox
let Database

describe('/quotes', () => {
  beforeAll(async () => {
    jest.mock('../../../../src/data/cachedDatabase')
    Database = require('../../../../src/data/cachedDatabase')
    QuotesModel.mockClear()
    server = await initServer()
  })

  afterAll(async () => {
    await server.stop()
    sandbox.restore()
  })

  it('postQuotes success', async () => {
    // Arrange
    Database.mockImplementationOnce(() => ({
      connect: jest.fn().mockResolvedValueOnce()
    }))
    const mock = {
      quoteId: 'd7a780e6-8336-4da6-9056-616d651afe83',
      transactionId: 'c623104d-6501-40ee-a69a-0ac90e53ff53',
      payer: {
        partyIdInfo: {
          partyIdType: 'MSISDN',
          partyIdentifier: '{{payerMSISDN}}',
          fspId: 'payerfsp'
        },
        personalInfo: {
          complexName: {
            firstName: 'Mats',
            lastName: 'Hagman'
          },
          dateOfBirth: '1983-10-25'
        }
      },
      payee: {
        partyIdInfo: {
          partyIdType: 'MSISDN',
          partyIdentifier: '22556999125',
          fspId: 'payeefsp'
        }
      },
      amountType: 'SEND',
      amount: {
        amount: '60.1234',
        currency: 'USD'
      },
      transactionType: {
        scenario: 'TRANSFER',
        initiator: 'PAYER',
        initiatorType: 'CONSUMER'
      },
      note: 'hej'
    }
    const options = {
      method: 'post',
      url: '/quotes',
      headers: Helper.defaultHeaders(),
      payload: mock
    }
    // Act
    const response = await server.inject(options)

    // Assert
    expect(response.statusCode).toBe(202)
    const mockQuoteInstance = QuotesModel.mock.instances[0]
    expect(mockQuoteInstance.handleQuoteRequest).toHaveBeenCalledTimes(1)
  })

  it('postQuotes failure', async () => {
    // Arrange
    Database.mockImplementationOnce(() => ({
      connect: jest.fn().mockResolvedValueOnce()
    }))
    const mock = {
      transactionId: 'c623104d-6501-40ee-a69a-0ac90e53ff53',
      payer: {
        partyIdInfo: {
          partyIdType: 'MSISDN',
          partyIdentifier: '{{payerMSISDN}}',
          fspId: 'payerfsp'
        },
        personalInfo: {
          complexName: {
            firstName: 'Mats',
            lastName: 'Hagman'
          },
          dateOfBirth: '1983-10-25'
        }
      },
      payee: {
        partyIdInfo: {
          partyIdType: 'MSISDN',
          partyIdentifier: '22556999125',
          fspId: 'payeefsp'
        }
      },
      amountType: 'SEND',
      amount: {
        amount: '60.1234',
        currency: 'USD'
      },
      transactionType: {
        scenario: 'TRANSFER',
        initiator: 'PAYER',
        initiatorType: 'CONSUMER'
      },
      note: 'hej'
    }
    const options = {
      method: 'post',
      url: '/quotes',
      headers: Helper.defaultHeaders(),
      payload: mock
    }
    // Act
    const response = await server.inject(options)

    // Assert
    expect(response.statusCode).toBe(400)
  })
})
