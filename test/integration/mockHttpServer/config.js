const process = require('node:process')

const HOST = parseInt(process.env.HTTP_HOST) || 'localhost'
const PORT = parseInt(process.env.HTTP_PORT) || 7777

const Routes = Object.freeze({
  HISTORY: '/history'
})

module.exports = {
  HOST,
  PORT,
  Routes
}
