variable "aws_region" {
  type    = string
  default = "eu-west-1"
}

variable "github_org" { type = string }
variable "github_repo" { type = string }

variable "role_name" {
  type    = string
  default = "github-actions-deployer"
}

# Branch restriction - use "*" to allow all branches
# Examples: "ref:refs/heads/main", "ref:refs/heads/*", "*"
variable "github_ref" {
  type    = string
  default = "*"
}