# Terraform Project Structure

Recommended directory layouts and file organization for Terraform projects.

---

## Philosophy

- **Predictable layout**: Anyone familiar with Terraform should navigate easily
- **Separation of concerns**: Modules, environments, and configuration are distinct
- **Scalable organization**: Structure that grows with project complexity
- **CI/CD friendly**: Clear entry points for automation

---

## Standard File Naming

| File | Purpose |
|------|---------|
| `main.tf` | Primary resources and module calls |
| `variables.tf` | Input variable declarations |
| `outputs.tf` | Output value declarations |
| `versions.tf` | Terraform and provider version constraints |
| `backend.tf` | State backend configuration |
| `providers.tf` | Provider configuration |
| `locals.tf` | Local value definitions |
| `data.tf` | Data source declarations |
| `terraform.tfvars` | Variable values (environment-specific) |

---

## Single-Environment Project

For simple projects or single deployments.

```
project/
├── main.tf              # Resources and module calls
├── variables.tf         # Input variables
├── outputs.tf           # Outputs
├── versions.tf          # Version constraints
├── backend.tf           # Remote state config
├── providers.tf         # Provider config
├── locals.tf            # Local values
├── data.tf              # Data sources
├── terraform.tfvars     # Variable values
├── .terraform.lock.hcl  # Dependency lock (committed)
├── .gitignore           # Ignore .terraform/, *.tfstate
└── README.md            # Project documentation
```

### Example Files

```hcl
# versions.tf
terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# backend.tf
terraform {
  backend "s3" {
    bucket         = "company-terraform-state"
    key            = "project/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "terraform-locks"
  }
}

# providers.tf
provider "aws" {
  region = var.aws_region

  default_tags {
    tags = local.common_tags
  }
}
```

---

## Multi-Environment Project

Separate directories per environment with shared modules.

```
project/
├── modules/                    # Reusable modules
│   ├── networking/
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   ├── outputs.tf
│   │   └── README.md
│   ├── database/
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   ├── outputs.tf
│   │   └── README.md
│   └── application/
│       ├── main.tf
│       ├── variables.tf
│       ├── outputs.tf
│       └── README.md
├── environments/
│   ├── dev/
│   │   ├── main.tf             # Composes modules
│   │   ├── variables.tf
│   │   ├── outputs.tf
│   │   ├── versions.tf
│   │   ├── backend.tf          # Dev state bucket
│   │   ├── providers.tf
│   │   ├── terraform.tfvars
│   │   └── README.md
│   ├── staging/
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   ├── outputs.tf
│   │   ├── versions.tf
│   │   ├── backend.tf          # Staging state bucket
│   │   ├── providers.tf
│   │   ├── terraform.tfvars
│   │   └── README.md
│   └── prod/
│       ├── main.tf
│       ├── variables.tf
│       ├── outputs.tf
│       ├── versions.tf
│       ├── backend.tf          # Prod state bucket (different account)
│       ├── providers.tf
│       ├── terraform.tfvars
│       └── README.md
├── .github/
│   └── workflows/
│       └── terraform.yml       # CI/CD pipeline
├── scripts/
│   ├── init-backend.sh         # Bootstrap state bucket
│   └── apply.sh                # Wrapper for safe applies
├── .gitignore
├── .tflint.hcl                 # Linting configuration
└── README.md
```

### Environment `main.tf` Example

```hcl
# environments/prod/main.tf

module "networking" {
  source = "../../modules/networking"

  environment        = var.environment
  vpc_cidr           = var.vpc_cidr
  availability_zones = var.availability_zones

  tags = local.common_tags
}

module "database" {
  source = "../../modules/database"

  environment     = var.environment
  vpc_id          = module.networking.vpc_id
  subnet_ids      = module.networking.private_subnet_ids
  instance_class  = var.db_instance_class

  tags = local.common_tags
}

module "application" {
  source = "../../modules/application"

  environment       = var.environment
  vpc_id            = module.networking.vpc_id
  subnet_ids        = module.networking.private_subnet_ids
  database_endpoint = module.database.endpoint

  tags = local.common_tags
}
```

---

## Component-Based Structure

For large organizations with independent infrastructure components.

