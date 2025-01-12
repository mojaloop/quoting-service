const ErrorHandler = require('@mojaloop/central-services-error-handling')

const rules = require('../../config/rules')
const RulesEngine = require('./rules.js')

module.exports.executeRules = async function executeRules (headers, quoteRequest, originalPayload, payer, payee, operation) {
  if (rules.length === 0) {
    return await this.handleRuleEvents([], headers, quoteRequest, originalPayload)
  }

  const facts = {
    operation,
    payer,
    payee,
    payload: quoteRequest,
    headers
  }

  const { events } = await RulesEngine.run(rules, facts)

  this.writeLog(`Rules engine returned events ${JSON.stringify(events)}`)

  return await this.handleRuleEvents(events, headers, quoteRequest, originalPayload)
}

module.exports.handleRuleEvents = async function handleRuleEvents (events, headers, payload, originalPayload) {
  const quoteRequest = originalPayload || payload

  // At the time of writing, all events cause the "normal" flow of execution to be interrupted.
  // So we'll return false when there have been no events whatsoever.
  if (events.length === 0) {
    return { terminate: false, quoteRequest, headers }
  }

  const { INVALID_QUOTE_REQUEST, INTERCEPT_QUOTE } = RulesEngine.events

  const unhandledEvents = events.filter(ev => !(ev.type in RulesEngine.events))

  if (unhandledEvents.length > 0) {
    // The rules configuration contains events not handled in the code
    throw new Error('Unhandled event returned by rules engine')
  }

  const invalidQuoteRequestEvents = events.filter(ev => ev.type === INVALID_QUOTE_REQUEST)
  if (invalidQuoteRequestEvents.length > 0) {
    // Use the first event, ignore the others for now. This is ergonomically worse for someone
    // developing against this service, as they can't see all reasons their quote was invalid at
    // once. But is a valid solution in the short-term.
    const { FSPIOPError: code, message } = invalidQuoteRequestEvents[0].params
    // Will throw an internal server error if property doesn't exist
    throw ErrorHandler.CreateFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes[code],
      message, null, headers['fspiop-source'])
  }

  const interceptQuoteEvents = events.filter(ev => ev.type === INTERCEPT_QUOTE)
  if (interceptQuoteEvents.length > 1) {
    throw new Error('Multiple intercept quote events received')
  }
  if (interceptQuoteEvents.length > 0) {
    // send the quote request to the recipient in the event
    const result = {
      terminate: false,
      quoteRequest,
      headers: {
        ...headers,
        'fspiop-destination': interceptQuoteEvents[0].params.rerouteToFsp
      }
    }
    // if additionalHeaders are present then add the additional non-standard headers (e.g. used by forex)
    // Note these headers are not part of the mojaloop specification
    if (interceptQuoteEvents[0].params.additionalHeaders) {
      result.headers = { ...result.headers, ...interceptQuoteEvents[0].params.additionalHeaders }
      result.additionalHeaders = interceptQuoteEvents[0].params.additionalHeaders
    }
    return result
  }
}
