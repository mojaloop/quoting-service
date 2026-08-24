module.exports = {
  // Add a to-do comment (in CAPS) indicating the reason for each rejected dependency upgrade added to this list, and what should be done to resolve it (i.e. handle it through a story, etc).
  reject: [
    "eslint",
    "jest", // jest 30 is released but libraries that work with jest have not been updated to support it yet.
    // @mojaloop/event-sdk 14.8.5 is a broken publish: its dist exists but requiring it executes the raw
    // TypeScript src/Span.ts ("Cannot use import statement outside a module"), which breaks 30 unit test
    // suites via @mojaloop/central-services-shared. Held at 14.8.4 until a fixed release is published.
    // TODO: review by 2026-10-21 - re-run `npm run dep:check` against the latest event-sdk release; if a
    // working publish exists by then, remove this reject entry and bump the dependency.
    "@mojaloop/event-sdk",
    // commander 15.x is a major release; deferring to a dedicated dependency-update pass so this
    // security-focused PR stays scoped. Handle the major bump and its CLI arg-parsing changes separately.
    "commander"
  ]
}
