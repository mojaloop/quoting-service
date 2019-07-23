# Quoting Service
[![Git Commit](https://img.shields.io/github/last-commit/mojaloop/quoting-service.svg?style=flat)](https://github.com/mojaloop/quoting-service/commits/master)
[![Git Releases](https://img.shields.io/github/release/mojaloop/quoting-service.svg?style=flat)](https://github.com/mojaloop/quoting-service/releases)
[![Docker pulls](https://img.shields.io/docker/pulls/mojaloop/quoting-service.svg?style=flat)](https://hub.docker.com/r/mojaloop/quoting-service)
[![CircleCI](https://circleci.com/gh/mojaloop/quoting-service.svg?style=svg)](https://circleci.com/gh/mojaloop/quoting-service)

The Quoting Service was donated by the Mowali project working in collaboration with Orange and MTN. 
The Quoting service is now part of the Mojaloop project and deployment.

The service provided by the API resource /quotes is calculation of possible fees and FSP commission involved in performing an interoperable financial transaction. 
Both the Payer and Payee FSP should calculate their part of the quote to be able to get a total view of all the fees and FSP commission involved in the transaction.

### Contents:

- [Services Sequence overview](#services-sequence-overview)
- [Local Deployment](#local-deployment)

## Services Sequence overview

![Quoting Service Sequence diagram](diagrams/quotingServiceSequences.svg)

* [Quoting Service Sequence diagram](diagrams/quotingServiceSequences.puml)

## Local Deployment

Please follow the instruction in [Onboarding Document](onboarding.md) to setup and run the service locally.

## Auditing Dependencies

We use `npm-audit-resolver` along with `npm audit` to check dependencies for vulnerabilities, and keep track of resolved dependencies with an `audit-resolv.json` file.

To start a new resolution process, run:
```bash
npm run audit:resolve
```

You can then check to see if the CI will pass based on the current dependencies with:
```bash
npm run audit:check
```

And commit the changed `audit-resolv.json` to ensure that CircleCI will build correctly.