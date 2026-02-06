# Terraform Design Patterns

Proven patterns for organizing and structuring Terraform infrastructure code.

---

## Module Patterns

### Composition Pattern

Build complex infrastructure by composing smaller, focused modules.

```hcl
# Root module composes specialized modules
module "networking" {
  source = "./modules/networking"

  cidr_block         = "10.0.0.0/16"
  availability_zones = ["us-east-1a", "us-east-1b", "us-east-1c"]
}

module "database" {
  source = "./modules/database"

  vpc_id             = module.networking.vpc_id
  subnet_ids         = module.networking.private_subnet_ids
  security_group_ids = [module.networking.database_sg_id]
}

module "application" {
  source = "./modules/application"

  vpc_id              = module.networking.vpc_id
  subnet_ids          = module.networking.private_subnet_ids
  database_endpoint   = module.database.endpoint
  database_secret_arn = module.database.secret_arn
}
```

### Wrapper Module Pattern

Create organization-specific wrappers around public modules with preset defaults.

```hcl
# modules/company-vpc/main.tf
# Wraps terraform-aws-modules/vpc with company standards

module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "5.1.0"

  name = var.name
  cidr = var.cidr_block

  azs             = var.availability_zones
  private_subnets = var.private_subnet_cidrs
  public_subnets  = var.public_subnet_cidrs

  # Company standards enforced
  enable_nat_gateway     = true
  single_nat_gateway     = var.environment != "prod"
  enable_dns_hostnames   = true
  enable_dns_support     = true

  # Standard tagging
  tags = merge(var.tags, {
    ManagedBy   = "terraform"
    Environment = var.environment
  })
}
```

### Factory Pattern

Generate multiple similar resources from a configuration map.

```hcl
variable "services" {
  description = "Service definitions"
  type = map(object({
    cpu           = number
    memory        = number
    desired_count = number
    port          = number
  }))
  default = {
    api = {
      cpu           = 256
      memory        = 512
      desired_count = 2
      port          = 8080
    }
    worker = {
      cpu           = 512
      memory        = 1024
      desired_count = 1
      port          = 0
    }
  }
}

resource "aws_ecs_service" "services" {
  for_each = var.services

  name            = each.key
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.services[each.key].arn
  desired_count   = each.value.desired_count
  launch_type     = "FARGATE"

  dynamic "load_balancer" {
    for_each = each.value.port > 0 ? [1] : []
    content {
      target_group_arn = aws_lb_target_group.services[each.key].arn
      container_name   = each.key
      container_port   = each.value.port
    }
  }
}
```

---

## State Patterns

### State Isolation Pattern

Separate state files by risk and change frequency.

```
infrastructure/
  network/              # Rarely changes, high blast radius
    backend.tf          # Separate state
    main.tf
  shared-services/      # DNS, certificates, shared resources
    backend.tf
    main.tf
  applications/
    service-a/          # Frequent changes, isolated blast radius
      backend.tf
      main.tf
    service-b/
      backend.tf
      main.tf
```

### Remote State Data Source Pattern

Share data between isolated state files.

```hcl
# applications/service-a/main.tf

# Read outputs from network state
data "terraform_remote_state" "network" {
  backend = "s3"
  config = {
    bucket = "company-terraform-state"
    key    = "network/terraform.tfstate"
    region = "us-east-1"
  }
}

# Use network outputs
resource "aws_instance" "app" {
  subnet_id         = data.terraform_remote_state.network.outputs.private_subnet_ids[0]
  vpc_security_group_ids = [data.terraform_remote_state.network.outputs.app_security_group_id]
}
```

---

## Environment Patterns

### Directory-Per-Environment Pattern

Complete isolation between environments with shared modules.

```
modules/              # Reusable modules
  vpc/
  database/
  application/
environments/
  dev/
    main.tf           # module "vpc" { source = "../../modules/vpc" }
    variables.tf
    terraform.tfvars
    backend.tf        # dev state bucket
  staging/
    main.tf
    variables.tf
    terraform.tfvars
    backend.tf        # staging state bucket
  prod/
    main.tf
    variables.tf
    terraform.tfvars
    backend.tf        # prod state bucket (different account)
```

### Terragrunt DRY Pattern

Reduce duplication across environments using Terragrunt.

```hcl
# terragrunt.hcl (root)
remote_state {
  backend = "s3"
  generate = {
    path      = "backend.tf"
    if_exists = "overwrite"
  }
  config = {
    bucket         = "company-terraform-state"
    key            = "${path_relative_to_include()}/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "terraform-locks"
  }
}

# environments/prod/vpc/terragrunt.hcl
include "root" {
  path = find_in_parent_folders()
}

terraform {
  source = "../../../modules/vpc"
}

inputs = {
  environment = "prod"
  cidr_block  = "10.0.0.0/16"
}
```

---

## Security Patterns

### Least Privilege IAM Pattern

