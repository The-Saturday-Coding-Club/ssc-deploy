module "user_app" {
  source = "../modules/user-app"

  app_id           = var.app_id
  lambda_zip_path  = var.lambda_zip_path
  environment_vars = var.environment_vars
}
