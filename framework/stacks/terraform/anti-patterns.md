# Terraform Anti-Patterns

Common mistakes and pitfalls to avoid in Terraform projects.

---

## Configuration Anti-Patterns

### Hardcoded Values

```hcl
# BAD: Hardcoded values scattered throughout
resource "aws_instance" "app" {
  ami           = "ami-0abcdef1234567890"
  instance_type = "t3.medium"
  subnet_id     = "subnet-12345678"

  tags = {
    Name = "production-app-server"
  }
}

# GOOD: Variables and data sources
variable "environment" {}
variable "instance_type" { default = "t3.medium" }

data "aws_ami" "app" {
  most_recent = true
  owners      = ["self"]
  filter {
    name   = "tag:Application"
    values = ["my-app"]
  }
}

resource "aws_instance" "app" {
  ami           = data.aws_ami.app.id
  instance_type = var.instance_type
  subnet_id     = module.vpc.private_subnet_ids[0]

  tags = local.common_tags
}
```

---

### Monolithic Configuration

```hcl
# BAD: Everything in one massive main.tf (500+ lines)
# - VPC, subnets, security groups
# - RDS, ElastiCache
# - ECS cluster, services, task definitions
# - IAM roles, policies
# - CloudWatch logs, alarms
# - Route53 records
# All in a single file/state

# GOOD: Separated by concern
modules/
  networking/    # VPC, subnets, routing
  database/      # RDS, ElastiCache
  compute/       # ECS, EC2
  security/      # IAM, security groups
environments/
  prod/
    main.tf      # Composes modules
```

---

### Using Local State in Teams

```hcl
# BAD: Default local state
# No backend configuration = local terraform.tfstate
# - No locking (concurrent modifications corrupt state)
# - No sharing (team can't collaborate)
# - No versioning (can't recover from mistakes)

# GOOD: Remote state with locking
terraform {
  backend "s3" {
    bucket         = "company-terraform-state"
    key            = "project/env/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "terraform-locks"
  }
}
```

---

### Provider in Modules

```hcl
# BAD: Provider configuration inside module
# modules/vpc/main.tf
provider "aws" {
  region = "us-east-1"  # Module shouldn't configure providers
}

resource "aws_vpc" "main" {
  cidr_block = var.cidr_block
}

# GOOD: Provider configuration in root module only
# environments/prod/main.tf
provider "aws" {
  region = "us-east-1"
}

module "vpc" {
  source     = "../../modules/vpc"
  cidr_block = "10.0.0.0/16"
}

# modules/vpc/main.tf
resource "aws_vpc" "main" {
  cidr_block = var.cidr_block
}
```

---

### Secrets in Configuration

```hcl
# BAD: Secrets in .tf files or tfvars committed to git
variable "db_password" {
  default = "SuperSecret123!"  # NEVER DO THIS
}

resource "aws_db_instance" "main" {
  password = "SuperSecret123!"  # NEVER DO THIS
}

# GOOD: External secret management
variable "db_password" {
  description = "Database password"
  type        = string
  sensitive   = true
}

# Pass via environment variable
# export TF_VAR_db_password="..."

# Or reference from secrets manager
data "aws_secretsmanager_secret_version" "db" {
  secret_id = "prod/db/password"
}

resource "aws_db_instance" "main" {
  password = data.aws_secretsmanager_secret_version.db.secret_string
}
```

---

### Using `count` with Maps/Complex Types

```hcl
# BAD: count with list that might reorder
variable "users" {
  default = ["alice", "bob", "charlie"]
}

resource "aws_iam_user" "team" {
  count = length(var.users)
  name  = var.users[count.index]
}
# Problem: Removing "bob" causes "charlie" to be destroyed and recreated

# GOOD: for_each with stable identifiers
resource "aws_iam_user" "team" {
  for_each = toset(var.users)
  name     = each.value
}
# Removing "bob" only affects bob's resource
```

---

### Ignoring Lifecycle Rules