```hcl
# Separate roles for different operations
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
    }]
  })
}

# Read-only for plan
resource "aws_iam_role_policy_attachment" "plan_readonly" {
  role       = aws_iam_role.terraform_plan.name
  policy_arn = "arn:aws:iam::aws:policy/ReadOnlyAccess"
}

# Separate role for apply with write permissions
resource "aws_iam_role" "terraform_apply" {
  name = "terraform-apply"
  # ... with appropriate write permissions
}
```

### Secret Reference Pattern

Never store secrets in Terraform; reference external stores.

```hcl
# Reference secrets from AWS Secrets Manager
data "aws_secretsmanager_secret_version" "db_credentials" {
  secret_id = "prod/database/credentials"
}

locals {
  db_creds = jsondecode(data.aws_secretsmanager_secret_version.db_credentials.secret_string)
}

resource "aws_db_instance" "main" {
  username = local.db_creds["username"]
  password = local.db_creds["password"]
}

# Or use random generation with external storage
resource "random_password" "db" {
  length  = 32
  special = true
}

resource "aws_secretsmanager_secret_version" "db_password" {
  secret_id     = aws_secretsmanager_secret.db_password.id
  secret_string = random_password.db.result
}
```

---

## Resource Patterns

### Dynamic Block Pattern

Generate repeated nested blocks from collections.

```hcl
variable "ingress_rules" {
  type = list(object({
    port        = number
    protocol    = string
    cidr_blocks = list(string)
    description = string
  }))
  default = [
    { port = 443, protocol = "tcp", cidr_blocks = ["0.0.0.0/0"], description = "HTTPS" },
    { port = 80,  protocol = "tcp", cidr_blocks = ["0.0.0.0/0"], description = "HTTP" },
  ]
}

resource "aws_security_group" "web" {
  name   = "web-sg"
  vpc_id = var.vpc_id

  dynamic "ingress" {
    for_each = var.ingress_rules
    content {
      from_port   = ingress.value.port
      to_port     = ingress.value.port
      protocol    = ingress.value.protocol
      cidr_blocks = ingress.value.cidr_blocks
      description = ingress.value.description
    }
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}
```

### Conditional Resource Pattern

Create resources based on feature flags.

```hcl
variable "enable_monitoring" {
  description = "Enable CloudWatch monitoring"
  type        = bool
  default     = true
}

variable "enable_backup" {
  description = "Enable automated backups"
  type        = bool
  default     = true
}

# Conditionally create monitoring resources
resource "aws_cloudwatch_metric_alarm" "cpu" {
  count = var.enable_monitoring ? 1 : 0

  alarm_name          = "high-cpu-utilization"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "CPUUtilization"
  namespace           = "AWS/EC2"
  period              = 300
  statistic           = "Average"
  threshold           = 80
}

# Reference conditional resource safely
output "alarm_arn" {
  value = var.enable_monitoring ? aws_cloudwatch_metric_alarm.cpu[0].arn : null
}
```

### Tagging Strategy Pattern

Consistent tagging across all resources.

```hcl
# locals.tf
locals {
  common_tags = {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "terraform"
    Repository  = var.repository_url
    CostCenter  = var.cost_center
  }
}

# Use merge for resource-specific tags
resource "aws_instance" "app" {
  # ...

  tags = merge(local.common_tags, {
    Name = "${var.project_name}-${var.environment}-app"
    Role = "application"
  })
}

# Provider-level default tags (AWS provider 3.38+)
provider "aws" {
  region = var.region

  default_tags {
    tags = local.common_tags
  }
}
```

---

## Testing Patterns

### Native Test Pattern (Terraform 1.6+)

```hcl
# tests/vpc.tftest.hcl
run "vpc_creates_expected_subnets" {
  command = plan

  variables {
    cidr_block         = "10.0.0.0/16"
    availability_zones = ["us-east-1a", "us-east-1b"]
  }

  assert {
    condition     = length(aws_subnet.private) == 2
    error_message = "Expected 2 private subnets"
  }

  assert {
    condition     = aws_vpc.main.cidr_block == "10.0.0.0/16"
    error_message = "VPC CIDR block mismatch"
  }
}

run "vpc_integration" {
  command = apply

  assert {
    condition     = aws_vpc.main.id != ""
    error_message = "VPC was not created"
  }
}
```

---

## Pattern Summary

| Pattern | Use Case |
|---------|----------|
| **Composition** | Building complex infrastructure from simple modules |
| **Wrapper Module** | Enforcing organization standards on public modules |
| **Factory** | Creating multiple similar resources from config |
| **State Isolation** | Reducing blast radius, improving performance |
| **Remote State Data** | Sharing outputs between isolated configurations |
| **Directory-Per-Environment** | Complete environment isolation |
| **Least Privilege IAM** | Secure CI/CD for Terraform |
| **Secret Reference** | External secret management |
| **Dynamic Block** | Generating nested blocks from collections |
| **Conditional Resource** | Feature-flagged infrastructure |
| **Tagging Strategy** | Consistent resource metadata |
| **Native Testing** | Validating infrastructure behavior |

---

_Patterns are tools, not rules. Apply them where they add value._
