const path = require('path')

module.exports = {
  verbose: true,
  collectCoverageFrom: [
    '**/src/**/**/*.js'
  ],
  coverageThreshold: {
    global: {
      statements: 90,
      functions: 90,
      branches: 90,
      lines: 90
    }
  },
  globals: {
    __SRC__: path.resolve(__dirname, 'src'),
    __ROOT__: path.resolve(__dirname)
  }
}
