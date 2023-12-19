const path = require('path')

module.exports = {
  verbose: true,
  collectCoverageFrom: [
    '**/src/**/**/*.js',
    '!src/server.js',
    '!src/api/routes.js',
    '!src/handlers/index.js',
    '!src/handlers/init.js',
    '!src/model/quotes.js',
    '!src/lib/logger/*.js',
    '!src/lib/startingProcess.js'
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
