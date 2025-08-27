module.exports = {
  // Add a to-do comment (in CAPS) indicating the reason for each rejected dependency upgrade added to this list, and what should be done to resolve it (i.e. handle it through a story, etc).
  reject: [
    "eslint",
    "jest", // jest 30 is released but libraries that work with jest have not been updated to support it yet.
    "@mojaloop/central-services-shared" // version 18.30.7 causes multiple unit-tests to fail (see CSI-1677)
  ]
}
