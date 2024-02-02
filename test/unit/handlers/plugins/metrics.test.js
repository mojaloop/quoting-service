/*****
LICENSE

Copyright © 2020 Mojaloop Foundation

The Mojaloop files are made available by the Mojaloop Foundation under the Apache License, Version 2.0
(the "License") and you may not use these files except in compliance with the [License](http://www.apache.org/licenses/LICENSE-2.0).

You may obtain a copy of the License at [http://www.apache.org/licenses/LICENSE-2.0](http://www.apache.org/licenses/LICENSE-2.0)

Unless required by applicable law or agreed to in writing, the Mojaloop files are distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the [License](http://www.apache.org/licenses/LICENSE-2.0).

* Infitx
* Steven Oderayi <steven.oderayi@infitx.com>
--------------
******/

'use strict'

const HTTPENUM = require('@mojaloop/central-services-shared').Enum.Http

jest.mock('@mojaloop/central-services-metrics')

const Metrics = require('@mojaloop/central-services-metrics')
const metrics = require('../../../../src/handlers/plugins/metrics')

describe('metrics Tests -->', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  afterAll(() => {
    jest.restoreAllMocks()
  })

  describe('plugin', () => {
    it('should return plugin name', () => {
      expect(metrics.plugin.name).toEqual('Metrics')
    })
    it('should return plugin register', () => {
      expect(metrics.plugin.register).toBeInstanceOf(Function)
    })
    it('should register routes', async () => {
      const server = {
        route: jest.fn()
      }
      await metrics.plugin.register(server)
      expect(server.route).toHaveBeenCalledTimes(1)
      expect(server.route).toHaveBeenCalledWith([
        {
          method: 'GET',
          path: '/metrics',
          handler: metrics.handler.get
        }
      ])
    })
  })

  describe('handler', () => {
    it('should return metrics and correct response code', async () => {
      const request = {}
      const code = jest.fn()
      const reply = {
        response: jest.fn(() => ({ code }))
      }
      Metrics.getMetricsForPrometheus.mockResolvedValue('metrics')
      await metrics.handler.get(request, reply)
      expect(reply.response).toHaveBeenCalledWith('metrics')
      expect(code).toHaveBeenCalledWith(HTTPENUM.ReturnCodes.OK.CODE)
    })
  })
})
