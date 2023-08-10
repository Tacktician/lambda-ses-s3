data "archive_file" "lambda_zip" {
  type        = "zip"
  source_file = "bin/main"
  output_path = "bin/main.zip"
}

resource "aws_lambda_function" "lambda_function" {
  function_name = var.function_name
  role          = var.role_arn
  handler       = "main"
  filename      = data.archive_file.lambda_zip.output_path
  runtime       = "go1.x"
  source_code_hash = var.source_hash
  memory_size   = 128
  package_type  = "Zip"
  timeout       = 3

  environment {
    variables = {
      FORWARD_AS_EMAIL    = var.forward_as_email
      FORWARD_AS_NAME     = var.forward_as_name
      FORWARD_BOUNCE_PATH = var.bounce_path
      FORWARD_TO_EMAIL    = var.forward_to_email
      FORWARD_TO_NAME     = var.forward_to_name
      MAIL_BUCKET         = var.s3_bucket
    }
  }

  ephemeral_storage {
    size = 512
  }

  tracing_config {
    mode = "PassThrough"
  }
}
