output "api_gateway_url" {
  description = "The URL of the API Gateway"
  value       = aws_apigatewayv2_api.http_api.api_endpoint
}

output "lambda_arn" {
  description = "The ARN of the Lambda function"
  value       = aws_lambda_function.app.arn
}
