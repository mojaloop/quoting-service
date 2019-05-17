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
## Configuration

Configuration is maintained in the [default.json](./config/default.json).

## Initialising the database and starting the service

The database table was already created by the Central-Ledger services at startup.

Before starting the quoting-service, insure the mock service is still running as described in [onboarding guide](https://github.com/mojaloop/central-ledger/blob/master/Onboarding.md)

Run the below from the root quoting-service in your terminal session to start the quoting service;

```bash
npm start
```

## Run Tests

Please refer to Central-Ledger repository to setup Postman.

Postman is used to generate quotes via the quoting-service.
