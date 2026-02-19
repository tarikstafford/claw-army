#!/bin/bash
# Startup script for Claw Army GCE instance.
# Terraform substitutes $${lowercase} values at provision time.
# Run once on first boot; subsequent reboots skip setup via the guard file.
set -euo pipefail

LOG=/var/log/claw-startup.log
exec >> "$LOG" 2>&1

echo "[$(date)] === Claw Army startup ==="

# First-run guard — skip if already initialized
if [ -f /etc/claw/.done ]; then
  echo "[$(date)] Already initialized, starting services..."
  docker compose -f /etc/claw/docker-compose.yml up -d 2>&1 || true
  exit 0
fi

# ── 1. Install Docker ──────────────────────────────────────────────────────
echo "[$(date)] Installing Docker..."
apt-get update -qq
apt-get install -y -qq ca-certificates curl gnupg
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
  | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
  | tee /etc/apt/sources.list.d/docker.list > /dev/null
apt-get update -qq
apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-compose-plugin
echo "[$(date)] Docker installed."

# ── 2. Install gcloud CLI ──────────────────────────────────────────────────
echo "[$(date)] Installing gcloud CLI..."
apt-get install -y -qq apt-transport-https
curl -fsSL https://packages.cloud.google.com/apt/doc/apt-key.gpg \
  | gpg --dearmor -o /usr/share/keyrings/cloud.google.gpg
echo "deb [signed-by=/usr/share/keyrings/cloud.google.gpg] \
  https://packages.cloud.google.com/apt cloud-sdk main" \
  | tee /etc/apt/sources.list.d/google-cloud-sdk.list > /dev/null
apt-get update -qq
apt-get install -y -qq google-cloud-cli
echo "[$(date)] gcloud installed."

# ── 3. Config — Terraform-injected values ─────────────────────────────────
# Non-sensitive values come from Terraform template substitution.
# Sensitive values (API keys) are fetched from Secret Manager.
DB_HOST="${db_host}"
DB_NAME="${db_name}"
DB_USER="${db_user}"
REDIS_HOST="${redis_host}"
REDIS_PORT="${redis_port}"
REGISTRY_URL="${registry_url}"
REGISTRY_REGION="${registry_region}"
PROJECT_ID="${project_id}"
ENVIRONMENT="${environment}"

# ── 4. Fetch secrets from Secret Manager ──────────────────────────────────
echo "[$(date)] Fetching secrets..."
DB_PASSWORD=$(gcloud secrets versions access latest \
  --secret="claw-db-password-$ENVIRONMENT" --project="$PROJECT_ID")

OPENAI_API_KEY=$(gcloud secrets versions access latest \
  --secret="claw-openai-api-key" --project="$PROJECT_ID" 2>/dev/null || echo "")

ANTHROPIC_API_KEY=$(gcloud secrets versions access latest \
  --secret="claw-anthropic-api-key" --project="$PROJECT_ID" 2>/dev/null || echo "")

# ── 5. Authenticate Docker with Artifact Registry ─────────────────────────
echo "[$(date)] Configuring Docker auth..."
gcloud auth configure-docker "$REGISTRY_REGION-docker.pkg.dev" --quiet

# ── 6. Create Docker networks ──────────────────────────────────────────────
echo "[$(date)] Creating Docker networks..."
docker network create claw-services       2>/dev/null || true
docker network create claw-bot-internal --internal 2>/dev/null || true

# ── 7. Write .env file (sensitive — chmod 600) ────────────────────────────
echo "[$(date)] Writing .env..."
mkdir -p /etc/claw
# Use printf to safely handle special characters in secrets
printf 'DATABASE_URL=postgres://%s:%s@%s:5432/%s\n' \
  "$DB_USER" "$DB_PASSWORD" "$DB_HOST" "$DB_NAME" > /etc/claw/.env
printf 'REDIS_URL=redis://%s:%s\n'     "$REDIS_HOST" "$REDIS_PORT"    >> /etc/claw/.env
printf 'GCP_PROJECT_ID=%s\n'           "$PROJECT_ID"                   >> /etc/claw/.env
printf 'OPENAI_API_KEY=%s\n'           "$OPENAI_API_KEY"               >> /etc/claw/.env
printf 'ANTHROPIC_API_KEY=%s\n'        "$ANTHROPIC_API_KEY"            >> /etc/claw/.env
printf 'BOT_IMAGE=%s/bot-worker:latest\n' "$REGISTRY_URL"              >> /etc/claw/.env
chmod 600 /etc/claw/.env

# ── 8. Write docker-compose.yml ───────────────────────────────────────────
echo "[$(date)] Writing docker-compose.yml..."
cat > /etc/claw/docker-compose.yml << COMPOSE
version: "3.8"

services:
  execution-service:
    image: $REGISTRY_URL/execution-service:latest
    env_file: /etc/claw/.env
    environment:
      PORT: "3001"
      BOT_NETWORK: "claw-bot-internal"
      TOOL_GATEWAY_URL: "http://tool-gateway:3002"
      BOT_LLM_MODEL: "gpt-4o-mini"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
    networks:
      - claw-services
      - claw-bot-internal
    ports:
      - "3001:3001"
    restart: unless-stopped

  tool-gateway:
    image: $REGISTRY_URL/tool-gateway:latest
    environment:
      PORT: "3002"
    networks:
      - claw-services
      - claw-bot-internal
    restart: unless-stopped

networks:
  claw-services:
  claw-bot-internal:
    internal: true
COMPOSE

# ── 9. Write update helper ────────────────────────────────────────────────
cat > /usr/local/bin/claw-update << 'UPDATE'
#!/bin/bash
set -euo pipefail
echo "==> Pulling latest images..."
docker compose -f /etc/claw/docker-compose.yml pull
echo "==> Restarting services..."
docker compose -f /etc/claw/docker-compose.yml up -d --remove-orphans
echo "==> Done. Current status:"
docker compose -f /etc/claw/docker-compose.yml ps
UPDATE
chmod +x /usr/local/bin/claw-update

# ── 10. Pull images and start (gracefully handles images not yet pushed) ──
echo "[$(date)] Pulling images (will retry after image push if needed)..."
if docker compose -f /etc/claw/docker-compose.yml pull 2>&1; then
  docker compose -f /etc/claw/docker-compose.yml up -d
  echo "[$(date)] Services started."
else
  echo "[$(date)] Image pull failed — images not yet pushed to Artifact Registry."
  echo "[$(date)] After pushing images, run: claw-update"
fi

touch /etc/claw/.done
echo "[$(date)] === Setup complete. Logs: $LOG ==="
