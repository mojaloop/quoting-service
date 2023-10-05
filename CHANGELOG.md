# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

### [15.2.1](https://github.com/mojaloop/quoting-service/compare/v15.2.0...v15.2.1) (2023-10-05)


### Bug Fixes

* **mojaloop/#3537:** add mitigation for req obj mutation in handler async functions ([#315](https://github.com/mojaloop/quoting-service/issues/315)) ([250a2fe](https://github.com/mojaloop/quoting-service/commit/250a2fec96aeac544219fd64c544739842b67550)), closes [mojaloop/#3537](https://github.com/mojaloop/project/issues/3537)

## [15.2.0](https://github.com/mojaloop/quoting-service/compare/v15.1.0...v15.2.0) (2023-10-05)


### Features

* **mojaloop/#3537:** add metrics for cache hits and duplicate result ([#314](https://github.com/mojaloop/quoting-service/issues/314)) ([05708ac](https://github.com/mojaloop/quoting-service/commit/05708acbda137415ec0ca0b277aab584fdd58770)), closes [mojaloop/#3537](https://github.com/mojaloop/project/issues/3537)


### Chore

* **mojaloop/#3537:** add missing histgram ending ([#313](https://github.com/mojaloop/quoting-service/issues/313)) ([0ae94d7](https://github.com/mojaloop/quoting-service/commit/0ae94d7a97fb354cc3cd35a5a43598e2e2cafe0b)), closes [mojaloop/#3537](https://github.com/mojaloop/project/issues/3537)

## [15.1.0](https://github.com/mojaloop/quoting-service/compare/v15.0.4...v15.1.0) (2023-10-02)


### Features

* **mojaloop/#3432:** add metrics for quote handlers and models ([#311](https://github.com/mojaloop/quoting-service/issues/311)) ([de37e1e](https://github.com/mojaloop/quoting-service/commit/de37e1e8aa660151a3b42a3f50475414feeb0b80)), closes [mojaloop/#3432](https://github.com/mojaloop/project/issues/3432)

### [15.0.4](https://github.com/mojaloop/quoting-service/compare/v15.0.3...v15.0.4) (2023-09-07)


### CI

