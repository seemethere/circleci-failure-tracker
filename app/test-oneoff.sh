#!/bin/bash -xe

REPO_ROOT_DIR=..

DB_PASSWORD=$(jq -r '.["db-password"]' $REPO_ROOT_DIR/../circleci-failure-tracker-credentials/database-credentials-remote.json)
DB_HOSTNAME=$(jq -r '.["db-hostname"]' $REPO_ROOT_DIR/../circleci-failure-tracker-credentials/database-credentials-remote.json)
PERSONAL_ACCESS_TOKEN=$(cat $REPO_ROOT_DIR/../circleci-failure-tracker-credentials/github-personal-access-token.txt)

stack build --fast
stack exec scan-oneoff -- --db-password $DB_PASSWORD --db-hostname $DB_HOSTNAME --github-personal-access-token $PERSONAL_ACCESS_TOKEN --repo-git-dir $HOME/github/pytorch-repos/pytorch/.git 2>&1 | tee mylog.txt
