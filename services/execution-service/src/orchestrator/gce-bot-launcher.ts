import { InstancesClient, ZoneOperationsClient } from '@google-cloud/compute';

// ──────────────────────────────────────────────────────────────────────────────
// GCE client singletons
// ──────────────────────────────────────────────────────────────────────────────

const instancesClient = new InstancesClient();
const zoneOperationsClient = new ZoneOperationsClient();

// ──────────────────────────────────────────────────────────────────────────────
// Startup script template
// Mirrors infra/terraform/modules/bot-vm/startup.sh.tpl but uses TypeScript
// template literals instead of Terraform templatefile() interpolation.
// ──────────────────────────────────────────────────────────────────────────────

function buildStartupScript(opts: {
  botId: string;
  executionId: string;
  llmProvider: string;
  llmApiKeySecretName: string;
  toolGatewayUrl: string;
  executionServiceUrl: string;
  gatewayToken: string;
  /** Full SOUL.md markdown to write to the VM workspace before OpenClaw starts */
  soulContent: string;
}): string {
  const {
    botId,
    executionId,
    llmProvider,
    llmApiKeySecretName,
    toolGatewayUrl,
    executionServiceUrl,
    gatewayToken,
    soulContent,
  } = opts;

  const soulContentB64 = Buffer.from(soulContent).toString('base64');

  return `#!/bin/bash
set -uo pipefail

BOT_ID="${botId}"
EXECUTION_ID="${executionId}"
LLM_PROVIDER="${llmProvider}"
LLM_API_KEY_SECRET="${llmApiKeySecretName}"
TOOL_GATEWAY_URL="${toolGatewayUrl}"
EXECUTION_SERVICE_URL="${executionServiceUrl}"
GATEWAY_TOKEN="${gatewayToken}"
GATEWAY_PORT="18789"
SOUL_CONTENT_B64="${soulContentB64}"

exec > >(tee /var/log/bot-startup.log | logger -t bot-startup) 2>&1

echo "[startup] === Bot VM starting: $BOT_ID ==="
echo "[startup] Execution: $EXECUTION_ID"

# ── Failure tracking and trap ─────────────────────────────────────────────────
FAILURE_REASON=""

post_failure() {
  local reason
  reason=$(echo "$FAILURE_REASON" | sed 's/"/\\\\"/g')
  curl -X POST "$EXECUTION_SERVICE_URL/bots/$BOT_ID/ready" \\
    -H "Content-Type: application/json" \\
    -d "{\\"success\\": false, \\"error\\": \\"$reason\\"}" \\
    --retry 3 --retry-delay 5 --retry-connrefused --max-time 30 || true
}

trap 'if [[ -n "$FAILURE_REASON" ]]; then post_failure; fi' EXIT

# ── 1. Get internal IP from GCE metadata ──────────────────────────────────────
INTERNAL_IP=$(curl -sf \\
  "http://metadata.google.internal/computeMetadata/v1/instance/network-interfaces/0/ip" \\
  -H "Metadata-Flavor: Google")
echo "[startup] Internal IP: $INTERNAL_IP"

# ── 2. Install Node.js 22 (idempotent) ────────────────────────────────────────
if ! command -v node &>/dev/null; then
  echo "[startup] Installing Node.js 22..."
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash - || {
    FAILURE_REASON="Failed to install Node.js 22 — nodesource setup exited with code $?"
    exit 1
  }
  apt-get install -y nodejs git || {
    FAILURE_REASON="Failed to install Node.js 22 — apt-get exited with code $?"
    exit 1
  }
  echo "[startup] Node.js installed: $(node --version)"
else
  echo "[startup] Node.js already installed: $(node --version)"
fi

# ── 2b. Write SOUL.md to OpenClaw workspace ──────────────────────────────────
mkdir -p /root/.openclaw/workspace
echo "$SOUL_CONTENT_B64" | base64 --decode > /root/.openclaw/workspace/SOUL.md
echo "[startup] SOUL.md written ($(wc -c < /root/.openclaw/workspace/SOUL.md) bytes)"

# ── 3. Install OpenClaw (idempotent) ──────────────────────────────────────────
if ! command -v openclaw &>/dev/null; then
  echo "[startup] Installing OpenClaw..."
  npm install -g openclaw@2026.2.22-2 || {
    FAILURE_REASON="Failed to install openclaw npm package — npm exited with code $?"
    exit 1
  }
  echo "[startup] OpenClaw installed"
else
  echo "[startup] OpenClaw already installed"
fi

# ── 3b. Validate OpenClaw binary and capture version ─────────────────────────
if ! command -v openclaw &>/dev/null; then
  FAILURE_REASON="OpenClaw binary not found after install — command -v openclaw failed"
  exit 1
fi
OPENCLAW_VERSION=$(openclaw --version 2>&1 | head -1 | tr -d '\\r\\n') || {
  FAILURE_REASON="OpenClaw binary exists but --version failed — binary may be corrupted"
  exit 1
}
echo "[startup] OpenClaw version: $OPENCLAW_VERSION"

# ── 4. Fetch LLM API key from Secret Manager ─────────────────────────────────
LLM_API_KEY=$(gcloud secrets versions access latest --secret="$LLM_API_KEY_SECRET" 2>/dev/null || echo "")
if [[ -z "$LLM_API_KEY" ]]; then
  FAILURE_REASON="Failed to fetch LLM API key from Secret Manager (secret: $LLM_API_KEY_SECRET)"
  exit 1
fi

# ── 5. Configure and start OpenClaw Gateway ───────────────────────────────────
# Write config: mode=local (no chat channel needed), bind=lan (listen on VPC IP),
# auth.token is the pre-shared token the WebSocket client must present on connect.
# Env-var references in the JSON heredoc are expanded by bash (no quotes on CFGEOF).
mkdir -p /root/.openclaw/workspace
cat > /root/.openclaw/openclaw.json << CFGEOF
{
  "model": "anthropic/claude-opus-4-6",
  "gateway": {
    "mode": "local",
    "bind": "lan",
    "auth": {
      "token": "$GATEWAY_TOKEN"
    }
  }
}
CFGEOF
echo "[startup] OpenClaw config written (token injected)"

# Run the gateway in the background. 'openclaw gateway --port PORT' is the correct
# invocation — there are no 'run', 'install', or 'start' subcommands.
# nohup + disown keeps it alive after this script exits.
ANTHROPIC_API_KEY="$LLM_API_KEY" \\
HTTP_PROXY="$TOOL_GATEWAY_URL" \\
HTTPS_PROXY="$TOOL_GATEWAY_URL" \\
NO_PROXY="metadata.google.internal,169.254.169.254,localhost,127.0.0.1,$INTERNAL_IP" \\
nohup openclaw gateway --port "$GATEWAY_PORT" \\
  &>> /var/log/openclaw-gateway.log &
GATEWAY_PID=$!
disown $GATEWAY_PID
echo "[startup] OpenClaw Gateway started in background (PID: $GATEWAY_PID)"

# ── 6. Wait for OpenClaw Gateway to bind on the LAN port ──────────────────────
# The gateway is a WebSocket server — no HTTP /health path. Use nc to check
# TCP port reachability instead of curl.
MAX_WAIT=120
WAITED=0
until nc -z "$INTERNAL_IP" "$GATEWAY_PORT" 2>/dev/null; do
  if [[ $WAITED -ge $MAX_WAIT ]]; then
    GATEWAY_LOG=$(tail -30 /var/log/openclaw-gateway.log 2>/dev/null | tr '\\n' '|' | tr '"' "'" | cut -c1-500)
    FAILURE_REASON="OpenClaw Gateway did not bind to \${INTERNAL_IP}:\${GATEWAY_PORT} within \${MAX_WAIT}s — gateway log: \${GATEWAY_LOG}"
    exit 1
  fi
  sleep 5
  WAITED=$((WAITED + 5))
done
echo "[startup] OpenClaw Gateway is ready on $INTERNAL_IP:$GATEWAY_PORT"

# ── 7. Signal readiness to execution-service ──────────────────────────────────
curl -X POST "$EXECUTION_SERVICE_URL/bots/$BOT_ID/ready" \\
  -H "Content-Type: application/json" \\
  -d "{\\"success\\": true, \\"internalIp\\": \\"$INTERNAL_IP\\", \\"port\\": $GATEWAY_PORT, \\"gatewayToken\\": \\"$GATEWAY_TOKEN\\", \\"openclawVersion\\": \\"$OPENCLAW_VERSION\\"}" \\
  --retry 10 --retry-delay 5 --retry-connrefused --max-time 60

echo "[startup] === Bot VM ready: $BOT_ID ==="
`;
}

