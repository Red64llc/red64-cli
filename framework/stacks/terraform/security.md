# Terraform Security

Security considerations and best practices for Terraform-managed infrastructure.

---

## Philosophy

- **Security by default**: Secure configurations should be the easiest path
- **Principle of least privilege**: Minimal permissions for Terraform and resources
- **Defense in depth**: Multiple layers of security controls
- **Shift left**: Catch security issues before deployment

---

## Secret Management

### Never Store Secrets in Configuration

```hcl
# BAD: Hardcoded secrets
resource "aws_db_instance" "main" {
  password = "SuperSecret123!"  # Exposed in state file
}

variable "db_password" {
  default = "SuperSecret123!"  # Committed to git
}

# GOOD: External secret management
data "aws_secretsmanager_secret_version" "db" {
  secret_id = "prod/database/master-password"
}

resource "aws_db_instance" "main" {
  password = data.aws_secretsmanager_secret_version.db.secret_string
}
```

### Use Environment Variables

```bash
# Pass secrets via environment
export TF_VAR_db_password="$(aws secretsmanager get-secret-value ...)"
terraform apply

# Or use .env file (not committed)
# .env
TF_VAR_db_password=secret-from-vault
```

### Generate Secrets with Terraform

```hcl
# Generate and store in secrets manager
resource "random_password" "db" {
  length           = 32
  special          = true
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

resource "aws_secretsmanager_secret" "db_password" {
  name = "prod/database/master-password"
}

resource "aws_secretsmanager_secret_version" "db_password" {
  secret_id     = aws_secretsmanager_secret.db_password.id
  secret_string = random_password.db.result
}

# Reference in database
resource "aws_db_instance" "main" {
  password = random_password.db.result
}
```

### Mark Sensitive Values

```hcl
variable "api_key" {
  description = "API key for external service"
  type        = string
  sensitive   = true  # Hides from plan output
}

output "database_password" {
  value     = random_password.db.result
  sensitive = true  # Hides from output
}
```

---

## State File Security

### Encrypt State at Rest

```hcl
# S3 backend with encryption
terraform {
  backend "s3" {
    bucket     = "company-terraform-state"
    key        = "project/terraform.tfstate"
    region     = "us-east-1"
    encrypt    = true
    kms_key_id = "arn:aws:kms:us-east-1:111122223333:key/..."
  }
}
```

### Restrict State Access

```hcl
# IAM policy for state bucket access
data "aws_iam_policy_document" "terraform_state" {
  statement {
    effect = "Allow"
    actions = [
      "s3:GetObject",
      "s3:PutObject",
      "s3:DeleteObject"
    ]
    resources = ["arn:aws:s3:::terraform-state/project/*"]
  }

  statement {
    effect = "Allow"
    actions = [
      "dynamodb:GetItem",
      "dynamodb:PutItem",
      "dynamodb:DeleteItem"
    ]
    resources = ["arn:aws:dynamodb:*:*:table/terraform-locks"]
  }
}
```

### State Contains Sensitive Data

```
# State file includes:
# - Resource arguments (including passwords, keys)
# - Resource attributes (connection strings, endpoints)
# - Outputs (even if not marked sensitive in config)

# ALWAYS:
# - Use remote backend with encryption
# - Restrict access to state bucket/container
# - Never commit state to git
# - Audit state access
```

---

## IAM for Terraform

### Separate Roles for Plan and Apply

```hcl
# Read-only role for plan operations
resource "aws_iam_role" "terraform_plan" {
  name = "terraform-plan"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        AWS = var.ci_role_arn
      }
      Condition = {
        StringEquals = {
          "aws:PrincipalTag/terraform-operation" = "plan"
        }
      }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "terraform_plan_readonly" {
  role       = aws_iam_role.terraform_plan.name
  policy_arn = "arn:aws:iam::aws:policy/ReadOnlyAccess"
}

# Write role for apply operations
resource "aws_iam_role" "terraform_apply" {
  name = "terraform-apply"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        AWS = var.ci_role_arn
      }
      Condition = {
        StringEquals = {
          "iam:ResourceTag/terraform-managed" = "true"
        }
      }
    }]
  })
}
```

