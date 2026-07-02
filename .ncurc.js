module.exports = {
  // Add a to-do comment (in CAPS) indicating the reason for each rejected dependency upgrade added to this list, and what should be done to resolve it (i.e. handle it through a story, etc).
  reject: [
    "eslint",
    "jest", // jest 30 is released but libraries that work with jest have not been updated to support it yet.
    "commander" // TODO: commander 15 is a MAJOR bump (drops Node 18, breaking API changes) used by src/handlers/index.js.
  ]
}
