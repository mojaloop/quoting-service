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
