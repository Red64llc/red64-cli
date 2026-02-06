# Terraform State Management

Best practices for managing Terraform state safely and effectively.

---

## Philosophy

- **State is critical infrastructure**: Treat it with the same care as production databases
- **Remote state by default**: Local state is only for learning or isolated experiments
- **Locking prevents corruption**: Never disable state locking in team environments
- **Backup and versioning**: Always have recovery options

---

## Remote State Backends

### AWS S3 Backend

```hcl
terraform {
  backend "s3" {
    bucket         = "company-terraform-state"
    key            = "project/environment/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "terraform-locks"

    # Optional: Use specific profile
    # profile        = "terraform"
  }
}
```

**Setup Requirements:**
```bash
# Create state bucket (do once, manually or with bootstrap config)
aws s3 mb s3://company-terraform-state --region us-east-1
aws s3api put-bucket-versioning \
  --bucket company-terraform-state \
  --versioning-configuration Status=Enabled
aws s3api put-bucket-encryption \
  --bucket company-terraform-state \
  --server-side-encryption-configuration '{
    "Rules": [{"ApplyServerSideEncryptionByDefault": {"SSEAlgorithm": "AES256"}}]
  }'

# Create DynamoDB table for locking
aws dynamodb create-table \
  --table-name terraform-locks \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST
```

### Azure Backend

```hcl
terraform {
  backend "azurerm" {
    resource_group_name  = "terraform-state-rg"
    storage_account_name = "companyterraformstate"
    container_name       = "tfstate"
    key                  = "project/environment/terraform.tfstate"
  }
}
```

### GCS Backend

```hcl
terraform {
  backend "gcs" {
    bucket = "company-terraform-state"
    prefix = "project/environment"
  }
}
```

### Terraform Cloud Backend

```hcl
terraform {
  cloud {
    organization = "my-company"

    workspaces {
      name = "my-project-prod"
    }
  }
}
```

---

## State Key Naming Conventions

### Hierarchical Keys

```
# Pattern: {component}/{environment}/terraform.tfstate
network/prod/terraform.tfstate
database/prod/terraform.tfstate
application/prod/terraform.tfstate

# Or: {project}/{component}/{environment}/terraform.tfstate
ecommerce/network/prod/terraform.tfstate
ecommerce/database/prod/terraform.tfstate
```

### Environment Isolation

```
# BAD: All environments in same prefix
project/terraform.tfstate          # Which environment?

# GOOD: Clear environment separation
project/dev/terraform.tfstate
project/staging/terraform.tfstate
project/prod/terraform.tfstate
```

---

## State Locking

### Why Locking Matters

```
# Without locking:
# User A runs: terraform apply
# User B runs: terraform apply (same time)
# Result: State corruption, lost resources, inconsistent infrastructure

# With locking:
# User A runs: terraform apply (acquires lock)
# User B runs: terraform apply → "Error: state locked by User A"
# Result: Safe, sequential operations
```

### Force Unlock (Use Carefully)

```bash
# Only when lock is orphaned (crashed process, etc.)
terraform force-unlock LOCK_ID

# Get lock ID from error message:
# "Lock ID: 12345678-1234-1234-1234-123456789012"
```

### Lock Timeout

```bash
# Increase timeout for long operations
terraform apply -lock-timeout=10m
```

---

## State Operations

### Viewing State

```bash
# List all resources in state
terraform state list

# Show specific resource details
terraform state show aws_instance.example

# Pull state to local file for inspection
terraform state pull > state.json
```

### Moving Resources

```hcl
# PREFERRED (Terraform 1.1+): moved blocks in configuration
# Keeps history in code, applied during next plan/apply

moved {
  from = aws_instance.web
  to   = aws_instance.app
}

moved {
  from = aws_instance.app
  to   = module.compute.aws_instance.app
}
```

```bash
# ALTERNATIVE: CLI command (immediate, not in history)
terraform state mv aws_instance.web aws_instance.app
terraform state mv aws_instance.app module.compute.aws_instance.app
```

### Removing Resources

```bash
# Remove from state (resource still exists in cloud)
terraform state rm aws_instance.example

# Use when:
# - Resource will be managed by different Terraform config
# - Importing into different workspace
# - Cleaning up after manual deletion
```

### Importing Resources

```bash
# Import existing resource into state
terraform import aws_instance.example i-1234567890abcdef0

# For modules
terraform import module.vpc.aws_vpc.main vpc-12345678
```

```hcl
# Terraform 1.5+: import blocks
import {
  to = aws_instance.example
  id = "i-1234567890abcdef0"
}

# Run: terraform plan to see import and any drift
```

