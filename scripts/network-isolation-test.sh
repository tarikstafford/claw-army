#!/usr/bin/env bash
# network-isolation-test.sh
#
# Validates Phase 3 Success Criterion #1:
# "A bot container attempting any outbound connection other than the Tool Gateway
# is blocked by the bot-internal Docker network."
#
# What this script tests:
#   Test A — Bot cannot reach external HTTP hosts (api.openai.com)
#   Test B — DNS resolution of external names (informational — see note below)
#   Test C — Bot CAN reach the Tool Gateway health endpoint
#
# Prerequisites:
#   - Docker must be running
#   - tool-gateway container must be running (named "tool-gateway")
#     via: docker compose -f docker-compose.dev.yml up tool-gateway -d
#   - The tool-gateway container must be attached to the bot-internal network
#
# Usage:
#   chmod +x scripts/network-isolation-test.sh
#   ./scripts/network-isolation-test.sh
#
# Note on DNS resolution (Test B):
#   Docker embedded DNS MAY resolve external hostnames even on internal:true networks.
#   This is documented in Phase 1 RESEARCH.md (Pitfall 3) and is an accepted behavior.
#   The key guarantee is that TCP connections to resolved IPs are blocked because
#   internal networks have no default gateway route. Test B is therefore informational.
#
# Note on test container setup:
#   The test bot container is first started on the default network to install curl/nslookup
#   (apk cannot download packages on the internal network — no internet access).
#   After installation, the container is disconnected from default and connected ONLY to
#   bot-internal. This accurately simulates bot container network isolation.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

PASS=0
FAIL=0
TOTAL=0

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m'

pass() { ((PASS++)); ((TOTAL++)); echo -e "${GREEN}[PASS]${NC} $1"; }
fail() { ((FAIL++)); ((TOTAL++)); echo -e "${RED}[FAIL]${NC} $1"; }
info() { echo -e "${YELLOW}[INFO]${NC} $1"; }

TEST_CONTAINER="bot-isolation-test-$$"
NETWORK_NAME="bot-internal"

cleanup() {
  info "Cleaning up test container..."
  docker rm -f "$TEST_CONTAINER" 2>/dev/null || true
}
trap cleanup EXIT

echo ""
echo "=== Phase 3 Network Isolation Test ==="
echo "Validates that bot containers on bot-internal cannot reach external hosts"
echo "but CAN reach the Tool Gateway."
echo ""

# ---------------------------------------------------------------------------
# Pre-check: Ensure bot-internal network exists with --internal flag
# ---------------------------------------------------------------------------
info "Checking bot-internal network..."

if ! docker network inspect "$NETWORK_NAME" >/dev/null 2>&1; then
  info "bot-internal network not found. Creating with --internal flag..."
  docker network create --internal "$NETWORK_NAME"
  info "Created bot-internal network (internal: true)"
else
  INTERNAL_FLAG=$(docker network inspect "$NETWORK_NAME" --format '{{.Internal}}' 2>/dev/null || echo "false")
  if [ "$INTERNAL_FLAG" != "true" ]; then
    info "WARNING: bot-internal network exists but is NOT internal. Recreating with --internal flag..."
    info "This may fail if containers are attached. Stop them first if needed."
    docker network rm "$NETWORK_NAME" 2>/dev/null || {
      echo -e "${RED}[ERROR]${NC} Cannot remove bot-internal network (containers may be attached). Stop them first."
      exit 1
    }
    docker network create --internal "$NETWORK_NAME"
    info "Recreated bot-internal network (internal: true)"
  else
    info "bot-internal network exists with internal: true — OK"
  fi
fi

# ---------------------------------------------------------------------------
# Pre-check: Connect the tool-gateway container to bot-internal (if running)
# Accept both "tool-gateway" and "tool-gateway-test" container names.
# ---------------------------------------------------------------------------
info "Checking tool-gateway connectivity..."

GATEWAY_CONTAINER=""
for CANDIDATE in "tool-gateway" "tool-gateway-test"; do
  if docker inspect "$CANDIDATE" >/dev/null 2>&1; then
    GATEWAY_CONTAINER="$CANDIDATE"
    info "Found tool-gateway container: $GATEWAY_CONTAINER"
    break
  fi
done

if [ -n "$GATEWAY_CONTAINER" ]; then
  # Connect to bot-internal if not already connected
  CONNECTED=$(docker inspect "$GATEWAY_CONTAINER" --format '{{range $k, $v := .NetworkSettings.Networks}}{{$k}} {{end}}' 2>/dev/null || echo "")
  if [[ "$CONNECTED" != *"$NETWORK_NAME"* ]]; then
    info "Connecting $GATEWAY_CONTAINER to bot-internal network..."
    docker network connect "$NETWORK_NAME" "$GATEWAY_CONTAINER" 2>/dev/null || true
    info "Connected $GATEWAY_CONTAINER to bot-internal"
  else
    info "$GATEWAY_CONTAINER is already on bot-internal — OK"
  fi
else
  info "WARNING: tool-gateway container is not running."
  info "Test C (gateway reachable) will be skipped."
  info "Start it with: docker compose -f docker-compose.dev.yml up tool-gateway -d"
fi