### Scope Permissions to Managed Resources

```hcl
# Policy that only allows actions on Terraform-tagged resources
data "aws_iam_policy_document" "terraform_apply" {
  statement {
    effect = "Allow"
    actions = [
      "ec2:*",
      "rds:*",
      "s3:*"
    ]
    resources = ["*"]
    condition {
      test     = "StringEquals"
      variable = "aws:ResourceTag/ManagedBy"
      values   = ["terraform"]
    }
  }

  # Allow creating resources (can't check tags on non-existent resources)
  statement {
    effect = "Allow"
    actions = [
      "ec2:RunInstances",
      "ec2:CreateVpc",
      "rds:CreateDBInstance"
    ]
    resources = ["*"]
    condition {
      test     = "StringEquals"
      variable = "aws:RequestTag/ManagedBy"
      values   = ["terraform"]
    }
  }
}
```

---

## Security Scanning

### Static Analysis with tfsec

```bash
# Install
brew install tfsec

# Scan current directory
tfsec .

# Scan with custom checks
tfsec . --config-file=.tfsec/config.yml

# CI integration
tfsec . --format=json --out=tfsec-results.json
```

### Policy as Code with Checkov

```bash
# Install
pip install checkov

# Scan Terraform files
checkov -d .

# Scan specific framework
checkov -d . --framework terraform

# Skip specific checks
checkov -d . --skip-check CKV_AWS_20,CKV_AWS_21

# Custom policies
checkov -d . --external-checks-dir ./custom-policies
```

### OPA/Conftest for Custom Policies

```rego
# policy/terraform.rego
package main

deny[msg] {
  resource := input.resource.aws_s3_bucket[name]
  not resource.server_side_encryption_configuration
  msg := sprintf("S3 bucket '%s' must have encryption enabled", [name])
}

deny[msg] {
  resource := input.resource.aws_security_group[name]
  rule := resource.ingress[_]
  rule.cidr_blocks[_] == "0.0.0.0/0"
  rule.from_port <= 22
  rule.to_port >= 22
  msg := sprintf("Security group '%s' allows SSH from the internet", [name])
}
```

```bash
# Run conftest
conftest test main.tf
```

---

## Secure Resource Configurations

### S3 Buckets

```hcl
resource "aws_s3_bucket" "data" {
  bucket = "company-data-bucket"
}

# Block public access
resource "aws_s3_bucket_public_access_block" "data" {
  bucket = aws_s3_bucket.data.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Enable encryption
resource "aws_s3_bucket_server_side_encryption_configuration" "data" {
  bucket = aws_s3_bucket.data.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = aws_kms_key.s3.arn
    }
    bucket_key_enabled = true
  }
}

# Enable versioning
resource "aws_s3_bucket_versioning" "data" {
  bucket = aws_s3_bucket.data.id
  versioning_configuration {
    status = "Enabled"
  }
}

# Require TLS
resource "aws_s3_bucket_policy" "data" {
  bucket = aws_s3_bucket.data.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Deny"
      Principal = "*"
      Action    = "s3:*"
      Resource = [
        aws_s3_bucket.data.arn,
        "${aws_s3_bucket.data.arn}/*"
      ]
      Condition = {
        Bool = {
          "aws:SecureTransport" = "false"
        }
      }
    }]
  })
}
```

### Security Groups

```hcl
# GOOD: Restrictive security group
resource "aws_security_group" "app" {
  name   = "app-sg"
  vpc_id = var.vpc_id

  # Only allow traffic from load balancer
  ingress {
    from_port       = 8080
    to_port         = 8080
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
    description     = "Allow traffic from ALB"
  }

  # Restrict egress to necessary destinations
  egress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = [var.vpc_cidr]  # Internal only
    description = "HTTPS to internal services"
  }

  egress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.database.id]
    description     = "PostgreSQL to database"
  }
}

# BAD: Overly permissive
resource "aws_security_group" "bad_example" {
  ingress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]  # Open to the world
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]  # Unrestricted outbound
  }
}
```

