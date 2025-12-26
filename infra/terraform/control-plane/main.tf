terraform {
  required_version = ">= 1.0"
  
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
  
  backend "s3" {
    bucket         = "cloud-deployer-tf-state"
    key            = "control-plane/terraform.tfstate"
    region         = "eu-west-1"
    dynamodb_table = "terraform-locks"
    encrypt        = true
  }
}

provider "aws" {
  region = "eu-west-1"
}

variable "database_url" {
  type      = string
  sensitive = true
}

variable "github_token" {
  type      = string
  sensitive = true
}

variable "deployment_secret" {
  type      = string
  sensitive = true
  description = "Secret token for authenticating deployment status callbacks from GitHub Actions"
}

variable "token_encryption_key" {
  type        = string
  sensitive   = true
  description = "AES-256 encryption key for user tokens (64 hex characters)"
}

variable "allowed_origins" {
  type        = string
  default     = "http://localhost:3000"
  description = "Comma-separated list of allowed CORS origins"
}

resource "aws_iam_role" "control_plane_lambda" {
  name = "cloud-deployer-control-plane-lambda"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "lambda.amazonaws.com"
      }
    }]
  })
}

resource "aws_iam_role_policy" "control_plane_lambda_policy" {
  role = aws_iam_role.control_plane_lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:eu-west-1:*:log-group:/aws/lambda/cloud-deployer-control-plane:*"
      },
      {
        Effect = "Allow"
        Action = [
          "iam:PassRole"
        ]
        Resource = "*"
      }
    ]
  })
}

resource "aws_cloudwatch_log_group" "control_plane" {
  name              = "/aws/lambda/cloud-deployer-control-plane"
  retention_in_days = 3
}

resource "aws_lambda_function" "control_plane" {
  function_name = "cloud-deployer-control-plane"
  role          = aws_iam_role.control_plane_lambda.arn
  
  filename         = "api.zip"
  source_code_hash = filebase64sha256("api.zip")
  
  handler     = "index.handler"
  runtime     = "nodejs20.x"
  timeout     = 30
  memory_size = 512

  environment {
    variables = {
      DATABASE_URL         = var.database_url
      GITHUB_TOKEN         = var.github_token
      DEPLOYMENT_SECRET    = var.deployment_secret
      TOKEN_ENCRYPTION_KEY = var.token_encryption_key
      ALLOWED_ORIGINS      = var.allowed_origins
    }
  }

  depends_on = [aws_cloudwatch_log_group.control_plane]
}

resource "aws_apigatewayv2_api" "control_plane" {
  name          = "cloud-deployer-api"
  protocol_type = "HTTP"
}

resource "aws_apigatewayv2_integration" "lambda" {
  api_id           = aws_apigatewayv2_api.control_plane.id
  integration_type = "AWS_PROXY"
  
  integration_uri    = aws_lambda_function.control_plane.invoke_arn
  integration_method = "POST"
}

resource "aws_apigatewayv2_route" "proxy" {
  api_id    = aws_apigatewayv2_api.control_plane.id
  route_key = "ANY /{proxy+}"
  target    = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

resource "aws_apigatewayv2_route" "auth" {
  api_id    = aws_apigatewayv2_api.control_plane.id
  route_key = "ANY /auth/{proxy+}"
  target    = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

resource "aws_apigatewayv2_route" "apps" {
  api_id    = aws_apigatewayv2_api.control_plane.id
  route_key = "ANY /apps/{proxy+}"
  target    = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

resource "aws_apigatewayv2_route" "deployments" {
  api_id    = aws_apigatewayv2_api.control_plane.id
  route_key = "ANY /deployments/{proxy+}"
  target    = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

resource "aws_apigatewayv2_route" "user" {
  api_id    = aws_apigatewayv2_api.control_plane.id
  route_key = "ANY /user/{proxy+}"
  target    = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.control_plane.id
  name        = "$default"
  auto_deploy = true
}

resource "aws_lambda_permission" "api_gateway" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.control_plane.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.control_plane.execution_arn}/*/*"
}

output "api_endpoint" {
  value = aws_apigatewayv2_api.control_plane.api_endpoint
}