# Terraform Landing Zone + CI/CD + Cost Dashboard

Standalone portfolio project: AWS Terraform landing zone (ap-southeast-2),
secure GitHub Actions CI/CD pipeline, and a Next.js dashboard on Vercel
showing pipeline runs, drift detection, and cloud cost.

## What it demonstrates

- **Terraform landing zone**: VPC, public/private subnets, IAM role, internet
  gateway, route tables — all provisioned with Terraform in AWS ap-southeast-2.
- **Secure CI/CD from scratch**: GitHub Actions runs `terraform validate` on
  feature branches, `terraform plan` + cost estimate on PRs to main, and
  `terraform apply -auto-approve` on merge to main.
- **Drift detection**: scheduled workflow (every 6h) runs `terraform plan
  -detailed-exitcode` and writes results to `drift/last-run.json`.
- **Realtime dashboard** (Vercel): polls GitHub Actions API, AWS Cost
  Explorer, and drift results every 30s. Falls back to last-known state
  (Vercel Blob) when APIs are unreachable.

## Repository layout

```
terraform/
  main.tf           # VPC, subnets, IAM, IGW, route tables
  variables.tf      # input variables
  outputs.tf        # vpc_id, subnet_ids, backend_bucket, dynamodb_table
  versions.tf       # AWS provider (ap-southeast-2)
  backend.hcl.example # state backend example (Floci local emulator)
.github/
  workflows/
    terraform.yml   # CI/CD: validate → plan → apply
    drift.yml       # drift detection on schedule + workflow_dispatch
dashboard/          # Next.js dashboard (App Router, Tailwind v4)
  app/
    page.tsx        # server-rendered shell, wires three cards
    api/
      pipeline/route.ts   # GitHub Actions latest run
      drift/route.ts      # drift/last-run.json from GitHub
      cost/route.ts       # AWS Cost Explorer (with Blob fallback)
  components/
    PipelineStatus.tsx
    DriftStatus.tsx
    CostCard.tsx
    LastUpdated.tsx
  lib/
    blob.ts         # getState/setState via Vercel Blob
    poll.ts         # startPoll: 30s polling with stale fallback
  e2e/
    smoke.test.ts   # Playwright: all three cards render
docs/
  STATE_BACKEND.md  # S3 + DynamoDB state backend (Floci local)
```

## Prerequisites

- [Terraform](https://developer.hashicorp.com/terraform/downloads) >= 1.0
- [Floci](https://floci.io/) (local AWS emulator) — `floci 0.4.0`
- [Node.js](https://nodejs.org/) >= 20
- [AWS CLI](https://aws.amazon.com/cli/) (for local Floci verification)

## Local development

### 1. Terraform landing zone (against Floci, no real AWS)

```bash
# Start the Floci AWS emulator (port 4566)
floci start

# Create the state bucket locally
aws --endpoint-url http://localhost:4566 s3 mb s3://portfolio-terraform-state --region ap-southeast-2

# Initialize and validate Terraform
cd terraform
cp backend.hcl.example backend.hcl
terraform init -backend-config=backend.hcl
terraform validate
```

### 2. Dashboard (Next.js)

```bash
cd dashboard
cp .env.example .env.local   # fill in GITHUB_PAT, BLOB_READ_WRITE_TOKEN, etc.
npm install
npm run dev                  # http://localhost:3000
npm run build                # production build
npm test                     # vitest unit tests (4 test files)
```

## Deploy to Vercel

1. Push this repo to GitHub.
2. In Vercel, add a new project and set the **root directory** to `dashboard/`.
3. Add these environment variables in Vercel project settings:

| Variable | Purpose |
|----------|---------|
| `GITHUB_PAT` | GitHub personal access token (`repo` scope) for reading Actions API |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob read/write token for state persistence |
| `AWS_ACCESS_KEY_ID` | (optional) live Cost Explorer access |
| `AWS_SECRET_ACCESS_KEY` | (optional) live Cost Explorer secret |

4. Deploy. The dashboard polls every 30s and deploys on every push to `dashboard/`.

## GitHub Secrets (for CI/CD)

Add these to your GitHub repository Settings → Secrets and variables → Actions:

| Secret | Purpose |
|--------|---------|
| `AWS_ACCESS_KEY_ID` | Terraform apply credentials (merge to main) |
| `AWS_SECRET_ACCESS_KEY` | Terraform apply credentials (merge to main) |
| `GITHUB_TOKEN` | Auto-provided by GitHub for drift workflow commits |

## Drift detection

The `drift.yml` workflow runs every 6 hours and on `workflow_dispatch`. It runs
`terraform plan -detailed-exitcode` against the live backend and writes
`drift/last-run.json`, which the dashboard reads on every poll.

Drift detection uses `terraform plan -detailed-exitcode` only — it never
applies changes, so it cannot modify infrastructure.

## E2E smoke test

```bash
cd dashboard
npx playwright install chromium   # one-time browser install
npx playwright test               # runs e2e/smoke.test.ts
```

The smoke test loads the dashboard and asserts all three cards (Pipeline,
Drift, Cost) render.

## Cost

- Floci runs locally: zero AWS cost.
- Vercel dashboard: free tier.
- GitHub Actions: free for public repos.
- To use live AWS Cost Explorer, add `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY`
  to Vercel env — you are responsible for any Cost Explorer API charges.

## License

MIT