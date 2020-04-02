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

 * Crosslake
 - Lewis Daly <lewisd@crosslaketech.com>

 --------------
 ******/
'use strict'

const Enum = require('@mojaloop/central-services-shared').Enum

const { getStackOrInspect, getSpanTags } = require('../../../src/lib/util')

describe('util', () => {
  describe('getSpanTags', () => {
    it('does not get the span tags for payeeFsp and payerFsp if they do not exist', () => {
      // Arrange
      const expected = {
        transactionType: 'quote',
        transactionAction: 'prepare',
        transactionId: '12345',
        quoteId: 'ABCDE',
        source: 'fsp1',
        destination: 'switch'
      }
      const mockRequest = {
        params: {
          id: 'ABCDE'
        },
        payload: {
          transactionId: '12345'
        },
        headers: {
          'fspiop-source': 'fsp1',
          'fspiop-destination': 'switch'
        }
      }

      // Act
      const result = getSpanTags(mockRequest, Enum.Events.Event.Type.QUOTE, Enum.Events.Event.Action.PREPARE)

      // Assert
      expect(result).toStrictEqual(expected)
    })

    it('gets the span tags for payeeFsp and payerFsp if they do not exist', () => {
      // Arrange
      const expected = {
        transactionType: 'quote',
        transactionAction: 'prepare',
        transactionId: '12345',
        quoteId: 'ABCDE',
        source: 'fsp1',
        destination: 'switch',
        payeeFsp: 'fsp1',
        payerFsp: 'fsp2'
      }
      const mockRequest = {
        params: {
          id: 'ABCDE'
        },
        payload: {
          transactionId: '12345',
          payee: {
            partyIdInfo: {
              fspId: 'fsp1'
            }
          },
          payer: {
            partyIdInfo: {
              fspId: 'fsp2'
            }
          }
        },
        headers: {
          'fspiop-source': 'fsp1',
          'fspiop-destination': 'switch'
        }
      }

      // Act
      const result = getSpanTags(mockRequest, Enum.Events.Event.Type.QUOTE, Enum.Events.Event.Action.PREPARE)

      // Assert
      expect(result).toStrictEqual(expected)
    })
  })

  describe('getStackOrInspect', () => {
    it('handles an error without a stack', () => {
      // Arrange
      const input = new Error('This is a normal error')
      delete input.stack
      const expected = '[Error: This is a normal error]'

      // Act
      const output = getStackOrInspect(input)

      // Assert
      expect(output).toBe(expected)
    })
  })
})
