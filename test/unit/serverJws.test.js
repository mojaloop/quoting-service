'use strict'

const Hapi = require('@hapi/hapi')
const crypto = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')
const { Jws } = require('@mojaloop/sdk-standard-components')
const ErrorHandler = require('@mojaloop/central-services-error-handling')

const JwsSigner = Jws.signer
const JwsValidator = Jws.validator

const { _loadJwsKeys, _watchJwsKeys } = require('../../src/server')

const FSPIOP_SOURCE = 'payerfsp'

const generateKeyPair = () => crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
})

const buildSignedHeaders = ({ signingKey, method, urlPath, body, source = FSPIOP_SOURCE }) => {
  const signer = new JwsSigner({ signingKey })
  const reqOpts = {
    headers: {
      'content-type': 'application/vnd.interoperability.quotes+json;version=1.1',
      accept: 'application/vnd.interoperability.quotes+json;version=1',
      date: new Date().toUTCString(),
      'fspiop-source': source,
      'fspiop-destination': 'payeefsp'
    },
    method,
    uri: `http://switch${urlPath}`,
    body
  }
  signer.sign(reqOpts)
  return reqOpts.headers
}

const makeTempDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'jws-qs-'))

describe('server JWS helpers', () => {
  describe('loadJwsKeys', () => {
    it('returns empty for missing dir', () => {
      expect(_loadJwsKeys('/no/such/dir')).toEqual({})
    })

    it('returns empty for undefined', () => {
      expect(_loadJwsKeys(undefined)).toEqual({})
    })

    it('reads .pem files and ignores others', () => {
      const dir = makeTempDir()
      fs.writeFileSync(path.join(dir, 'fsp1.pem'), 'KEY-A')
      fs.writeFileSync(path.join(dir, 'fsp2.pem'), 'KEY-B')
      fs.writeFileSync(path.join(dir, 'readme.txt'), 'skip')

      const keys = _loadJwsKeys(dir)
      expect(keys.fsp1.toString()).toBe('KEY-A')
      expect(keys.fsp2.toString()).toBe('KEY-B')
      expect(keys.readme).toBeUndefined()

      fs.rmSync(dir, { recursive: true, force: true })
    })
  })

  describe('watchJwsKeys', () => {
    it('returns null for missing dir', () => {
      expect(_watchJwsKeys('/no/such/dir', {})).toBeNull()
    })

    it('returns null for undefined', () => {
      expect(_watchJwsKeys(undefined, {})).toBeNull()
    })

    it('detects added key', async () => {
      const dir = makeTempDir()
      const keyMap = {}
      const watcher = _watchJwsKeys(dir, keyMap)

      fs.writeFileSync(path.join(dir, 'newfsp.pem'), 'NEW-KEY')
      const deadline = Date.now() + 3000
      while (!keyMap.newfsp && Date.now() < deadline) {
        await new Promise(resolve => setTimeout(resolve, 50))
      }
      expect(keyMap.newfsp).toBeDefined()

      watcher.close()
      fs.rmSync(dir, { recursive: true, force: true })
    })

    it('detects removed key', async () => {
      const dir = makeTempDir()
      fs.writeFileSync(path.join(dir, 'old.pem'), 'OLD')
      const keyMap = { old: Buffer.from('OLD') }
      const watcher = _watchJwsKeys(dir, keyMap)

      fs.rmSync(path.join(dir, 'old.pem'))
      const deadline = Date.now() + 3000
      while (keyMap.old && Date.now() < deadline) {
        await new Promise(resolve => setTimeout(resolve, 50))
      }
      expect(keyMap.old).toBeUndefined()

      watcher.close()
      fs.rmSync(dir, { recursive: true, force: true })
    })
  })

  describe('JWS onPostAuth validation pattern', () => {
    const { privateKey, publicKey } = generateKeyPair()

    const createServer = (validationKeys) => {
      const server = new Hapi.Server()
      const jwsValidator = new JwsValidator({ validationKeys })

      server.ext('onPostAuth', (request, h) => {
        if (request.method === 'get') return h.continue
        const resource = request.path.replace(/^\//, '').split('/')[0]
        if (!['quotes', 'fxQuotes'].includes(resource)) return h.continue
        if (request.method === 'put' && request.path.startsWith('/parties/')) return h.continue

        try {
          jwsValidator.validate({ headers: request.headers, body: request.payload })
        } catch (err) {
          throw ErrorHandler.Factory.createFSPIOPError(
            ErrorHandler.Enums.FSPIOPErrorCodes.INVALID_SIGNATURE, err.message
          )
        }
        return h.continue
      })

      server.ext('onPreResponse', (req, h) => {
        if (req.response && req.response.name === 'FSPIOPError') {
          const { apiErrorCode } = req.response
          return h.response({ errorCode: apiErrorCode.code }).code(apiErrorCode.httpStatusCode)
        }
        return h.continue
      })

      const ok = (_r, h) => h.response({ ok: true }).code(200)
      server.route([
        { method: 'POST', path: '/quotes', handler: ok },
        { method: 'GET', path: '/quotes/{id}', handler: ok },
        { method: 'POST', path: '/transfers', handler: ok },
        { method: 'PUT', path: '/parties/{type}/{id}', handler: ok }
      ])
      return server
    }

    it('accepts valid signed request', async () => {
      const server = createServer({ [FSPIOP_SOURCE]: publicKey })
      const body = { quoteId: 'abc' }
      const headers = buildSignedHeaders({ signingKey: privateKey, method: 'POST', urlPath: '/quotes', body })
      const res = await server.inject({ method: 'POST', url: '/quotes', headers, payload: body })
      expect(res.statusCode).toBe(200)
    })

    it('rejects tampered body with 3105', async () => {
      const server = createServer({ [FSPIOP_SOURCE]: publicKey })
      const body = { quoteId: 'abc' }
      const headers = buildSignedHeaders({ signingKey: privateKey, method: 'POST', urlPath: '/quotes', body })
      const res = await server.inject({ method: 'POST', url: '/quotes', headers, payload: { quoteId: 'tampered' } })
      expect(res.statusCode).toBe(400)
      expect(JSON.parse(res.payload).errorCode).toBe('3105')
    })

    it('GET bypasses validation', async () => {
      const server = createServer({ [FSPIOP_SOURCE]: publicKey })
      const res = await server.inject({ method: 'GET', url: '/quotes/abc' })
      expect(res.statusCode).toBe(200)
    })

    it('non-target resource bypasses validation', async () => {
      const server = createServer({ [FSPIOP_SOURCE]: publicKey })
      const res = await server.inject({ method: 'POST', url: '/transfers', payload: { x: 1 } })
      expect(res.statusCode).toBe(200)
    })

    it('PUT /parties bypasses validation', async () => {
      const server = createServer({ [FSPIOP_SOURCE]: publicKey })
      const res = await server.inject({ method: 'PUT', url: '/parties/MSISDN/123', payload: { party: {} } })
      expect(res.statusCode).toBe(200)
    })
  })
})
