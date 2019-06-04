# Onboarding

>*Note:* Before completing this guide, make sure you have completed the _general_ onboarding guide in the [base mojaloop repository](https://github.com/mojaloop/mojaloop/blob/master/onboarding.md#mojaloop-onboarding).

## Contents

<!-- vscode-markdown-toc -->
1. [Prerequisites](#Prerequisites)
2. [Installing and Building](#InstallingandBuilding)
3. [Running Locally](#RunningLocally)
4. [Running Inside Docker](#RunningInsideDocker)
5. [Testing](#Testing)
6. [Common Errors/FAQs](#CommonErrorsFAQs)

<!-- vscode-markdown-toc-config
	numbering=true
	autoSave=true
	/vscode-markdown-toc-config -->
<!-- /vscode-markdown-toc -->


#  1. <a name='Prerequisites'></a>Prerequisites

If you have followed the [general onboarding guide](https://github.com/mojaloop/mojaloop/blob/master/onboarding.md#mojaloop-onboarding), you should already have the following cli tools installed:

* `brew` (macOS), [todo: windows package manager]
* `curl`, `wget`
* `docker` + `docker-compose`
* `node`, `npm` and (optionally) `nvm`

In addition to the above cli tools, you will need to install the following to build and run the `quoting-service`:


###  1.1. <a name='macOS'></a>macOS
```bash
#none - you have everything you need!
```

###  1.2. <a name='Linux'></a>Linux

[todo]

###  1.3. <a name='Windows'></a>Windows

[todo]


##  2. <a name='InstallingandBuilding'></a>Installing and Building

Firstly, clone your fork of the `quoting-service` onto your local machine:
```bash
git clone https://github.com/<your_username>/quoting-service.git
```

Then `cd` into the directory and install the node modules:
```bash
cd quoting-service
npm install
```

> If you run into problems running `npm install`, make sure to check out the [Common Errors/FAQs](#CommonErrorsFAQs) below.


## 3. <a name='RunningLocally'></a>Running Locally (with dependencies inside of docker)

In this method, we will run all of the dependencies inside of docker containers, while running the `quoting-service` server on your local machine.

> Alternatively, you can run the `quoting-service` inside of `docker-compose` with the rest of the dependencies to make the setup a little easier: [Running Inside Docker](#RunningInsideDocker).


**1. Set up the MySQL container, and give it time to initialize**
>*Note:* Before starting all of the containers, start the `mysql` container alone, to give it some more time to set up the necessary permissions (this only needs to be done once, or every time you remove and re-create the container). 

```bash
docker-compose -f docker-compose.base.yml up mysql
```

**2. Run all of the dependencies in `docker-compose`:**

```bash
# start all the dependencies inside of docker - these services are defined in docker-compose.base.yml
docker-compose -f docker-compose.base.yml up

```

**3. Configure the default files and run the server**
```bash
# (optional) edit the default config in config/default.json

# start the server
npm run start
```

<!-- **4. Populate the test database**
```bash
./test/util/scripts/populateTestData.sh
``` -->

Upon running `npm run start`, your output should look similar to:

```bash
> quoting-service@6.3.0 start <path_to>/quoting-service
> node src/server.js

2019-06-04T11:06:56Z, [log,info] data: Server running on http://0.0.0.0:3002
```

**4. Verify the quoting-service is running with the health check**

Hit the health check endpoint to verify the server is up and running:

```bash
curl localhost:3002/health
```

You should see the following:
```bash
{"status":"OK"}
```


##  4. <a name='RunningInsideDocker'></a>Running Inside Docker

We use `docker-compose` to manage and run the `quoting-service` along with its dependencies with one command.

>*Note:* Before starting all of the containers however, start the `mysql` container alone, to give it some more time to set up the necessary permissions (this only needs to be done once). This is a short-term workaround because the `central-ledger` doesn't retry it's connection to MySQL.


**1. First run the mysql container, then run the test of the containers**
```bash
docker-compose -f docker-compose.base.yml up mysql #first time only - the initial mysql load takes a while, and if it's not up in time, the central-ledger will just crash

npm run docker:up
```

This will do the following:
* `docker pull` down any dependencies defined in the `docker-compose.yml` file
* `docker build` the `central-ledger` image based on the `Dockerfile` defined in this repo
* run all of the containers together






# Running Quoting Service Locally

This document is intended to guide a user through the steps required to run the quoting service locally.

## Prerequisites

Setup the Central Ledger servers as per the [onboarding guide](https://github.com/mojaloop/central-ledger/blob/master/Onboarding.md).

## Introduction

In this document we'll walk through the setup a local Mojaloop Quoting Service and starting the services. It consists of three sections:

- [Software List](#software-list)
- [Setting up a local quote environment](#setting-up-a-local-quote-environment)
- [Initialising the database and starting the service](#initialising-the-database-and-starting-the-service)
- [Health Check](#health-check)
- [Run Tests](#run-tests)



## Health check

To verify the database is connected once the server started, run this from your browser;
```
http://localserver:3002/health
```

If all is well, the following responce will be received'

**Quoting service Database connection is healthy!!!**

## Run Tests

Please refer to Central-Ledger repository to setup Postman.

Postman is used to generate quotes via the quoting-service.
