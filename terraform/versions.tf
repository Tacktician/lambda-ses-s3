terraform {
    required_version = "~> 1.5.2"
    required_providers {
        aws = {
            version = "~> 5.9.0"
        }
    }
}

provider "aws" {
    region = "us-east-1"
}