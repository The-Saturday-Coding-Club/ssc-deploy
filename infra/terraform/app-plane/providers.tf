terraform {
  required_version = ">= 1.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Backend configured via -backend-config during init
  # This enables per-app state isolation
  backend "s3" {
    bucket         = "cloud-deployer-tf-state"
    region         = "eu-west-1"
    dynamodb_table = "terraform-locks"
    encrypt        = true
    # key is passed dynamically: -backend-config="key=app-plane/{app_id}/terraform.tfstate"
  }
}

provider "aws" {
  region = var.aws_region
}
