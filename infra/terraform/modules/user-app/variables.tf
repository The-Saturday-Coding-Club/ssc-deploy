variable "app_id" {
  description = "Unique identifier for the application"
  type        = string
}

variable "lambda_zip_path" {
  description = "Path to the Lambda function deployment package"
  type        = string
}

variable "environment_vars" {
  description = "Environment variables for the Lambda function"
  type        = map(string)
  default     = {}
}

variable "retention_in_days" {
  description = "CloudWatch log retention in days"
  type        = number
  default     = 1
}
