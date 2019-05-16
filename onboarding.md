# Running Quoting Service Locally

This document is intended to guide a user through the steps required to run the quoting service locally.

## Prerequisites

Setup the Central Ledger servers as per the [onboarding guide](https://github.com/mojaloop/central-ledger/blob/master/Onboarding.md).

## Introduction

In this document we'll walk through the setup a local Mojaloop Quoting Service and starting the services. It consists of three sections:

- [Software List](#software-list)
- [Setting up a local quote environment](#setting-up-a-local-quote-environment)
- [Initialising the database and starting the service](#initialising-the-database-and-starting-the-service)
- [Run Tests](#run-tests)

## Software List
Github
Docker
MySQLWorkbench
Postman
nvm
npm
central_ledger
quoting_service
JavaScript IDE

## Setting up a local quote environment

Make sure you are able to access quoting service on github and clone the service.

Open a terminal session and navigate to the project. 
In the quoting-service project root, install NMP (at the time of publish node v8.9.4 is the installation version);
```bash 
install npm 
```

## Initialising the database and starting the service

Create the database table by executing [create-quoting-service-entities](create-quoting-service-entities.sql) script in MySQLWorkbench. 

Before starting the quoting-service, insure the mock service is still running as described in [onboarding guide](https://github.com/mojaloop/central-ledger/blob/master/Onboarding.md)

Run the following in your terminal session to connect to the database and start the quoting service;

```bash
DATABASE_HOST=localhost DATABASE_USER=central_ledger DATABASE_PASSWORD=password node server.js
```

## Run Tests

Use Postman or similar to make calls to the quoting service API:

Details of the API exposed by the quoting service is available as swagger yaml in the github here:

```
https://github.com/mojaloop/quoting-service/blob/master/config/fspiop-rest-v1.0-OpenAPI-implementation-quoting.yaml
```
