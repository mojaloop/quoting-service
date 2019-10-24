
const path = require('path')

module.exports = {
  globals: {
    '__SRC__': path.resolve(__dirname, 'src'),
    '__ROOT__': path.resolve(__dirname)
  }
}
