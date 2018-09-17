
const util = require('util');


class FSPIOPError extends Error {
    constructor(cause, message, replyTo, errorCode, extensions) {
        super(message);
        this.name = 'FSPIOPError';

        this.cause = cause;
        this.replyTo = replyTo;
        this.errorCode = errorCode;
        this.extensions = extensions;
    }

    toApiErrorObject() {
        return {
            errorCode: this.errorCode,
            errorDescription: this.message,
            extensionList: this.extensions
        };
    }

    toFullErrorObject() {
        return {
            errorCode: this.errorCode,
            message: this.message,
            replyTo: this.replyTo,
            errorCode: this.errorCode,
            extensions: this.extensions,
            cause: this.cause ? this.cause.stack || util.inspect(this.cause) : this.cause
        };
    }
}


module.exports = {
    FSPIOPError: FSPIOPError
};
