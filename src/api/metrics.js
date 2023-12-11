'use strict'

const Metrics = require('@mojaloop/central-services-metrics')

module.exports = {
  get: async (context, request, h) => {
    return h.response(await Metrics.getMetricsForPrometheus()).code(200)
  }
}
