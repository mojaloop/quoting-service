// (C)2018 ModusBox Inc.

const util = require('util');

/**
 * Loads config from environment
 */
class Config {
    constructor() {
        //load config from environment (or use sensible defaults)
        this.listenAddress = process.env['LISTEN_ADDRESS'] || '0.0.0.0';
        this.listenPort = process.env['LISTEN_PORT'] || 3000;

        this.database = {
            client: process.env['DATABASE_DIALECT'] || 'mysql',
            connection: {
                host: process.env['DATABASE_HOST'] || 'mysql',
                port: process.env['DATABASE_PORT'] || '3306',
                user: process.env['DATABASE_USER'] || 'casa',
                password: process.env['DATABASE_PASSWORD'] || 'casa',
                database: process.env['DATABASE_SCHEMA'] || 'central_ledger'
            },
            pool: {
                min: process.env['DATABASE_POOL_MINSIZE'] || 10,
                max: process.env['DATABASE_POOL_MAXSIZE'] || 10
            }
        };
        //eslint-disable-next-line no-console
        console.log('Config loaded: %s', util.inspect(this));
    }
}


module.exports = Config;
