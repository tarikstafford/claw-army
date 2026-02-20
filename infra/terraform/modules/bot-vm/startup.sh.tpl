#!/bin/bash
# Bot VM startup script — templated by Terraform / gce-bot-launcher.ts
# Terraform vars (substituted before execution): ${bot_id}, ${execution_id},
#   ${llm_provider}, ${llm_api_key_secret_name}, ${tool_gateway_url}, ${execution_service_url}
# Bash vars (evaluated at runtime) use $$ to escape Terraform interpolation.
set -euo pipefail

BOT_ID="${bot_id}"
EXECUTION_ID="${execution_id}"
LLM_PROVIDER="${llm_provider}"
LLM_API_KEY_SECRET="${llm_api_key_secret_name}"
TOOL_GATEWAY_URL="${tool_gateway_url}"
EXECUTION_SERVICE_URL="${execution_service_url}"

# Redirect all output to serial console for debugging
exec > >(tee /var/log/bot-startup.log | logger -t bot-startup) 2>&1

echo "[startup] === Bot VM starting: $BOT_ID ==="
echo "[startup] Execution: $EXECUTION_ID"
echo "[startup] Tool Gateway: $TOOL_GATEWAY_URL"
echo "[startup] Execution Service: $EXECUTION_SERVICE_URL"

# ── 1. Get internal IP from GCE metadata ─────────────────────────────────────
INTERNAL_IP=$$(curl -sf \
  "http://metadata.google.internal/computeMetadata/v1/instance/network-interfaces/0/ip" \
  -H "Metadata-Flavor: Google")
echo "[startup] Internal IP: $INTERNAL_IP"

# ── 2. Install Node.js 22 ─────────────────────────────────────────────────────
echo "[startup] Installing Node.js 22..."
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs git
node --version
npm --version

# ── 3. Install OpenClaw ───────────────────────────────────────────────────────
echo "[startup] Installing OpenClaw..."
npm install -g openclaw@latest
openclaw --version

# ── 4. Install SecureClaw (OpenClaw plugin) ───────────────────────────────────
# SecureClaw installs as an OpenClaw plugin via its skill install script.
# Source: https://github.com/adversa-ai/secureclaw
echo "[startup] Installing SecureClaw..."
git clone https://github.com/adversa-ai/secureclaw.git /opt/secureclaw
bash /opt/secureclaw/secureclaw/skill/scripts/install.sh \
  || echo "[startup] WARNING: SecureClaw install failed — proceeding without hardening"

# ── 5. Fetch LLM API key from Secret Manager ─────────────────────────────────
echo "[startup] Fetching LLM API key from Secret Manager..."
LLM_API_KEY=$$(gcloud secrets versions access latest --secret="$LLM_API_KEY_SECRET" 2>/dev/null || echo "")
if [[ -z "$$LLM_API_KEY" ]]; then
  echo "[startup] ERROR: Could not fetch LLM API key from Secret Manager secret: $LLM_API_KEY_SECRET"
  exit 1
fi

# ── 6. Configure OpenClaw ─────────────────────────────────────────────────────
# The gateway binds to 127.0.0.1:18789 by default (loopback only).
# OPENCLAW_GATEWAY_HOST overrides the bind address so execution-service can
# reach it on the internal VPC IP.
echo "[startup] Writing OpenClaw config..."
mkdir -p /root/.openclaw
cat > /root/.openclaw/config.json <<CONFIG
{
  "llmProvider": "$LLM_PROVIDER",
  "apiKey": "$$LLM_API_KEY",
  "httpProxy": "http://$TOOL_GATEWAY_URL"
}
CONFIG

export HTTP_PROXY="http://$TOOL_GATEWAY_URL"
export HTTPS_PROXY="http://$TOOL_GATEWAY_URL"
export NO_PROXY="metadata.google.internal,169.254.169.254,localhost,127.0.0.1"
# Override gateway bind host from 127.0.0.1 to the internal VPC IP
export OPENCLAW_GATEWAY_HOST="$$INTERNAL_IP"
export OPENCLAW_GATEWAY_PORT="18789"

# ── 7. Run SecureClaw audit + hardening ──────────────────────────────────────
echo "[startup] Running SecureClaw audit..."
npx openclaw secureclaw audit 2>&1 | tee /var/log/secureclaw-audit.log \
  || echo "[startup] WARNING: secureclaw audit failed (non-fatal)"

echo "[startup] Running SecureClaw harden..."
npx openclaw secureclaw harden --full 2>&1 | tee /var/log/secureclaw-harden.log \
  || echo "[startup] WARNING: secureclaw harden failed (non-fatal)"

# ── 8. Start OpenClaw as a daemon ─────────────────────────────────────────────
# openclaw onboard --install-daemon installs and starts the OpenClaw gateway
# as a systemd service. The gateway binds to OPENCLAW_GATEWAY_HOST:OPENCLAW_GATEWAY_PORT.
echo "[startup] Starting OpenClaw gateway daemon..."
openclaw onboard --install-daemon
systemctl enable openclaw-gateway 2>/dev/null || true
systemctl start openclaw-gateway 2>/dev/null || true

# ── 9. Wait for OpenClaw Gateway to be ready ─────────────────────────────────
echo "[startup] Waiting for OpenClaw Gateway readiness..."
MAX_WAIT=120
WAITED=0
until curl -sf "http://$$INTERNAL_IP:18789/health" > /dev/null 2>&1; do
  if [[ $$WAITED -ge $$MAX_WAIT ]]; then
    echo "[startup] ERROR: OpenClaw Gateway not ready after $${MAX_WAIT}s"
    exit 1
  fi
  sleep 5
  WAITED=$$((WAITED + 5))
  echo "[startup] Still waiting... ($${WAITED}s)"
done
echo "[startup] OpenClaw Gateway is ready on $$INTERNAL_IP:18789"

# ── 10. Signal readiness to execution-service ─────────────────────────────────
echo "[startup] Posting readiness to execution-service..."
curl -X POST "$EXECUTION_SERVICE_URL/bots/$BOT_ID/ready" \
  -H "Content-Type: application/json" \
  -d "{\"internalIp\": \"$$INTERNAL_IP\", \"port\": 18789}" \
  --retry 10 --retry-delay 5 --retry-connrefused --max-time 60

echo "[startup] === Bot VM ready: $BOT_ID ==="
