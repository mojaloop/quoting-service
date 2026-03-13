module.exports = {
  // Add a to-do comment (in CAPS) indicating the reason for each rejected dependency upgrade added to this list, and what should be done to resolve it (i.e. handle it through a story, etc).
  reject: [
    "eslint",
    "jest", // jest 30 is released but libraries that work with jest have not been updated to support it yet.
    "@mojaloop/central-services-shared", // need to use 18.36.0-iad-582.* for now
    "@mojaloop/central-services-stream" // need to use 11.10.0-iad-582.* for now
  ]
}