* fix docker build ([#310](https://github.com/mojaloop/quoting-service/issues/310)) ([cd13eec](https://github.com/mojaloop/quoting-service/commit/cd13eecc9cf9dce88ce5e353a29c00bc054a9bed))

### [15.0.3](https://github.com/mojaloop/quoting-service/compare/v15.0.2...v15.0.3) (2023-09-06)


### Chore

* **mojaloop/#3438:** nodejs upgrade ([#309](https://github.com/mojaloop/quoting-service/issues/309)) ([d3aba52](https://github.com/mojaloop/quoting-service/commit/d3aba52c26ecbe207fc544e0f125865c2888e2ad)), closes [mojaloop/#3438](https://github.com/mojaloop/project/issues/3438)

### [15.0.2](https://github.com/mojaloop/quoting-service/compare/v15.0.1...v15.0.2) (2022-06-16)


### Bug Fixes

* handle unhandled promise rejections ([#303](https://github.com/mojaloop/quoting-service/issues/303)) ([802e627](https://github.com/mojaloop/quoting-service/commit/802e6276ced1754f7f6cc70861149b80d6558e2d))

### [15.0.1](https://github.com/mojaloop/quoting-service/compare/v15.0.0...v15.0.1) (2022-06-09)


### Bug Fixes

* dockerfile typo fix ([938bf65](https://github.com/mojaloop/quoting-service/commit/938bf65ed781f7c8b950b310a366d06ed0a72781))

## [15.0.0](https://github.com/mojaloop/quoting-service/compare/v14.0.0...v15.0.0) (2022-06-09)


### ⚠ BREAKING CHANGES

* Major version bump for node v16 LTS support, re-structuring of project directories to align to core Mojaloop repositories and docker image now uses /opt/app instead of /opt/quoting-service which will impact config mounts.

### Features

* upgrade to node LTS v16 ([#302](https://github.com/mojaloop/quoting-service/issues/302)) ([bc11b7c](https://github.com/mojaloop/quoting-service/commit/bc11b7cef03d34662e58fab06911ecb82566c3bc)), closes [mojaloop/#2767](https://github.com/mojaloop/project/issues/2767)

## [14.0.0](https://github.com/mojaloop/quoting-service/compare/v13.0.1...v14.0.0) (2022-03-04)


### ⚠ BREAKING CHANGES

* **mojaloop/#2704:** - Config PROTOCOL_VERSIONS.CONTENT has now been modified to support backward compatibility for minor versions (i.e. v1.0 & 1.1) as follows:

> ```
>   "PROTOCOL_VERSIONS": {
>     "CONTENT": "1.1", <-- used when generating messages from the "SWITCH", and validate incoming FSPIOP API requests/callbacks CONTENT-TYPE headers
>     "ACCEPT": {
>       "DEFAULT": "1", <-- used when generating messages from the "SWITCH"
>       "VALIDATELIST": [ <-- used to validate incoming FSPIOP API requests/callbacks ACCEPT headers
>         "1",
>         "1.0",
>         "1.1"
>       ]
>     }
>   },
> ```
> 
> to be consistent with the ACCEPT structure as follows:
> 
> ```
>   "PROTOCOL_VERSIONS": {
>     "CONTENT": {
>       "DEFAULT": "1.1", <-- used when generating messages from the "SWITCH"
>       "VALIDATELIST": [ <-- used to validate incoming FSPIOP API requests/callbacks CONTENT-TYPE headers
>         "1.1",
>         "1.0"
>       ]
>     },
>     "ACCEPT": {
>       "DEFAULT": "1", <-- used when generating messages from the "SWITCH"
>       "VALIDATELIST": [ <-- used to validate incoming FSPIOP API requests/callbacks ACCEPT headers
>         "1",
>         "1.0",
>         "1.1"
>       ]
>     }
>   },
> ```

### Features

* merge mowali branch ([#286](https://github.com/mojaloop/quoting-service/issues/286)) ([f92299b](https://github.com/mojaloop/quoting-service/commit/f92299bb2ad66bd89c00a04c382183b7845d881c)), closes [#100](https://github.com/mojaloop/quoting-service/issues/100) [#101](https://github.com/mojaloop/quoting-service/issues/101) [#102](https://github.com/mojaloop/quoting-service/issues/102) [#127](https://github.com/mojaloop/quoting-service/issues/127)
* **mojaloop/#2704:** core-services support for non-breaking backward api compatibility ([#295](https://github.com/mojaloop/quoting-service/issues/295)) ([812b75d](https://github.com/mojaloop/quoting-service/commit/812b75d616c87792bab7c80b6552ac894424ec5d)), closes [mojaloop/#2704](https://github.com/mojaloop/project/issues/2704)


### Bug Fixes

* [#2704](https://github.com/mojaloop/quoting-service/issues/2704) core services support for non breaking backward api compatibility ([#297](https://github.com/mojaloop/quoting-service/issues/297)) ([acf48a5](https://github.com/mojaloop/quoting-service/commit/acf48a5ba7b482c126bc345df121e5b0044921b1))

### [13.0.1](https://github.com/mojaloop/quoting-service/compare/v13.0.0...v13.0.1) (2021-11-16)


### Bug Fixes

* **mojaloop/#2535:** fspiop api version negotiation not handled by quoting service ([#289](https://github.com/mojaloop/quoting-service/issues/289)) ([#290](https://github.com/mojaloop/quoting-service/issues/290)) ([d4d48c1](https://github.com/mojaloop/quoting-service/commit/d4d48c179391ba956d9555432d4738652788190c)), closes [mojaloop/#2535](https://github.com/mojaloop/project/issues/2535)

## [13.0.0](https://github.com/mojaloop/quoting-service/compare/v12.0.10...v13.0.0) (2021-11-05)


### ⚠ BREAKING CHANGES

* **mojaloop/#2535:** Forcing a major version change for awareness of the config changes. The `LIB_RESOURCE_VERSIONS` env var is now deprecated, and this is now also controlled by the PROTOCOL_VERSIONS config in the default.json. This has been done for consistency between all API services going forward and unifies the config for both inbound and outbound Protocol API validation/transformation features.

### Bug Fixes

* **mojaloop/#2535:** fspiop api version negotiation not handled by quoting service ([#289](https://github.com/mojaloop/quoting-service/issues/289)) ([737c7b4](https://github.com/mojaloop/quoting-service/commit/737c7b48e5ba0b80cef3e6b5ae701df1cb3440b6)), closes [mojaloop/#2535](https://github.com/mojaloop/project/issues/2535)

### [12.0.10](https://github.com/mojaloop/quoting-service/compare/v12.0.9...v12.0.10) (2021-09-01)

### [12.0.9](https://github.com/mojaloop/quoting-service/compare/v12.0.8...v12.0.9) (2021-09-01)


### Bug Fixes

* circleci slack webhook typo fix ([#282](https://github.com/mojaloop/quoting-service/issues/282)) ([3e6ac84](https://github.com/mojaloop/quoting-service/commit/3e6ac841727ffc5c133fee35387e4781c8253779))

### [12.0.8](https://github.com/mojaloop/quoting-service/compare/v12.0.7...v12.0.8) (2021-09-01)


### Bug Fixes

* **mojaloop/#2439:** quoting-service-model.validatequoterequest-doesnt-perform-correct-validation ([#280](https://github.com/mojaloop/quoting-service/issues/280)) ([b0c2cdc](https://github.com/mojaloop/quoting-service/commit/b0c2cdc42422ecf604a58d48e9e5e9c2402d4341)), closes [mojaloop/#2439](https://github.com/mojaloop/project/issues/2439)
* updated circleci config to use the SHA1 hash of the last commit of the current build ([#281](https://github.com/mojaloop/quoting-service/issues/281)) ([9ee10d7](https://github.com/mojaloop/quoting-service/commit/9ee10d72b5941b973e15e97633835aa6d34d20eb))