// ──────────────────────────────────────────────────────────────────────────────
// launchBotVM
// ──────────────────────────────────────────────────────────────────────────────

export interface LaunchBotVMOptions {
  botId: string;
  executionId: string;
  projectId: string;
  zone: string;
  network: string;
  subnet: string;
  toolGatewayUrl: string;
  executionServiceUrl: string;
  llmApiKeySecretName: string;
  llmProvider?: string;
  /** Service account email to attach to bot VMs (needs secretmanager.secretAccessor). */
  botServiceAccount: string;
  /** Pre-generated token the OpenClaw Gateway will require for WebSocket connections. */
  gatewayToken: string;
  /** Full SOUL.md markdown content for this bot's behavioral constitution */
  soulContent: string;
}

/**
 * Provision an ephemeral GCE bot VM.
 *
 * Creates an e2-standard-2 Ubuntu 22.04 VM with no external IP. The VM runs
 * the startup script which installs OpenClaw + SecureClaw, starts the OpenClaw
 * Gateway on port 18789, then POSTs to /bots/:botId/ready when ready.
 *
 * Returns as soon as the GCE insert operation completes (VM is being created),
 * NOT when the VM is fully booted. Actual readiness is signalled via the
 * /bots/:botId/ready callback from the startup script.
 *
 * @returns instanceName — the unique name of the created GCE instance
 */