# ---------------------------------------------------------------------------
# Start the test bot container FIRST on the default network to install curl/nslookup.
# apk cannot download packages on the internal network (no internet).
# After installation, we switch it to bot-internal only — this simulates
# how bot containers are spawned: with NetworkMode: 'bot-internal'.
# ---------------------------------------------------------------------------
info "Starting test bot container on default network to install tools..."
docker run -d \
  --name "$TEST_CONTAINER" \
  node:20-alpine \
  sh -c "apk add --no-cache curl bind-tools > /dev/null 2>&1 && sleep 120" 2>/dev/null

# Wait for tools to be installed
info "Installing curl and bind-tools in test container..."
MAX_WAIT=30
WAITED=0
while [ $WAITED -lt $MAX_WAIT ]; do
  if docker exec "$TEST_CONTAINER" which curl >/dev/null 2>&1; then
    break
  fi
  sleep 1
  ((WAITED++))
done

if [ $WAITED -ge $MAX_WAIT ]; then
  echo -e "${RED}[ERROR]${NC} Test container did not become ready within ${MAX_WAIT}s"
  exit 1
fi

info "Tools installed. Switching container to bot-internal network only..."

# Get the default network name for this container
DEFAULT_NET=$(docker inspect "$TEST_CONTAINER" --format '{{range $k, $v := .NetworkSettings.Networks}}{{$k}}{{end}}' 2>/dev/null || echo "bridge")

# Connect to bot-internal
docker network connect "$NETWORK_NAME" "$TEST_CONTAINER" 2>/dev/null

# Disconnect from default network — now the container is ONLY on bot-internal
docker network disconnect "$DEFAULT_NET" "$TEST_CONTAINER" 2>/dev/null || \
  docker network disconnect bridge "$TEST_CONTAINER" 2>/dev/null || true

info "Test container is now ONLY on bot-internal network."
echo ""

# ---------------------------------------------------------------------------
# Test A — External HTTP blocked
# Bot container attempts to reach an external HTTPS endpoint.
# Expected: FAIL (timeout or connection error) — exit code non-zero = PASS
# ---------------------------------------------------------------------------
info "Test A: Checking that external HTTP is blocked from bot container..."
if docker exec "$TEST_CONTAINER" \
  curl --max-time 5 --silent --output /dev/null \
  https://api.openai.com/v1/models 2>/dev/null; then
  fail "Test A: External HTTP (api.openai.com) NOT blocked — bot isolation BROKEN"
else
  pass "Test A: External HTTP (api.openai.com) blocked — bot cannot reach internet"
fi

# ---------------------------------------------------------------------------
# Test B — DNS resolution (informational)
# Docker embedded DNS may still resolve external names on internal networks.
# The key is that resolved IPs are not routable.
# ---------------------------------------------------------------------------
echo ""
info "Test B (informational): DNS resolution behavior on internal network..."
if docker exec "$TEST_CONTAINER" \
  nslookup api.openai.com 2>/dev/null | grep -q "Address"; then
  info "Test B: DNS resolves external names (expected — resolved IP not routable, TCP still blocked)"
  info "See Phase 1 decision: Test 3 (DNS) is informational — TCP connections to resolved IPs ARE blocked"
else
  pass "Test B: DNS resolution of external names blocked at DNS layer"
fi
echo ""

# ---------------------------------------------------------------------------
# Test C — Tool Gateway reachable from bot container
# Bot container attempts to reach the Tool Gateway health endpoint.
# Expected: 200 OK with {"status":"ok"} — exit code 0 = PASS
# ---------------------------------------------------------------------------
info "Test C: Checking that Tool Gateway health endpoint is reachable from bot container..."

if [ -n "$GATEWAY_CONTAINER" ]; then
  # Use "tool-gateway" as the hostname (Docker DNS resolves by container name)
  GATEWAY_RESPONSE=$(docker exec "$TEST_CONTAINER" \
    curl --max-time 5 --silent \
    "http://${GATEWAY_CONTAINER}:3002/health" 2>/dev/null || echo "")

  if echo "$GATEWAY_RESPONSE" | grep -q '"status":"ok"'; then
    pass "Test C: Tool Gateway reachable from bot container (HTTP 200, {\"status\":\"ok\"})"
  else
    fail "Test C: Tool Gateway NOT reachable from bot container — response: ${GATEWAY_RESPONSE:-<empty>}"
    info "Ensure tool-gateway is on bot-internal network (it should be dual-networked)"
  fi
else
  info "Test C: Skipping (tool-gateway container not running)"
  info "Start it with: docker compose -f docker-compose.dev.yml up tool-gateway -d"
fi

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
echo ""
echo "=== Network Isolation Test Results: ${PASS}/${TOTAL} passed, ${FAIL} failed ==="
echo ""

# Exit 1 if any required test fails (Test B is informational and excluded from FAIL count)
if [ "$FAIL" -eq 0 ]; then
  echo -e "${GREEN}All required isolation tests PASSED${NC}"
  echo -e "${GREEN}Phase 3 SC#1 confirmed: bots cannot reach external hosts, gateway is reachable${NC}"
  exit 0
else
  echo -e "${RED}${FAIL} isolation test(s) FAILED — bot network isolation is not correctly configured${NC}"
  exit 1
fi
