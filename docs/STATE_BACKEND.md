# Terraform State Backend — Local (Floci)

This portfolio project runs its Terraform state backend locally using
[Floci](https://floci.io/), a free open-source AWS emulator. No real AWS
account, credentials, or billable resources are used.

## Why local state

- Zero cost: no S3/DynamoDB charges
- Zero blast radius: nothing touches a real cloud account
- Reproducible: anyone can `floci start` and run the same Terraform flow
- Credential-free: no access keys to rotate or leak

## One-time setup

```bash
# 1. Start the Floci AWS emulator (port 4566)
floci start

# 2. Create the state bucket locally
aws --endpoint-url http://localhost:4566 s3 mb s3://portfolio-terraform-state --region ap-southeast-2

# 3. Verify the bucket
aws --endpoint-url http://localhost:4566 s3api head-bucket \
  --bucket portfolio-terraform-state --region ap-southeast-2
```

## Terraform backend

See `terraform/backend.hcl.example`. Copy it to `terraform/backend.hcl` and
run `terraform init -backend-config=backend.hcl`. The backend points at the
local Floci S3 endpoint.

DynamoDB state locking is intentionally skipped for this single-user demo.
For a team workflow, enable it by uncommenting `dynamodb_table` and creating
a matching table in Floci.

## Cleanup

```bash
# Stop Floci when done (local state is discarded unless persistence is on)
floci stop
```

To persist local state across restarts, run Floci with
`FLOCI_STORAGE_MODE=persistent`.
