# Runbook: Deployment

## Infrastructure Layout

| Component | Platform | Details |
|-----------|----------|---------|
| Akasa backend (execution-service) | Railway | Auto-deploys from main |
| Akasa server (akasa-server) | Railway | Mounted on Paperclip Express |
| SvelteKit UI | Railway | SSR + static assets |
| Paperclip service | Railway | Separate service |
| Tool Gateway | Railway | HTTP proxy |
| Telegram Bot | Railway | Command Channel bridge |
| PostgreSQL + pgvector | GCP Cloud SQL | 10.101.0.3 |
| Bot VMs | GCP Compute Engine | e2-standard-2, Ubuntu 22.04 |
| Inter-service events | GCP Pub/Sub | |

## Railway Deployment

Railway auto-deploys from the `main` branch. Each service has its own Railway service configuration.

Railway connects to Cloud SQL via public IP + SSL.

## GCP Infrastructure

### Bot VMs
- Instance type: `e2-standard-2` Ubuntu 22.04
- No external IP (on 10.0.0.0/24 subnet)
- Tagged `claw-bot-vm` for firewall rules
- IAP enabled for SSH access (`allow-iap-ssh-bots` firewall rule)

### Database
- Cloud SQL PostgreSQL with pgvector extension
- Internal IP: 10.101.0.3

## Environment Variables

See `services/akasa-server/.env.example` for the full list of required environment variables.

Critical variables:
- `DATABASE_URL` — PostgreSQL connection string
- `AUTH_SECRET` — JWT validation secret
- `TOOL_ENCRYPTION_KEY` — AES-256-GCM key for credential encryption (32 bytes, base64)
- `WEBHOOK_URL_SECRET` — No fallback; server fails to start if unset
- `AKASA_BASE_URL` — Required for OAuth callback URLs

## Pre-deployment Checklist

- [ ] All tests pass locally
- [ ] Migrations applied (if any new ones)
- [ ] Environment variables set in Railway dashboard
- [ ] Paperclip submodule pinned to tested commit
