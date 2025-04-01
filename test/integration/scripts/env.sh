#!/bin/bash

DEFAULT_CONFIG_FILE="./docker/central-ledger/default.json"

export HUB_NAME=$(cat "$DEFAULT_CONFIG_FILE" | jq -r '.HUB_PARTICIPANT.NAME')

export MOCKSERVER_HOST=mock-hub
export MOCKSERVER_PORT=7777

export FSPList=("greenbank" "pinkbank" "redbankproxy" "orangebankproxy")
export DEFAULT_NET_DEBIT_CAP=1000
export CENTRAL_LEDGER_ADMIN_URI_PREFIX=http
export CENTRAL_LEDGER_ADMIN_HOST=127.0.0.1
export CENTRAL_LEDGER_ADMIN_PORT=3001
export CENTRAL_LEDGER_ADMIN_BASE=/

export MIGRATION_TIMEOUT=60
