# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

### [13.0.1](https://github.com/mojaloop/quoting-service/compare/v13.0.0...v13.0.1) (2021-11-16)


### Bug Fixes

* **mojaloop/#2535:** fspiop api version negotiation not handled by quoting service ([#289](https://github.com/mojaloop/quoting-service/issues/289)) ([#290](https://github.com/mojaloop/quoting-service/issues/290)) ([d4d48c1](https://github.com/mojaloop/quoting-service/commit/d4d48c179391ba956d9555432d4738652788190c)), closes [mojaloop/#2535](https://github.com/mojaloop/quoting-service/issues/2535) [mojaloop/#2535](https://github.com/mojaloop/quoting-service/issues/2535)

## [13.0.0](https://github.com/mojaloop/quoting-service/compare/v12.0.10...v13.0.0) (2021-11-05)


### ⚠ BREAKING CHANGES

* **mojaloop/#2535:** Forcing a major version change for awareness of the config changes. The `LIB_RESOURCE_VERSIONS` env var is now deprecated, and this is now also controlled by the PROTOCOL_VERSIONS config in the default.json. This has been done for consistency between all API services going forward and unifies the config for both inbound and outbound Protocol API validation/transformation features.

### Bug Fixes

* **mojaloop/#2535:** fspiop api version negotiation not handled by quoting service ([#289](https://github.com/mojaloop/quoting-service/issues/289)) ([737c7b4](https://github.com/mojaloop/quoting-service/commit/737c7b48e5ba0b80cef3e6b5ae701df1cb3440b6)), closes [mojaloop/#2535](https://github.com/mojaloop/quoting-service/issues/2535) [mojaloop/#2535](https://github.com/mojaloop/quoting-service/issues/2535)

### [12.0.10](https://github.com/mojaloop/quoting-service/compare/v12.0.9...v12.0.10) (2021-09-01)

### [12.0.9](https://github.com/mojaloop/quoting-service/compare/v12.0.8...v12.0.9) (2021-09-01)


### Bug Fixes

* circleci slack webhook typo fix ([#282](https://github.com/mojaloop/quoting-service/issues/282)) ([3e6ac84](https://github.com/mojaloop/quoting-service/commit/3e6ac841727ffc5c133fee35387e4781c8253779))

### [12.0.8](https://github.com/mojaloop/quoting-service/compare/v12.0.7...v12.0.8) (2021-09-01)


### Bug Fixes

* **mojaloop/#2439:** quoting-service-model.validatequoterequest-doesnt-perform-correct-validation ([#280](https://github.com/mojaloop/quoting-service/issues/280)) ([b0c2cdc](https://github.com/mojaloop/quoting-service/commit/b0c2cdc42422ecf604a58d48e9e5e9c2402d4341)), closes [mojaloop/#2439](https://github.com/mojaloop/quoting-service/issues/2439) [mojaloop/#2439](https://github.com/mojaloop/quoting-service/issues/2439)
* updated circleci config to use the SHA1 hash of the last commit of the current build ([#281](https://github.com/mojaloop/quoting-service/issues/281)) ([9ee10d7](https://github.com/mojaloop/quoting-service/commit/9ee10d72b5941b973e15e97633835aa6d34d20eb))
