# Terraform Best Practices

Guidelines for writing maintainable, secure, and scalable Terraform configurations.

---

## Philosophy

- **Declarative over imperative**: Describe desired state, not steps to achieve it
- **Immutable infrastructure**: Replace rather than modify when practical
- **Version everything**: Configuration, modules, provider versions, state
- **Principle of least privilege**: Minimal permissions for both Terraform and resources
- **Fail fast**: Validate early, catch errors before apply

---

## Configuration Best Practices

### Use Consistent Naming

```hcl
# GOOD: Descriptive, consistent naming
resource "aws_instance" "api_server" {
  tags = {
    Name        = "${var.project}-${var.environment}-api"
    Environment = var.environment
    Project     = var.project
    ManagedBy   = "terraform"
  }
}

# BAD: Vague or inconsistent names
resource "aws_instance" "server1" {
  tags = {
    Name = "my server"
  }
}
```

### Pin Provider Versions

```hcl
# GOOD: Explicit version constraints
terraform {
  required_version = ">= 1.6.0, < 2.0.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"  # Allow 5.x updates
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.5"
    }
  }
}

# BAD: No version constraints
terraform {
  required_providers {
    aws = {
      source = "hashicorp/aws"
    }
  }
}
```

### Use Variables with Validation

```hcl
variable "environment" {
  description = "Deployment environment"
  type        = string

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be dev, staging, or prod."
  }
}

variable "instance_count" {
  description = "Number of instances to create"
  type        = number
  default     = 1

  validation {
    condition     = var.instance_count >= 1 && var.instance_count <= 10
    error_message = "Instance count must be between 1 and 10."
  }
}
```

### Define Outputs for Module Interfaces

```hcl
# outputs.tf
output "vpc_id" {
  description = "ID of the created VPC"
  value       = aws_vpc.main.id
}

output "private_subnet_ids" {
  description = "List of private subnet IDs"
  value       = aws_subnet.private[*].id
}

output "database_endpoint" {
  description = "RDS instance endpoint"
  value       = aws_db_instance.main.endpoint
  sensitive   = true  # Mark sensitive outputs
}
```

---

## Resource Best Practices

### Use `count` vs `for_each` Appropriately

```hcl
# Use for_each for resources with identity (preferred)
resource "aws_iam_user" "team" {
  for_each = toset(var.team_members)
  name     = each.value
}

# Use count for identical resources or conditional creation
resource "aws_instance" "worker" {
  count         = var.worker_count
  ami           = var.ami_id
  instance_type = var.instance_type
}

# Conditional resource creation
resource "aws_cloudwatch_log_group" "app" {
  count = var.enable_logging ? 1 : 0
  name  = "/app/${var.environment}"
}
```

### Use Data Sources for Existing Resources

```hcl
# Reference existing resources instead of hardcoding
data "aws_vpc" "existing" {
  filter {
    name   = "tag:Name"
    values = ["shared-vpc"]
  }
}

data "aws_ami" "amazon_linux" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["amzn2-ami-hvm-*-x86_64-gp2"]
  }
}

resource "aws_instance" "app" {
  ami           = data.aws_ami.amazon_linux.id
  subnet_id     = data.aws_vpc.existing.id
  instance_type = "t3.micro"
}
```

### Leverage `depends_on` Sparingly

```hcl
# GOOD: Explicit dependency when implicit doesn't work
resource "aws_iam_role_policy_attachment" "lambda" {
  role       = aws_iam_role.lambda.name
  policy_arn = aws_iam_policy.lambda.arn
}

resource "aws_lambda_function" "api" {
  function_name = "api-handler"
  role          = aws_iam_role.lambda.arn
  # ...

  # Only when truly necessary
  depends_on = [aws_iam_role_policy_attachment.lambda]
}

# BAD: Overusing depends_on when references suffice
resource "aws_instance" "app" {
  subnet_id = aws_subnet.main.id  # Implicit dependency
  depends_on = [aws_subnet.main]  # Redundant!
}
```

---

## State Best Practices

### Use Remote State with Locking

```hcl
# backend.tf
terraform {
  backend "s3" {
    bucket         = "company-terraform-state"
    key            = "project/environment/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "terraform-locks"
  }
}
```

### Separate State by Blast Radius

```
# GOOD: Isolated state files
infrastructure/
  network/        # VPC, subnets (rarely changes)
  database/       # RDS, ElastiCache (sensitive)
  compute/        # EC2, ECS (frequent changes)
  monitoring/     # CloudWatch, alerts

# BAD: Monolithic state
infrastructure/
  main.tf         # Everything in one state file
```

### Never Commit State Files

```gitignore
# .gitignore
*.tfstate
*.tfstate.*
*.tfvars       # May contain secrets
.terraform/
```

---

## Module Best Practices

### Design for Reusability

```hcl
# modules/vpc/variables.tf
variable "cidr_block" {
  description = "CIDR block for the VPC"
  type        = string
}

variable "availability_zones" {
  description = "List of AZs for subnet distribution"
  type        = list(string)
}

variable "enable_nat_gateway" {
  description = "Whether to create NAT gateways"
  type        = bool
  default     = true
}

variable "tags" {
  description = "Tags to apply to all resources"
  type        = map(string)
  default     = {}
}
```

### Document Modules Properly

```hcl
/**
 * # VPC Module
 *
 * Creates a VPC with public and private subnets across
 * multiple availability zones.
 *
 * ## Usage
 *
 * ```hcl
 * module "vpc" {
 *   source = "./modules/vpc"
 *
 *   cidr_block         = "10.0.0.0/16"
 *   availability_zones = ["us-east-1a", "us-east-1b"]
 *   enable_nat_gateway = true
 *
 *   tags = {
 *     Environment = "production"
 *   }
 * }
 * ```
 */
```

### Use Semantic Versioning for Modules

```hcl
# GOOD: Pinned version
module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "5.1.0"
}

# GOOD: Version constraint
module "vpc" {
  source  = "git::https://github.com/org/terraform-vpc.git?ref=v2.3.0"
}

# BAD: No version (uses latest)
module "vpc" {
  source = "terraform-aws-modules/vpc/aws"
}
```

---

## Workflow Best Practices

### Plan Before Apply

```bash
# Always review plans
terraform plan -out=tfplan
terraform show tfplan
terraform apply tfplan
```

### Use Workspaces or Directory Structure for Environments

```bash
# Workspace approach
terraform workspace new staging
terraform workspace select staging
terraform apply

# Directory approach (preferred for isolation)
environments/
  dev/
    main.tf
    terraform.tfvars
  staging/
    main.tf
    terraform.tfvars
  prod/
    main.tf
    terraform.tfvars
```

### Implement CI/CD Checks

```yaml
# .github/workflows/terraform.yml (example)
- name: Format Check
  run: terraform fmt -check -recursive

- name: Validate
  run: terraform validate

- name: Security Scan
  run: checkov -d .

- name: Plan
  run: terraform plan -out=tfplan -no-color
```

---

## Summary Rules

| Practice | Rule |
|----------|------|
| **Versioning** | Pin Terraform, providers, and module versions |
| **Naming** | Use consistent, descriptive resource names |
| **State** | Remote backend with locking, separate by risk |
| **Variables** | Add descriptions, types, and validation |
| **Outputs** | Export values needed by other configurations |
| **Modules** | Design for reuse, document, version semantically |
| **Security** | Scan configurations, mark sensitive values |
| **Workflow** | Plan review, CI/CD checks, no manual applies to prod |

---

_Best practices evolve. Review and update as Terraform and your team mature._
