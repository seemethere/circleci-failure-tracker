#!/bin/bash -xe


cd refresh-grid-view

./generate_credentials_module.py

sam build
sam package --output-template packaged.yaml --s3-bucket drci-lambda-artifacts
sam deploy --template-file packaged.yaml --region us-east-2 --capabilities CAPABILITY_IAM --stack-name aws-sam-getting-started

