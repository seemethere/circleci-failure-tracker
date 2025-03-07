#!/bin/bash -xe

REPO_ROOT_DIR=..
DB_CREDENTIALS_JSON_PATH=$REPO_ROOT_DIR/../circleci-failure-tracker-credentials/database-credentials-remote.json

DB_USERNAME=$(jq -r '.["db-user"]' $DB_CREDENTIALS_JSON_PATH)
DB_PASSWORD=$(jq -r '.["db-password"]' $DB_CREDENTIALS_JSON_PATH)
DB_HOSTNAME=$(jq -r '.["db-hostname"]' $DB_CREDENTIALS_JSON_PATH)


stack build --fast
stack exec run-scanner -- --count 5 --branch master --db-username $DB_USERNAME --db-password $DB_PASSWORD --db-hostname $DB_HOSTNAME 2>&1 | tee mylog.txt