```hcl
# BAD: No lifecycle consideration for critical resources
resource "aws_db_instance" "main" {
  identifier = "production-db"
  # terraform destroy will delete production database!
}

# GOOD: Protect critical resources
resource "aws_db_instance" "main" {
  identifier = "production-db"

  lifecycle {
    prevent_destroy = true  # Requires manual intervention to destroy
  }
}

# For resources that shouldn't trigger replacement
resource "aws_instance" "app" {
  ami = data.aws_ami.latest.id

  lifecycle {
    ignore_changes = [ami]  # Don't replace on AMI updates
  }
}
```

---

### Over-Engineering with Conditionals

```hcl
# BAD: Complex nested conditionals
resource "aws_instance" "app" {
  instance_type = (
    var.environment == "prod" ? (
      var.high_availability ? "m5.xlarge" : "m5.large"
    ) : (
      var.environment == "staging" ? "t3.medium" : "t3.small"
    )
  )
}

# GOOD: Use maps for lookups
variable "instance_types" {
  default = {
    dev     = "t3.small"
    staging = "t3.medium"
    prod    = "m5.large"
  }
}

resource "aws_instance" "app" {
  instance_type = var.instance_types[var.environment]
}
```

---

### Manual State Manipulation

```hcl
# BAD: Frequent terraform state mv, rm, import
# - Risky and error-prone
# - Often indicates structural problems
# - Hard to track changes

# GOOD: Use moved blocks for refactoring (Terraform 1.1+)
moved {
  from = aws_instance.web
  to   = aws_instance.app
}

moved {
  from = aws_instance.app
  to   = module.compute.aws_instance.app
}
```

---

### Not Using Modules for Repetition

```hcl
# BAD: Copy-pasting resource blocks
resource "aws_security_group" "app1" {
  name = "app1-sg"
  # 50 lines of ingress/egress rules
}

resource "aws_security_group" "app2" {
  name = "app2-sg"
  # Same 50 lines copied
}

# GOOD: Module for reusable patterns
module "app1_sg" {
  source      = "./modules/app-security-group"
  name        = "app1"
  allowed_ips = var.app1_allowed_ips
}

module "app2_sg" {
  source      = "./modules/app-security-group"
  name        = "app2"
  allowed_ips = var.app2_allowed_ips
}
```

---

### Unpinned Provider Versions

```hcl
# BAD: No version constraint
terraform {
  required_providers {
    aws = {
      source = "hashicorp/aws"
    }
  }
}
# Every init might get different provider version

# GOOD: Explicit version constraints
terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}
```

---

### Workspace Misuse for Environment Isolation

```hcl
# BAD: Using workspaces for prod vs dev
# - Same backend, different workspace
# - Accidental workspace switch = deploy to wrong env
# - Shared state bucket permissions

# GOOD: Separate configurations per environment
environments/
  dev/
    backend.tf    # Different bucket/key
    main.tf
  prod/
    backend.tf    # Different bucket/key (different account ideally)
    main.tf
```

---

## Summary Anti-Pattern Table

| Anti-Pattern | Problem | Solution |
|-------------|---------|----------|
| Hardcoded values | Not reusable, hard to maintain | Variables, data sources, locals |
| Monolithic config | Slow plans, large blast radius | Modular architecture, separate state |
| Local state | No locking, no collaboration | Remote backend with locking |
| Provider in modules | Tight coupling, inflexibility | Configure providers in root only |
| Secrets in config | Security risk | External secret management |
| count with maps | Resource recreation on reorder | Use for_each with stable keys |
| No lifecycle rules | Accidental destruction | prevent_destroy, ignore_changes |
| Complex conditionals | Hard to read and maintain | Map lookups, locals |
| Manual state editing | Error-prone, risky | moved blocks, proper refactoring |
| Copy-paste resources | Duplication, drift | Modules for patterns |
| Unpinned versions | Non-reproducible | Version constraints |
| Workspaces for environments | Risky switching | Separate directories/backends |

---

_Recognizing anti-patterns is the first step. Refactor incrementally to avoid them._
