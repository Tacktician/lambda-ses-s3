# Email Forwarding Lambda Function - WIP

> Note: inspired by [this post](https://brunoscheufler.com/blog/2020-08-28-forwarding-emails-with-ses)

This repository provides Lambda functions to forward incoming emails from Amazon SES to another email address while performing necessary modifications to the email content.

## Overview

These Lambda functions leverage AWS services like Amazon S3 and Amazon SES to process incoming emails and forward them to a specified email address. The provided scripts utilize the AWS SDK for Python (Boto3), Node.js (AWS SDK), and Golang (AWS SDK) to interact with AWS services.

## Features

- Forwards incoming emails from Amazon SES.
- Modifies the email content, sender, and recipient as specified in the configuration.
- Deletes the processed email from the S3 bucket after forwarding.

## Prerequisites

- An AWS account and IAM user with appropriate permissions to create Lambda functions, access S3 buckets, and interact with SES.
- For Python: Python 3.x installed on your local machine.
- For Node.js: Node.js and npm installed on your local machine.

## Installation and Deployment

### Python Script

1. Clone this repository to your local machine.

2. Navigate to the Python directory and install the required Python packages using pip:

   ```bash
   pip install boto3
   pip install enmime

3. Rename `main.example.json` to `main.json` and provide the required configuration in the file.

`zip` the script and the `main.json` configuration file together:
   ```shell
   #TODO
   ```
5. Create a new Lambda function in the AWS Management Console:
   * Upload the `email_forwarding_lambda.zip` as the function code.
   * Set the runtime to Python 3.x.
   * Specify `main.handler` as the handler.
   * Configure the necessary environment variables in the Lambda function using the values from `main.json`.
   * Set up triggers for the Lambda function to be invoked by Amazon SES when new emails arrive.

### Node.js Script

1. Clone this repository to your local machine.
2. Navigate tot he nodeJs directory and install the required Node.js packages using npm:
   ```shell
   npm install
   ```
3. `zip` up the file:
   ```shell
   #TODO
   ```
4. Create the Lambda Function in the AWS console: #TODO

### Golang

1. Naviaget to the `go` directory and build the Go Package
```sh
cd source
env GOOS=linux GOARCH=amd64 go build -o ../terraform/bin/main
```
2. `zip` up the file and prepare for deployment
```shell
#TODO
```

## Terraform Deployment
```
#TODO
```