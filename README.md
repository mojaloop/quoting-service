# Quoting Service

[![Git Commit](https://img.shields.io/github/last-commit/mojaloop/quoting-service.svg?style=flat)](https://github.com/mojaloop/quoting-service/commits/master)
[![Git Releases](https://img.shields.io/github/release/mojaloop/quoting-service.svg?style=flat)](https://github.com/mojaloop/quoting-service/releases)
[![Docker pulls](https://img.shields.io/docker/pulls/mojaloop/quoting-service.svg?style=flat)](https://hub.docker.com/r/mojaloop/quoting-service)
[![CircleCI](https://circleci.com/gh/mojaloop/quoting-service.svg?style=svg)](https://app.circleci.com/pipelines/github/mojaloop/quoting-service)

The Quoting Service was donated by the Mowali project working in collaboration with Orange and MTN. The original author of this service is James Bush (james.bush@modusbox.com).

The Quoting service is now part of the Mojaloop project and deployment.

The service provided by the API resource /quotes is calculation of possible fees and FSP commission involved in performing an interoperable financial transaction.
Both the Payer and Payee FSP should calculate their part of the quote to be able to get a total view of all the fees and FSP commission involved in the transaction.

## Contents

- [Quoting Service](#quoting-service)
  - [Contents](#contents)
  - [Services Sequence overview](#services-sequence-overview)
  - [Running Locally](#running-locally)
  - [Auditing Dependencies](#auditing-dependencies)
  - [Container Scans](#container-scans)
  - [Automated Releases](#automated-releases)
    - [Potential problems](#potential-problems)
  - [Additional Notes](#additional-notes)

## Services Sequence overview

![Quoting Service Sequence diagram](diagrams/quotingServiceSequences.svg)

> [Quoting Service Sequence diagram](diagrams/quotingServiceSequences.puml)

## Running Locally

Please follow the instruction in [Onboarding Document](onboarding.md) to setup and run the service locally.

## Auditing Dependencies

We use `npm-audit-resolver` along with `npm audit` to check dependencies for node vulnerabilities, and keep track of resolved dependencies with an `audit-resolve.json` file.

To start a new resolution process, run:

```bash
npm run audit:resolve
```

You can then check to see if the CI will pass based on the current dependencies with:

```bash
npm run audit:check
```

And commit the changed `audit-resolve.json` to ensure that CircleCI will build correctly.

## Container Scans

As part of our CI/CD process, we use anchore-cli to scan our built docker container for vulnerabilities upon release.

If you find your release builds are failing, refer to the [container scanning](https://github.com/mojaloop/ci-config#container-scanning) in our shared Mojaloop CI config repo. There is a good chance you simply need to update the `mojaloop-policy-generator.js` file and re-run the circleci workflow.

For more information on anchore and anchore-cli, refer to:

- [Anchore CLI](https://github.com/anchore/anchore-cli)
- [Circle Orb Registry](https://circleci.com/orbs/registry/orb/anchore/anchore-engine)

## Automated Releases

As part of our CI/CD process, we use a combination of CircleCI, standard-version
npm package and github-release CircleCI orb to automatically trigger our releases
and image builds. This process essentially mimics a manual tag and release.

On a merge to master, CircleCI is configured to use the mojaloopci github account
to push the latest generated CHANGELOG and package version number.

Once those changes are pushed, CircleCI will pull the updated master, tag and
push a release triggering another subsequent build that also publishes a docker image.

### Potential problems

- There is a case where the merge to master workflow will resolve successfully, triggering
  a release. Then that tagged release workflow subsequently failing due to the image scan,
  audit check, vulnerability check or other "live" checks.

  This will leave master without an associated published build. Fixes that require
  a new merge will essentially cause a skip in version number or require a clean up
  of the master branch to the commit before the CHANGELOG and bump.

  This may be resolved by relying solely on the previous checks of the
  merge to master workflow to assume that our tagged release is of sound quality.
  We are still mulling over this solution since catching bugs/vulnerabilities/etc earlier
  is a boon.

- It is unknown if a race condition might occur with multiple merges with master in
  quick succession, but this is a suspected edge case.

## Additional Notes

N/A
