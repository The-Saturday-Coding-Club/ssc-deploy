# Self-Service Cloud Deployment - Setup Guide

This guide walks you through setting up your own instance of the Self-Service Cloud Deployment platform on your AWS account.

## Prerequisites

- **AWS Account** with admin access
- **GitHub Account**
- **Node.js 20+** installed locally
- **Terraform 1.0+** installed locally
- **AWS CLI** configured with your credentials

## Architecture Overview

```
User Browser (Next.js)
        ↓
GitHub OAuth Login
        ↓
Control Plane API (AWS Lambda + API Gateway)
        ↓
GitHub Actions Workflow
        ↓
User App (Lambda + API Gateway per app)
```

---

## Step 1: Fork the Repository

1. Fork this repository to your GitHub account
2. Clone your fork locally:
   ```bash
   git clone https://github.com/YOUR-USERNAME/Self-Service-Cloud-Deployment.git
   cd Self-Service-Cloud-Deployment
   ```

---

## Step 2: Create a Neon Database

1. Go to [Neon Console](https://console.neon.tech)
2. Create a new project
3. Copy the connection string (it looks like: `postgresql://user:pass@host.neon.tech/neondb?sslmode=require`)
4. Run the database schema:
   ```bash
   psql "YOUR_CONNECTION_STRING" -f apps/api/schema.sql
   ```

---

## Step 3: Create a GitHub OAuth App

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Click "New OAuth App"
3. Fill in:
   - **Application name**: Self-Service Cloud Deployer (or your choice)
   - **Homepage URL**: `http://localhost:3000` (update later for production)
   - **Authorization callback URL**: `http://localhost:3000/api/auth/callback/github`
4. Click "Register application"
5. Copy the **Client ID**
6. Generate and copy a new **Client Secret**

---

## Step 4: Create a GitHub Personal Access Token

1. Go to [GitHub Token Settings](https://github.com/settings/tokens)
2. Click "Generate new token (classic)"
3. Select scopes: `repo`, `workflow`
4. Generate and copy the token

---

## Step 5: Set Up AWS Infrastructure

### 5.1 Create S3 Bucket for Terraform State

```bash
aws s3 mb s3://YOUR-UNIQUE-BUCKET-NAME --region eu-west-1
aws dynamodb create-table \
  --table-name terraform-locks \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region eu-west-1
```

### 5.2 Update Terraform Backend Configuration

Edit the S3 bucket name in these files to match your bucket:
- `infra/terraform/control-plane/main.tf` (line 12)
- `infra/terraform/app-plane/providers.tf` (line 14)

### 5.3 Set Up GitHub OIDC Authentication

```bash
cd infra/terraform/github-oidc

# Copy and edit the example file
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with your GitHub username and repo name

terraform init
terraform apply
```

### 5.4 Deploy the Control Plane

```bash
cd infra/terraform/control-plane

# Copy and edit the example file
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with your values

terraform init
terraform apply
```

Note the API Gateway URL from the output - you'll need this for the frontend.

---

## Step 6: Configure GitHub Repository Secrets

Go to your forked repository → Settings → Secrets and variables → Actions

### Secrets (sensitive values):
| Name | Value |
|------|-------|
| `AWS_ACCOUNT_ID` | Your 12-digit AWS account ID |
| `DATABASE_URL` | Your Neon connection string |
| `DEPLOYMENT_SECRET` | Generate with `openssl rand -hex 32` |

### Variables (non-sensitive):
| Name | Value |
|------|-------|
| `AWS_REGION` | `eu-west-1` (or your preferred region) |
| `AWS_DEPLOYER_ROLE_NAME` | `github-actions-deployer` |
| `TF_STATE_BUCKET` | Your S3 bucket name |
| `CONTROL_PLANE_API_URL` | API Gateway URL from Step 5.4 |

---

## Step 7: Set Up the Frontend

```bash
cd apps/web-next

# Copy and configure environment
cp .env.example .env.local

# Edit .env.local with your values:
# - AUTH_SECRET: Generate with `openssl rand -base64 32`
# - AUTH_GITHUB_ID: From Step 3
# - AUTH_GITHUB_SECRET: From Step 3
# - NEXT_PUBLIC_API_URL: API Gateway URL from Step 5.4

# Install dependencies and run
npm install
npm run dev
```

Visit http://localhost:3000 and sign in with GitHub!

---

## Step 8: Deploy to Production (Optional)

### Frontend (Vercel)
1. Connect your fork to [Vercel](https://vercel.com)
2. Set root directory to `apps/web-next`
3. Add environment variables from `.env.local`
4. Update your GitHub OAuth App callback URL

### Update CORS
Update `allowed_origins` in your control-plane Terraform to include your production domain.

---

## Verification Checklist

- [ ] Can sign in with GitHub OAuth
- [ ] Can create a new app
- [ ] Can trigger a deployment
- [ ] Deployment completes successfully
- [ ] App URL works and returns response

---

## Troubleshooting

### "Failed to trigger deployment"
- Check GitHub token has `repo` and `workflow` permissions
- Verify `GITHUB_REPO_OWNER` and `GITHUB_REPO_NAME` in Lambda environment

### "Deployment stays in QUEUED"
- Check GitHub Actions workflow ran
- Verify `DEPLOYMENT_SECRET` matches in Lambda and GitHub secrets

### "Access Denied" in GitHub Actions
- Verify `AWS_ACCOUNT_ID` secret is correct
- Check GitHub OIDC role trust policy includes your repo

### Database connection errors
- Verify `DATABASE_URL` is correct
- Check Neon project is active (free tier may pause)

---

## Cost Estimates

This platform uses pay-per-use AWS services:

| Service | Approximate Cost |
|---------|-----------------|
| Lambda | ~$0.20 per million requests |
| API Gateway | ~$1.00 per million requests |
| CloudWatch Logs | ~$0.50 per GB ingested |
| S3 (Terraform state) | ~$0.023 per GB |

**Typical cost for small usage: $1-5/month**

---

## Security Notes

1. **Never commit `.env` files** - they're gitignored for a reason
2. **Rotate secrets regularly** - especially after any exposure
3. **Use least privilege** - the IAM role has broad permissions for convenience; scope them down for production
4. **Enable CloudTrail** - for audit logging in production
5. **Review user app deployments** - deployed Lambda functions run with your AWS credentials

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

MIT License - see [LICENSE](LICENSE)
