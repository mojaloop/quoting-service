const IoRedisMock = require('ioredis-mock')

class MockRedisIo extends IoRedisMock {
  constructor (opts) {
    super(opts)
    this.lazyConnect = Boolean(opts?.lazyConnect)
    this.connected = false
  }

  get status () {
    return this.connected ? 'ready' : this.lazyConnect ? 'wait' : 'end'
  }

  // For some reason, ioredis-mock is not updating the status field
  async disconnect () {
    super.disconnect()
    this.connected = false
  }
}

class MockRedisIoCluster extends MockRedisIo {
  constructor (nodesOpts, redisOptions) {
    super(redisOptions)
    this._nodes = nodesOpts.map((connOpts) => new MockRedisIo({ ...connOpts, ...redisOptions }))
  }

  nodes () {
    return this._nodes
  }
}

MockRedisIo.Cluster = MockRedisIoCluster

module.exports = MockRedisIo