---

## State File Security

### Encryption at Rest

```hcl
# S3 backend with encryption
backend "s3" {
  bucket  = "company-terraform-state"
  key     = "project/terraform.tfstate"
  encrypt = true  # Server-side encryption

  # Optional: Use KMS key
  kms_key_id = "arn:aws:kms:us-east-1:111122223333:key/1234abcd-12ab-34cd-56ef-1234567890ab"
}
```

### Access Control

```json
// S3 bucket policy - restrict to specific roles
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Deny",
      "Principal": "*",
      "Action": "s3:*",
      "Resource": [
        "arn:aws:s3:::company-terraform-state",
        "arn:aws:s3:::company-terraform-state/*"
      ],
      "Condition": {
        "StringNotLike": {
          "aws:PrincipalArn": [
            "arn:aws:iam::111122223333:role/TerraformPlan",
            "arn:aws:iam::111122223333:role/TerraformApply"
          ]
        }
      }
    }
  ]
}
```

### Never Commit State Files

```gitignore
# .gitignore
*.tfstate
*.tfstate.*
*.tfstate.backup
```

---

## State Isolation Strategies

### Per-Environment State

```
# Each environment has its own state file
environments/
  dev/
    backend.tf    → s3://state/project/dev/terraform.tfstate
  prod/
    backend.tf    → s3://state/project/prod/terraform.tfstate
```

### Per-Component State

```
# Large infrastructures benefit from component isolation
infrastructure/
  network/      → s3://state/network/terraform.tfstate
  database/     → s3://state/database/terraform.tfstate
  application/  → s3://state/application/terraform.tfstate
```

**Benefits:**
- Smaller blast radius
- Faster plan/apply operations
- Independent team ownership
- Easier debugging

**Trade-offs:**
- Requires `terraform_remote_state` data sources for cross-references
- More states to manage

---

## Cross-State References

### Reading Remote State

```hcl
# application/main.tf
data "terraform_remote_state" "network" {
  backend = "s3"
  config = {
    bucket = "company-terraform-state"
    key    = "network/terraform.tfstate"
    region = "us-east-1"
  }
}

resource "aws_instance" "app" {
  subnet_id = data.terraform_remote_state.network.outputs.private_subnet_ids[0]
}
```

### Required Outputs in Upstream

```hcl
# network/outputs.tf
output "vpc_id" {
  description = "VPC ID for downstream consumers"
  value       = aws_vpc.main.id
}

output "private_subnet_ids" {
  description = "Private subnet IDs for downstream consumers"
  value       = aws_subnet.private[*].id
}
```

---

## State Recovery

### From S3 Versioning

```bash
# List versions
aws s3api list-object-versions \
  --bucket company-terraform-state \
  --prefix project/terraform.tfstate

# Restore previous version
aws s3api get-object \
  --bucket company-terraform-state \
  --key project/terraform.tfstate \
  --version-id "versionIdHere" \
  restored-state.tfstate

# Review, then push back
terraform state push restored-state.tfstate
```

### From Backup

```bash
# Terraform creates backup before destructive operations
# Look for: terraform.tfstate.backup
# Or: terraform.tfstate.*.backup

# Restore from backup
cp terraform.tfstate.backup terraform.tfstate
terraform state push terraform.tfstate
```

### Rebuild from Infrastructure

```bash
# Last resort: Import all resources
# 1. Write resource definitions matching existing infra
# 2. Import each resource
terraform import aws_vpc.main vpc-12345678
terraform import aws_subnet.private[0] subnet-11111111
terraform import aws_subnet.private[1] subnet-22222222
# ...

# 3. Run plan to verify alignment
terraform plan
```

---

## Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| State locked | Crashed process, concurrent access | `terraform force-unlock LOCK_ID` |
| Resource not in state | Imported elsewhere, manually deleted | Re-import or remove reference |
| State version mismatch | Terraform version incompatibility | Use consistent Terraform version |
| Backend config changed | Modified backend without migration | `terraform init -migrate-state` |
| Sensitive data in state | Secrets stored in resources | Use external secret management |

---

## State Management Rules

| Rule | Reason |
|------|--------|
| Always use remote state for teams | Locking, sharing, versioning |
| Enable state file versioning | Recovery from mistakes |
| Encrypt state at rest | Contains sensitive data |
| Separate state by blast radius | Limit damage from errors |
| Never edit state files manually | Use `terraform state` commands |
| Plan before state operations | Understand implications |
| Backup before migrations | Recovery option |
| Document state locations | Team knowledge |

---

_State is the source of truth. Protect it accordingly._