export async function launchBotVM(opts: LaunchBotVMOptions): Promise<{ instanceName: string }> {
  const instanceName = `bot-${opts.botId.slice(0, 8)}-${Date.now()}`;
  const region = opts.zone.split('-').slice(0, -1).join('-');

  const startupScript = buildStartupScript({
    botId: opts.botId,
    executionId: opts.executionId,
    llmProvider: opts.llmProvider ?? 'anthropic',
    llmApiKeySecretName: opts.llmApiKeySecretName,
    toolGatewayUrl: opts.toolGatewayUrl,
    executionServiceUrl: opts.executionServiceUrl,
    gatewayToken: opts.gatewayToken,
    soulContent: opts.soulContent,
  });

  console.log('[gce-bot-launcher] Submitting GCE insert:', {
    instanceName,
    zone: opts.zone,
    botId: opts.botId,
    executionId: opts.executionId,
  });

  const [operation] = await instancesClient.insert({
    project: opts.projectId,
    zone: opts.zone,
    instanceResource: {
      name: instanceName,
      machineType: `zones/${opts.zone}/machineTypes/e2-standard-2`,
      disks: [
        {
          boot: true,
          autoDelete: true,
          initializeParams: {
            sourceImage: 'projects/ubuntu-os-cloud/global/images/family/ubuntu-2204-lts',
            diskSizeGb: '30',
            diskType: `zones/${opts.zone}/diskTypes/pd-balanced`,
          },
        },
      ],
      networkInterfaces: [
        {
          network: `projects/${opts.projectId}/global/networks/${opts.network}`,
          subnetwork: `projects/${opts.projectId}/regions/${region}/subnetworks/${opts.subnet}`,
          // No accessConfigs → no external IP; egress via Cloud NAT / Tool Gateway proxy
        },
      ],
      metadata: {
        items: [
          { key: 'startup-script', value: startupScript },
        ],
      },
      labels: {
        'managed-by': 'claw-army',
        'bot-id': opts.botId.slice(0, 8).replace(/-/g, ''),
        'execution-id': opts.executionId.slice(0, 8).replace(/-/g, ''),
      },
      serviceAccounts: [
        {
          email: opts.botServiceAccount,
          scopes: ['https://www.googleapis.com/auth/cloud-platform'],
        },
      ],
      tags: {
        items: ['claw-bot-vm'],
      },
    },
  });

  // Wait for the insert operation to reach DONE (VM created, not yet booted)
  await waitForOperation({
    projectId: opts.projectId,
    zone: opts.zone,
    operationName: operation.name!,
  });

  console.log('[gce-bot-launcher] GCE insert complete:', { instanceName, botId: opts.botId });

  return { instanceName };
}

// ──────────────────────────────────────────────────────────────────────────────
// terminateBotVM
// ──────────────────────────────────────────────────────────────────────────────

export interface TerminateBotVMOptions {
  projectId: string;
  zone: string;
  instanceName: string;
}

/**
 * Delete a GCE bot VM. Fires the delete operation and returns immediately —
 * does NOT wait for the operation to complete (deletion is eventual).
 */
export async function terminateBotVM(opts: TerminateBotVMOptions): Promise<void> {
  console.log('[gce-bot-launcher] Terminating GCE instance:', opts.instanceName);

  try {
    await instancesClient.delete({
      project: opts.projectId,
      zone: opts.zone,
      instance: opts.instanceName,
    });
  } catch (err) {
    // 404 = already deleted; log and continue
    const error = err as { code?: number; message?: string };
    if (error.code === 404) {
      console.warn('[gce-bot-launcher] Instance already deleted:', opts.instanceName);
      return;
    }
    console.error('[gce-bot-launcher] Error deleting instance:', {
      instanceName: opts.instanceName,
      error: error.message,
    });
    throw err;
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Operation polling helper
// ──────────────────────────────────────────────────────────────────────────────

async function waitForOperation(opts: {
  projectId: string;
  zone: string;
  operationName: string;
  timeoutMs?: number;
  pollIntervalMs?: number;
}): Promise<void> {
  const { projectId, zone, operationName } = opts;
  const timeoutMs = opts.timeoutMs ?? 120_000; // 2 minutes
  const pollIntervalMs = opts.pollIntervalMs ?? 3_000;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const [op] = await zoneOperationsClient.get({
      project: projectId,
      zone,
      operation: operationName,
    });

    if (op.status === 'DONE') {
      if (op.error?.errors?.length) {
        const msg = op.error.errors.map((e) => e.message).join('; ');
        throw new Error(`GCE operation failed: ${msg}`);
      }
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  throw new Error(
    `GCE operation ${operationName} did not complete within ${timeoutMs}ms`,
  );
}
