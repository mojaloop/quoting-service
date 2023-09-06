# Onboarding

>*Note:* Before completing this guide, make sure you have completed the _general_ onboarding guide in the [base mojaloop repository](https://github.com/mojaloop/mojaloop/blob/main/onboarding.md#mojaloop-onboarding).

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

If you have followed the [general onboarding guide](https://github.com/mojaloop/mojaloop/blob/main/onboarding.md#mojaloop-onboarding), you should already have the following cli tools installed:

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
* `docker build` the `quoting-service` image based on the `Dockerfile` defined in this repo
* run all of the containers together

### 4.1 Handy Docker Compose Tips

You can run `docker-compose` in 'detached' mode as follows:

```bash
npm run docker:up -- -d
```

And then attach to the logs with:
```bash
docker-compose logs -f
```

When you're done, don't forget to stop your containers however:
```bash
npm run docker:stop
```

##  5. <a name='Testing'></a>Testing

We use `npm` scripts as a common entrypoint for running the tests.
```bash
# unit tests
npm run test

# check test coverage
npm run cover
```

### 5.1 Testing the `quoting-service` API with Postman

Refer to the [central-ledger onboarding guide](https://github.com/mojaloop/central-ledger/blob/main/Onboarding.md#51-testing-the-central-ledger-api-with-postman) to test the `quoting-service` using postman.

>Note: Before running the postman scripts, ensure you have populated the test data using the `test/util/scripts/populateTestData.sh` in the `central-ledger` directory. For more information, follow the [Running `central-ledger` Inside Docker](https://github.com/mojaloop/central-ledger/blob/main/Onboarding.md#4-running-inside-docker) guide


##  6. <a name='CommonErrorsFAQs'></a>Common Errors/FAQs

#### 6.1 `sodium v1.2.3` can't compile during npm install

Resolved by installing v2.0.3 `npm install sodium@2.0.3`


#### 6.2 `./src/argon2_node.cpp:6:10: fatal error: 'tuple' file not found` 

Resolved by running `CXX='clang++ -std=c++11 -stdlib=libc++' npm rebuild`


#### 6.3 On macOS, `npm install` fails with the following error
```
Undefined symbols for architecture x86_64:
  "_CRYPTO_cleanup_all_ex_data", referenced from:
      _rd_kafka_transport_ssl_term in rdkafka_transport.o
  "_CRYPTO_num_locks", referenced from:
  ........
  ld: symbol(s) not found for architecture x86_64
clang: error: linker command failed with exit code 1 (use -v to see invocation) 
```

Resolved by installing openssl `brew install openssl` and then running: 
  ```bash
  export CFLAGS=-I/usr/local/opt/openssl/include 
  export LDFLAGS=-L/usr/local/opt/openssl/lib 
  npm install
  ```  