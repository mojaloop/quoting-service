#!/bin/bash

if ! command -v docker-compose &> /dev/null
then
    echo "docker-compose could not be found. Please install it."
    exit 1
fi

echo "Starting docker-compose..."
docker-compose up -d

echo "Services started. Checking status..."
docker-compose ps

pwd
SCRIPTS_FOLDER=./test/integration/scripts

echo "Loading env vars..."
source $SCRIPTS_FOLDER/env.sh

echo "Waiting central-ledger migrations for $MIGRATION_TIMEOUT sec..."
sleep $MIGRATION_TIMEOUT

echo "Populating test data..."
source $SCRIPTS_FOLDER/populateTestData.sh

echo "Test environment is ready!"

