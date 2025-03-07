# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

## [17.4.0](https://github.com/mojaloop/quoting-service/compare/v17.3.1...v17.4.0) (2025-03-07)


### Features

* **csi-1252:** updated central-services-shared to log request error details  ([#400](https://github.com/mojaloop/quoting-service/issues/400)) ([3402778](https://github.com/mojaloop/quoting-service/commit/3402778f666e9b62661b90e2322d1db46b28d452))

### [17.3.1](https://github.com/mojaloop/quoting-service/compare/v17.3.0...v17.3.1) (2025-03-06)


### Build System

* configure grype image scanning ([#398](https://github.com/mojaloop/quoting-service/issues/398)) ([be0c5f2](https://github.com/mojaloop/quoting-service/commit/be0c5f25827256d9636a20bd2604be391637e38b))

## [17.3.0](https://github.com/mojaloop/quoting-service/compare/v17.2.1...v17.3.0) (2025-03-03)


### Features

* align audit messages ([#397](https://github.com/mojaloop/quoting-service/issues/397)) ([3f7c1d2](https://github.com/mojaloop/quoting-service/commit/3f7c1d276db97be043794f661e9b1430e706e5e9))

### [17.2.1](https://github.com/mojaloop/quoting-service/compare/v17.2.0...v17.2.1) (2025-02-25)


### Chore

* maintenance updates ([#396](https://github.com/mojaloop/quoting-service/issues/396)) ([455e90b](https://github.com/mojaloop/quoting-service/commit/455e90ba38970b61535140f08d225875e68ee23c))

## [17.2.0](https://github.com/mojaloop/quoting-service/compare/v17.1.3...v17.2.0) (2025-02-21)


### Features

* **csi-1161:** update streaming lib to use otel ([#394](https://github.com/mojaloop/quoting-service/issues/394)) ([25e0aa8](https://github.com/mojaloop/quoting-service/commit/25e0aa8546086c731ac9c406c9c7d3db00b809cf))

### [17.1.3](https://github.com/mojaloop/quoting-service/compare/v17.1.2...v17.1.3) (2025-02-20)


### Chore

* update build orb to version 1.0.50 and add context to workflow ([#393](https://github.com/mojaloop/quoting-service/issues/393)) ([ae2d487](https://github.com/mojaloop/quoting-service/commit/ae2d4879177d5e8b18e9ca644a1fe94a988644ab))

### [17.1.2](https://github.com/mojaloop/quoting-service/compare/v17.1.1...v17.1.2) (2025-02-04)


### Chore

* maintenance updates ([#392](https://github.com/mojaloop/quoting-service/issues/392)) ([77522c9](https://github.com/mojaloop/quoting-service/commit/77522c96556f5ffbc4d85ef8cfa4b797a7d16ceb))

### [17.1.1](https://github.com/mojaloop/quoting-service/compare/v17.1.0...v17.1.1) (2025-01-30)


### Chore

* fixed merge to main issue ([#391](https://github.com/mojaloop/quoting-service/issues/391)) ([f54d215](https://github.com/mojaloop/quoting-service/commit/f54d215419149f7cbe3b1d058ac4fad815f08263))

## [17.1.0](https://github.com/mojaloop/quoting-service/compare/v17.0.5...v17.1.0) (2025-01-30)


### Features

* **csi-927:** fixed db error - ER_BAD_FIELD_ERROR: Unknown column 'NaN' in 'field list' ([#390](https://github.com/mojaloop/quoting-service/issues/390)) ([c9fb641](https://github.com/mojaloop/quoting-service/commit/c9fb64148a626890a973ce6b47515c1b61931196))

### [17.0.5](https://github.com/mojaloop/quoting-service/compare/v17.0.4...v17.0.5) (2025-01-29)


### Tests

* **csi-1130:** api and db lib tests ([#389](https://github.com/mojaloop/quoting-service/issues/389)) ([d57e428](https://github.com/mojaloop/quoting-service/commit/d57e4284b523def6970d8688ad57280502de9b4a))

### [17.0.4](https://github.com/mojaloop/quoting-service/compare/v17.0.3...v17.0.4) (2025-01-28)


### Bug Fixes

* **fix/csi-1130:** metrics and test coverage fixes ([#388](https://github.com/mojaloop/quoting-service/issues/388)) ([590d83f](https://github.com/mojaloop/quoting-service/commit/590d83f4645400c8a1bd0e4b091112b9a765f4cf))

### [17.0.3](https://github.com/mojaloop/quoting-service/compare/v17.0.2...v17.0.3) (2025-01-22)


### Tests

* **csi-1130:** add date validation test for get quotes ([#387](https://github.com/mojaloop/quoting-service/issues/387)) ([bbd7e91](https://github.com/mojaloop/quoting-service/commit/bbd7e91a407ee9fdee184f06c3c1a1c7371f4f13))

### [17.0.2](https://github.com/mojaloop/quoting-service/compare/v17.0.1...v17.0.2) (2025-01-21)


### Chore

* update licensing and dependencies ([#384](https://github.com/mojaloop/quoting-service/issues/384)) ([fe8cfdd](https://github.com/mojaloop/quoting-service/commit/fe8cfdd61eac94fc70a2e29d15e7f7e702eacb5c)), closes [mojaloop/#3689](https://github.com/mojaloop/project/issues/3689)

### [17.0.1](https://github.com/mojaloop/quoting-service/compare/v17.0.0...v17.0.1) (2025-01-20)


### Chore

* address follow up iso comments ([#385](https://github.com/mojaloop/quoting-service/issues/385)) ([012907e](https://github.com/mojaloop/quoting-service/commit/012907e206059636126d392a843c87669afc372c))

## [17.0.0](https://github.com/mojaloop/quoting-service/compare/v16.0.1...v17.0.0) (2025-01-18)


### ⚠ BREAKING CHANGES

* add iso 20022 compatibility (#383)

### Features

* add iso 20022 compatibility ([#383](https://github.com/mojaloop/quoting-service/issues/383)) ([8406c75](https://github.com/mojaloop/quoting-service/commit/8406c75ffce52890e874c9349e7e40363e5e4f6b)), closes [mojaloop/#3689](https://github.com/mojaloop/project/issues/3689)

### [16.0.1](https://github.com/mojaloop/quoting-service/compare/v16.0.0...v16.0.1) (2024-12-18)


### Refactors

* **csi-944:** refactor code for maintainability ([#379](https://github.com/mojaloop/quoting-service/issues/379)) ([80beb3f](https://github.com/mojaloop/quoting-service/commit/80beb3f04fc106903a88b01ea9aa78b5f45fff0c))

## [16.0.0](https://github.com/mojaloop/quoting-service/compare/v15.7.3...v16.0.0) (2024-12-17)


### ⚠ BREAKING CHANGES

* fx and interscheme implementation (#353)

### Features

* fx and interscheme implementation ([#353](https://github.com/mojaloop/quoting-service/issues/353)) ([bc4e126](https://github.com/mojaloop/quoting-service/commit/bc4e126041180178ea69369b52b7f441526dbbd2))


### Chore

* **moja-tools-bot:** update license md ([#363](https://github.com/mojaloop/quoting-service/issues/363)) ([bad3fd9](https://github.com/mojaloop/quoting-service/commit/bad3fd959a31a8ef60f124ae6795e825a507aafe))

### [15.7.3](https://github.com/mojaloop/quoting-service/compare/v15.7.2...v15.7.3) (2024-06-17)


### Chore

* dependency upgrades and minor maintenance ([#337](https://github.com/mojaloop/quoting-service/issues/337)) ([51c9ad9](https://github.com/mojaloop/quoting-service/commit/51c9ad95cb0dfae8cb406a4da7a3762fba9d86d2))

### [15.7.2](https://github.com/mojaloop/quoting-service/compare/v15.7.1...v15.7.2) (2024-05-16)


### Bug Fixes

* logging issues ([#331](https://github.com/mojaloop/quoting-service/issues/331)) ([3d4cba6](https://github.com/mojaloop/quoting-service/commit/3d4cba6601a94221348be359e07182ab40080414))

### [15.7.1](https://github.com/mojaloop/quoting-service/compare/v15.7.0...v15.7.1) (2024-04-19)


### Bug Fixes

* enable keep alive for HTTP requests made by the quoting service ([#330](https://github.com/mojaloop/quoting-service/issues/330)) ([4d393b4](https://github.com/mojaloop/quoting-service/commit/4d393b4b557556cc83fde1bcc314a80cffb91ef3))

## [15.7.0](https://github.com/mojaloop/quoting-service/compare/v15.6.0...v15.7.0) (2024-02-23)


### Features

* **iprod/#379:** added integration tests; updated docker-compose ([#324](https://github.com/mojaloop/quoting-service/issues/324)) ([66b7158](https://github.com/mojaloop/quoting-service/commit/66b7158dbb157cde1b6fdfa0ad4cd9a8a4814ae9)), closes [iprod/#379](https://github.com/iprod/quoting-service/issues/379)

## [15.6.0](https://github.com/mojaloop/quoting-service/compare/v15.5.0...v15.6.0) (2024-02-02)


### Features

* **3666:** refactor quoting service into an event driven solution to improve performance ([#321](https://github.com/mojaloop/quoting-service/issues/321)) ([29036d5](https://github.com/mojaloop/quoting-service/commit/29036d5aa9e64be66d3d06b38f67174289b20e27)), closes [mojaloop/#3739](https://github.com/mojaloop/project/issues/3739)

## [15.5.0](https://github.com/mojaloop/quoting-service/compare/v15.4.0...v15.5.0) (2023-11-02)


### Bug Fixes

* **mojaloop/#3604:** update dependencies ([#320](https://github.com/mojaloop/quoting-service/issues/320)) ([c0ae7bd](https://github.com/mojaloop/quoting-service/commit/c0ae7bd2a2462fd63ef801154bc00a0ea02ede53)), closes [mojaloop/#3604](https://github.com/mojaloop/project/issues/3604)

## [15.4.0](https://github.com/mojaloop/quoting-service/compare/v15.3.0...v15.4.0) (2023-10-17)


### Features

* **mojaloop/#3564:** multi insert quote party extensions ([#319](https://github.com/mojaloop/quoting-service/issues/319)) ([b413ffd](https://github.com/mojaloop/quoting-service/commit/b413ffdd7614e2280452fada120deb1df569ec84)), closes [mojaloop/#3564](https://github.com/mojaloop/project/issues/3564)

## [15.3.0](https://github.com/mojaloop/quoting-service/compare/v15.2.2...v15.3.0) (2023-10-13)


### Features

* **mojaloop/#3565:** database and cache optimizations  ([#318](https://github.com/mojaloop/quoting-service/issues/318)) ([da15567](https://github.com/mojaloop/quoting-service/commit/da155678bdebb35375a5f1db5fac5c25e9bf2c60)), closes [mojaloop/#3565](https://github.com/mojaloop/project/issues/3565)

### [15.2.2](https://github.com/mojaloop/quoting-service/compare/v15.2.1...v15.2.2) (2023-10-10)


### Chore

* **mojaloop/#3565:** fix logger statements ([#312](https://github.com/mojaloop/quoting-service/issues/312)) ([47fa7f3](https://github.com/mojaloop/quoting-service/commit/47fa7f321235276209ad2d5acdad3e0a69669280))

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
