#!/bin/bash
# Startup script for Claw Army GCE instance (execution-service + tool-gateway).
# Terraform substitutes ${lowercase} values at provision time.
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

# ── 3. Get internal IP (for EXECUTION_SERVICE_URL) ────────────────────────
INTERNAL_IP=$(curl -sf \
  "http://metadata.google.internal/computeMetadata/v1/instance/network-interfaces/0/ip" \
  -H "Metadata-Flavor: Google")
echo "[$(date)] Internal IP: $INTERNAL_IP"

# ── 4. Config — Terraform-injected values ─────────────────────────────────
DB_HOST="${db_host}"
DB_NAME="${db_name}"
DB_USER="${db_user}"
REDIS_HOST="${redis_host}"
REDIS_PORT="${redis_port}"
REGISTRY_URL="${registry_url}"
REGISTRY_REGION="${registry_region}"
PROJECT_ID="${project_id}"
ENVIRONMENT="${environment}"
GCP_ZONE="${gcp_zone}"
GCP_NETWORK="${gcp_network}"
GCP_SUBNET="${gcp_subnet}"
LLM_API_KEY_SECRET_NAME="${llm_api_key_secret_name}"
LLM_PROVIDER="${llm_provider}"

# ── 5. Fetch secrets from Secret Manager ──────────────────────────────────
echo "[$(date)] Fetching secrets..."
DB_PASSWORD=$(gcloud secrets versions access latest \
  --secret="claw-db-password-$ENVIRONMENT" --project="$PROJECT_ID")

OPENAI_API_KEY=$(gcloud secrets versions access latest \
  --secret="claw-openai-api-key" --project="$PROJECT_ID" 2>/dev/null || echo "")

ANTHROPIC_API_KEY=$(gcloud secrets versions access latest \
  --secret="claw-anthropic-api-key" --project="$PROJECT_ID" 2>/dev/null || echo "")

AUTH_SECRET=$(gcloud secrets versions access latest \
  --secret="claw-auth-secret" --project="$PROJECT_ID")

# ── 6. Authenticate Docker with Artifact Registry ─────────────────────────
echo "[$(date)] Configuring Docker auth..."
gcloud auth configure-docker "$REGISTRY_REGION-docker.pkg.dev" --quiet

# ── 7. Write .env file (sensitive — chmod 600) ────────────────────────────
echo "[$(date)] Writing .env..."
mkdir -p /etc/claw
printf 'DATABASE_URL=postgres://%s:%s@%s:5432/%s\n' \
  "$DB_USER" "$DB_PASSWORD" "$DB_HOST" "$DB_NAME" > /etc/claw/.env
printf 'REDIS_URL=redis://%s:%s\n'             "$REDIS_HOST" "$REDIS_PORT"          >> /etc/claw/.env
printf 'GCP_PROJECT_ID=%s\n'                   "$PROJECT_ID"                         >> /etc/claw/.env
printf 'GCP_ZONE=%s\n'                         "$GCP_ZONE"                           >> /etc/claw/.env
printf 'GCP_NETWORK=%s\n'                      "$GCP_NETWORK"                        >> /etc/claw/.env
printf 'GCP_SUBNET=%s\n'                       "$GCP_SUBNET"                         >> /etc/claw/.env
printf 'LLM_API_KEY_SECRET_NAME=%s\n'          "$LLM_API_KEY_SECRET_NAME"            >> /etc/claw/.env
printf 'LLM_PROVIDER=%s\n'                     "$LLM_PROVIDER"                       >> /etc/claw/.env
printf 'EXECUTION_SERVICE_URL=http://%s:3001\n' "$INTERNAL_IP"                       >> /etc/claw/.env
printf 'OPENAI_API_KEY=%s\n'                   "$OPENAI_API_KEY"                     >> /etc/claw/.env
printf 'ANTHROPIC_API_KEY=%s\n'               "$ANTHROPIC_API_KEY"                  >> /etc/claw/.env
printf 'AUTH_SECRET=%s\n'                      "$AUTH_SECRET"                        >> /etc/claw/.env
printf 'BOT_JWT_SECRET=%s\n'                   "$AUTH_SECRET"                        >> /etc/claw/.env
chmod 600 /etc/claw/.env

# ── 8. Write docker-compose.yml ───────────────────────────────────────────
echo "[$(date)] Writing docker-compose.yml..."
cat > /etc/claw/docker-compose.yml << COMPOSE
services:
  execution-service:
    image: $REGISTRY_URL/execution-service:latest
    env_file: /etc/claw/.env
    environment:
      PORT: "3001"
      TOOL_GATEWAY_URL: "http://tool-gateway:3002"
      PUBSUB_EMULATOR_HOST: ""
    networks:
      - claw-services
    ports:
      - "3001:3001"
    restart: unless-stopped

  tool-gateway:
    image: $REGISTRY_URL/tool-gateway:latest
    env_file: /etc/claw/.env
    environment:
      PORT: "3002"
      PROXY_DOMAIN_ALLOWLIST: "api.anthropic.com,api.openai.com,generativelanguage.googleapis.com,deb.nodesource.com,github.com,objects.githubusercontent.com,registry.npmjs.org"
      ARTIFACT_ROOT: "/artifacts"
    volumes:
      - claw-artifacts:/artifacts
    networks:
      - claw-services
    ports:
      - "3002:3002"
    restart: unless-stopped

networks:
  claw-services:

volumes:
  claw-artifacts:
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

# ── 10. Pull images and start ──────────────────────────────────────────────
echo "[$(date)] Pulling images..."
if docker compose -f /etc/claw/docker-compose.yml pull 2>&1; then
  docker compose -f /etc/claw/docker-compose.yml up -d
  echo "[$(date)] Services started."
else
  echo "[$(date)] Image pull failed — images not yet pushed to Artifact Registry."
  echo "[$(date)] After pushing images, run: claw-update"
fi

touch /etc/claw/.done
echo "[$(date)] === Setup complete. Logs: $LOG ==="
