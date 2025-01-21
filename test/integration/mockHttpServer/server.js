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

/* eslint-disable no-console */
const { createServer } = require('node:http')
const process = require('node:process')

const { PORT, Routes } = require('./config')

const parseJson = (string) => {
  try {
    return string ? JSON.parse(string) : null
  } catch (err) {
    console.error('Error on parsing body:', err)
    return null
  }
}

const getBody = (request) => new Promise((resolve) => {
  const bodyParts = []

  request
    .on('data', (chunk) => { bodyParts.push(chunk) })
    .on('end', () => {
      const body = Buffer.concat(bodyParts).toString()
      resolve(parseJson(body))
    })
    .on('error', (err) => {
      console.error('Error getting body:', err)
      resolve(null)
    })
})

let history = []

const server = createServer(async (req, res) => {
  const { url, method, headers } = req
  const sanitizedUrl = url.replace(/\n|\r/g, '')
  console.log(`[==>] ${method.toUpperCase()} ${sanitizedUrl}`)

  if (url === Routes.HISTORY && method === 'DELETE') {
    history = []
  } else if (url === Routes.HISTORY && method === 'GET') {
    console.log('GET history...')
  } else {
    const body = await getBody(req)
    const reqDetails = {
      time: Date.now(),
      url,
      method,
      headers,
      ...(body && { body })
    }
    history.unshift(reqDetails)
    console.log('Received a request: ', reqDetails)
  }

  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.write(JSON.stringify({ history }))
  res.end()
})

server.listen(PORT, () => { console.log(`Mock hub server is listening on port ${PORT}...`) });

['SIGTERM', 'SIGINT'].forEach((signal) => {
  process.on(signal, () => {
    server.close(() => { console.log(`${signal} received, server stopped`) })
    setImmediate(() => {
      server.emit('close')
      process.exit(0)
    })
  })
})