### RDS Databases

```hcl
resource "aws_db_instance" "main" {
  identifier = "production-db"

  # Security settings
  storage_encrypted   = true
  kms_key_id          = aws_kms_key.rds.arn
  publicly_accessible = false

  # Network isolation
  db_subnet_group_name   = aws_db_subnet_group.private.name
  vpc_security_group_ids = [aws_security_group.database.id]

  # Authentication
  iam_database_authentication_enabled = true

  # Monitoring and audit
  enabled_cloudwatch_logs_exports = ["audit", "error", "general", "slowquery"]

  # Backup and recovery
  backup_retention_period = 30
  deletion_protection     = true

  # Prevent accidental destroy
  lifecycle {
    prevent_destroy = true
  }
}
```

---

## CI/CD Security

### Secure Pipeline Configuration

```yaml
# .github/workflows/terraform.yml
name: Terraform

on:
  pull_request:
  push:
    branches: [main]

permissions:
  id-token: write  # For OIDC
  contents: read
  pull-requests: write

jobs:
  terraform:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ secrets.AWS_ROLE_ARN }}
          aws-region: us-east-1

      - name: Setup Terraform
        uses: hashicorp/setup-terraform@v3
        with:
          terraform_version: 1.6.0

      - name: Security scan
        run: |
          tfsec . --soft-fail
          checkov -d . --soft-fail

      - name: Terraform Plan
        run: terraform plan -out=tfplan -no-color
        env:
          TF_VAR_sensitive_value: ${{ secrets.SENSITIVE_VALUE }}

      # Apply only on main branch, with approval
      - name: Terraform Apply
        if: github.ref == 'refs/heads/main' && github.event_name == 'push'
        run: terraform apply -auto-approve tfplan
```

### OIDC Authentication (No Long-Lived Credentials)

```hcl
# GitHub Actions OIDC provider
resource "aws_iam_openid_connect_provider" "github" {
  url = "https://token.actions.githubusercontent.com"

  client_id_list = ["sts.amazonaws.com"]

  thumbprint_list = [
    "6938fd4d98bab03faadb97b34396831e3780aea1"
  ]
}

# Role for GitHub Actions
resource "aws_iam_role" "github_actions" {
  name = "github-actions-terraform"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = {
        Federated = aws_iam_openid_connect_provider.github.arn
      }
      Action = "sts:AssumeRoleWithWebIdentity"
      Condition = {
        StringEquals = {
          "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
        }
        StringLike = {
          "token.actions.githubusercontent.com:sub" = "repo:my-org/my-repo:*"
        }
      }
    }]
  })
}
```

---

## Security Checklist

| Area | Check |
|------|-------|
| **Secrets** | No hardcoded secrets in .tf files |
| **Secrets** | Sensitive variables marked `sensitive = true` |
| **Secrets** | Secrets stored in external manager (Vault, ASM, etc.) |
| **State** | Remote backend with encryption enabled |
| **State** | State bucket access restricted by IAM |
| **State** | State versioning enabled for recovery |
| **IAM** | Separate roles for plan vs apply |
| **IAM** | Permissions scoped to managed resources |
| **IAM** | OIDC for CI/CD (no long-lived credentials) |
| **Resources** | S3 buckets: encryption, no public access |
| **Resources** | Security groups: no 0.0.0.0/0 ingress |
| **Resources** | Databases: encrypted, not public, IAM auth |
| **Pipeline** | Security scanning (tfsec, checkov) in CI |
| **Pipeline** | Plan review before apply |
| **Pipeline** | Approval gates for production |

---

_Security is not a feature; it's a requirement. Build it in from the start._