```
infrastructure/
├── global/                     # Account-wide resources
│   ├── iam/
│   │   ├── main.tf
│   │   ├── backend.tf
│   │   └── ...
│   ├── dns/
│   │   ├── main.tf
│   │   ├── backend.tf
│   │   └── ...
│   └── budgets/
│       └── ...
├── network/                    # Shared networking
│   ├── vpc/
│   │   ├── main.tf
│   │   ├── backend.tf
│   │   └── ...
│   └── transit-gateway/
│       └── ...
├── data/                       # Data layer
│   ├── rds/
│   │   └── ...
│   ├── elasticache/
│   │   └── ...
│   └── s3/
│       └── ...
├── compute/                    # Application compute
│   ├── eks/
│   │   └── ...
│   ├── ecs/
│   │   └── ...
│   └── lambda/
│       └── ...
├── monitoring/                 # Observability
│   ├── cloudwatch/
│   │   └── ...
│   └── datadog/
│       └── ...
└── modules/                    # Shared modules
    ├── vpc/
    ├── rds/
    └── ecs-service/
```

### Dependency Ordering

Components have implicit dependencies:

```
global/iam  →  network/vpc  →  data/rds  →  compute/ecs
                    ↓
               monitoring/cloudwatch
```

Use `terraform_remote_state` data sources to read outputs from upstream components.

---

## Module Structure

### Simple Module

```
modules/s3-bucket/
├── main.tf           # S3 bucket resource
├── variables.tf      # Input variables
├── outputs.tf        # Bucket ID, ARN, etc.
└── README.md         # Usage documentation
```

### Complex Module

```
modules/ecs-service/
├── main.tf           # ECS service, task definition
├── iam.tf            # Task and execution roles
├── alb.tf            # Load balancer resources
├── autoscaling.tf    # Auto-scaling policies
├── logs.tf           # CloudWatch log group
├── variables.tf      # All input variables
├── outputs.tf        # All outputs
├── versions.tf       # Required provider versions
├── README.md         # Module documentation
├── examples/
│   ├── basic/
│   │   └── main.tf   # Minimal usage example
│   └── complete/
│       └── main.tf   # All features enabled
└── tests/
    └── basic.tftest.hcl  # Native Terraform tests
```

---

## File Organization Rules

### When to Split Files

| Condition | Action |
|-----------|--------|
| File exceeds 200 lines | Split by resource type or function |
| Multiple resource types | Separate file per type (e.g., `iam.tf`, `s3.tf`) |
| Complex locals | Dedicated `locals.tf` |
| Many data sources | Dedicated `data.tf` |
| Provider-specific resources | Group by provider |

### Resource Grouping in Files

```hcl
# iam.tf - Group related IAM resources

# Task execution role
resource "aws_iam_role" "ecs_execution" {
  name = "${var.name}-execution"
  # ...
}

resource "aws_iam_role_policy_attachment" "ecs_execution" {
  role       = aws_iam_role.ecs_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# Task role
resource "aws_iam_role" "ecs_task" {
  name = "${var.name}-task"
  # ...
}

resource "aws_iam_role_policy" "ecs_task" {
  role   = aws_iam_role.ecs_task.name
  policy = data.aws_iam_policy_document.task.json
}
```

---

## .gitignore Template

```gitignore
# Terraform state files
*.tfstate
*.tfstate.*

# Crash log files
crash.log
crash.*.log

# Terraform directory
.terraform/

# .tfvars files with secrets
*.auto.tfvars
secret.tfvars

# Override files
override.tf
override.tf.json
*_override.tf
*_override.tf.json

# CLI configuration
.terraformrc
terraform.rc

# Keep lock file for reproducibility
!.terraform.lock.hcl
```

---

## CI/CD Directory Structure

```
.github/
└── workflows/
    ├── terraform-pr.yml      # Plan on pull requests
    ├── terraform-apply.yml   # Apply on merge to main
    └── terraform-drift.yml   # Scheduled drift detection

.gitlab-ci.yml                # Or GitLab equivalent
```

### CI Workflow Entry Points

```bash
# Run from environment directory
cd environments/prod
terraform init
terraform plan -out=tfplan
terraform apply tfplan
```

---

## Summary

| Project Size | Recommended Structure |
|--------------|----------------------|
| **Small** (1 env, <20 resources) | Single-environment flat structure |
| **Medium** (2-3 envs, <100 resources) | Multi-environment with shared modules |
| **Large** (many envs, teams, accounts) | Component-based with remote state sharing |

---

_Structure enables scale. Start simple, evolve as complexity grows._
