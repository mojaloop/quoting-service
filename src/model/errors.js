
const util = require('util');


/**
 * Encapsulates an error and the required information to pass is back to a client for processing
 */
class FSPIOPError extends Error {

    /**
     * Constructs a new error object
     */
    constructor(cause, message, replyTo, errorCode, extensions) {
        super(message);
        this.name = 'FSPIOPError';

        this.cause = cause;
        this.replyTo = replyTo;
        this.errorCode = errorCode;
        this.extensions = extensions;
    }


    /**
     * Returns an object that complies with the API specification for error bodies.
     * This can be used to serialise the error to a JSON body
     *
     * @returns {object}
     */
    toApiErrorObject() {
        return {
            errorInformation: {
                errorCode: this.errorCode,
                errorDescription: this.message,
                extensionList: this.extensions
            }
        };
    }


    /**
     * Returns an object containing all details of the error e.g. for logging 
     *
     * @returns {object}
     */
    toFullErrorObject() {
        return {
            errorCode: this.errorCode,
            message: this.message,
            replyTo: this.replyTo,
            errorCode: this.errorCode,
            extensions: this.extensions,
            cause: this.cause ? this.cause.stack || util.inspect(this.cause) : undefined
        };
    }
}


module.exports = {
    FSPIOPError: FSPIOPError
};
