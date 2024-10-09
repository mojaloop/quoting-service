const path = require('path')

module.exports = {
  verbose: true,
  clearMocks: true, // to avoid jest.clearAllMocks() in afterEach

  collectCoverageFrom: [
    '**/src/**/**/*.js'
  ],
  coveragePathIgnorePatterns: [
    './src/handlers/index.js'
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
