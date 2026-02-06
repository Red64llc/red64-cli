# Technology Stack

## Infrastructure as Code with Terraform

Declarative infrastructure provisioning using HashiCorp Configuration Language (HCL). Cloud-agnostic approach with provider-based extensibility, state management for drift detection, and modular composition for reusable infrastructure.

---

## Core Technologies

- **IaC Tool**: Terraform 1.6+ (OpenTofu 1.6+ as OSS alternative)
- **Configuration Language**: HCL (HashiCorp Configuration Language)
- **State Backend**: Remote state (S3, GCS, Azure Blob, Terraform Cloud)
- **Version Control**: Git with branch-based workflows
- **CI/CD**: GitHub Actions, GitLab CI, or Terraform Cloud

---

## Key Providers

### Cloud Platforms
- **AWS**: `hashicorp/aws` - EC2, S3, RDS, Lambda, VPC, IAM
- **Azure**: `hashicorp/azurerm` - VMs, Storage, AKS, Functions
- **GCP**: `hashicorp/google` - GCE, GCS, GKE, Cloud Functions
- **Scaleway**: `scaleway/scaleway` - Instances, Kubernetes Kapsule, Block Storage, VPC, Load Balancers
- **Outscale**: `outscale/outscale` - VMs, Networks, Security Groups, Load Balancers, EIM
- **Kubernetes**: `hashicorp/kubernetes` - Resources, Helm releases

### Infrastructure Services
- **Cloudflare**: DNS, CDN, WAF, Workers
- **Datadog**: Monitoring, dashboards, alerts
- **PagerDuty**: Incident management, escalation policies
- **GitHub**: Repositories, teams, branch protection

### Utilities
- **random**: Random strings, passwords, UUIDs
- **null**: Triggers, provisioners
- **local**: Local file operations
- **http**: HTTP data sources

---

## Tooling Ecosystem

### Development Tools
- **terraform fmt**: Canonical formatting
- **terraform validate**: Configuration syntax validation
- **terraform plan**: Preview changes before apply
- **tflint**: Linting with provider-specific rules
- **checkov/tfsec**: Security and compliance scanning
- **infracost**: Cost estimation for changes

### State Management
- **terraform state**: State inspection and manipulation
- **terraform import**: Import existing resources
- **terraform refresh**: Sync state with real infrastructure

### Module Development
- **terraform-docs**: Auto-generate module documentation
- **terratest**: Go-based infrastructure testing framework
- **terraform test**: Native testing framework (1.6+)

---

## Development Environment

### Required Tools
- Terraform 1.6+ (or OpenTofu 1.6+)
- Cloud provider CLI (aws-cli, gcloud, az, scw, osc-cli)
- Git for version control
- tflint for linting
- checkov or tfsec for security scanning

### Common Commands
```bash
# Initialize working directory
terraform init

# Format configuration
terraform fmt -recursive

# Validate configuration
terraform validate

# Preview changes
terraform plan -out=tfplan

# Apply changes
terraform apply tfplan

# Destroy infrastructure
terraform destroy

# Import existing resource
terraform import aws_instance.example i-1234567890abcdef0

# List workspace state
terraform state list

# Show specific resource
terraform state show aws_instance.example
```

---

## Key Technical Decisions

| Decision | Rationale |
|----------|-----------|
| **Remote state backend** | Team collaboration, locking, versioning, audit trail |
| **Modular architecture** | Reusability, testing, encapsulation of complexity |
| **Workspaces for environments** | Consistent configuration across dev/staging/prod |
| **Provider version pinning** | Reproducible builds, controlled upgrades |
| **Separate state per component** | Blast radius reduction, faster operations |
| **CI/CD-driven applies** | Audit trail, review process, consistent execution |
| **terraform-docs generation** | Automated, always-current documentation |
| **Native testing (1.6+)** | First-class testing without external tools |

---

_Document infrastructure patterns and standards. See individual steering docs for detailed conventions._
