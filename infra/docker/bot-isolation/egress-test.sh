#!/usr/bin/env bash
set -euo pipefail

# Egress test for bot network isolation
# Tests that bot containers cannot reach external hosts
# but CAN reach the Tool Gateway stub

COMPOSE_FILE="$(dirname "$0")/docker-compose.yml"
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

echo ""
echo "=== Bot Network Isolation Egress Test ==="
echo "Testing that bot containers cannot reach external hosts"
echo "but CAN reach the Tool Gateway stub on the internal network"
echo ""

# Start containers
info "Building and starting containers..."
docker compose -f "$COMPOSE_FILE" up -d --build 2>&1 | tail -5

# Wait for containers to be ready, with readiness probe for gateway stub
info "Waiting for containers to be ready..."
sleep 3

# Readiness probe: wait up to 15s for the gateway HTTP server to respond
READY=0
for i in $(seq 1 5); do
  if docker compose -f "$COMPOSE_FILE" exec -T bot-test \
    sh -c "wget -T 2 -q -O /dev/null http://tool-gateway-stub:8080" 2>/dev/null; then
    READY=1
    break
  fi
  info "Gateway not ready yet, retrying in 2s... (attempt $i/5)"
  sleep 2
done

if [ "$READY" -eq 0 ]; then
  info "Gateway readiness probe timed out -- proceeding with tests anyway"
fi

echo ""

# ---------------------------------------------------------------------------
# Test 1 -- TCP to external IP is blocked
# Attempt TCP connection to a known external IP (Google DNS 8.8.8.8:443)
# Expected: connection refused or timeout (exit code != 0)
# ---------------------------------------------------------------------------
if docker compose -f "$COMPOSE_FILE" exec -T bot-test \
  sh -c "nc -z -w 3 8.8.8.8 443" 2>/dev/null; then
  fail "TCP to external IP (8.8.8.8:443) NOT blocked -- isolation BROKEN"
else
  pass "TCP to external IP (8.8.8.8:443) blocked"
fi

# ---------------------------------------------------------------------------
# Test 2 -- TCP to external hostname is blocked
# Attempt HTTP request to google.com
# Expected: connection fails
# ---------------------------------------------------------------------------
if docker compose -f "$COMPOSE_FILE" exec -T bot-test \
  sh -c "wget -T 3 -q -O /dev/null https://google.com" 2>/dev/null; then
  fail "HTTP to external hostname (google.com) NOT blocked -- isolation BROKEN"
else
  pass "HTTP to external hostname (google.com) blocked"
fi

# ---------------------------------------------------------------------------
# Test 3 -- DNS resolution of external hostname (informational)
# Note from RESEARCH.md Pitfall 3: Docker embedded DNS MAY still resolve
# external names even on internal networks. The key is that the resolved IP
# is not ROUTABLE. This test documents the behavior.
# ---------------------------------------------------------------------------
echo ""
info "Test 3 (informational): DNS resolution behavior on internal network..."
if docker compose -f "$COMPOSE_FILE" exec -T bot-test \
  sh -c "nslookup google.com" 2>/dev/null | grep -q "Address"; then
  info "DNS resolves external names (expected -- resolved IP not routable, TCP still blocked)"
else
  pass "DNS resolution of external names blocked at DNS layer"
fi
echo ""

# ---------------------------------------------------------------------------
# Test 4 -- Bot CAN reach Tool Gateway stub (container-to-container)
# Attempt HTTP request to tool-gateway-stub on internal network
# Expected: 200 OK with "Gateway OK" body
# ---------------------------------------------------------------------------
if docker compose -f "$COMPOSE_FILE" exec -T bot-test \
  sh -c "wget -T 3 -q -O - http://tool-gateway-stub:8080" 2>/dev/null | grep -q "Gateway OK"; then
  pass "Bot can reach Tool Gateway stub (HTTP 200, body: Gateway OK)"
else
  fail "Bot CANNOT reach Tool Gateway stub -- internal networking broken"
fi

# ---------------------------------------------------------------------------
# Test 5 -- Gateway CAN reach external hosts (dual-network verification)
# Verify the gateway can reach the internet (it's on the external network)
# Expected: success (exit code 0)
# ---------------------------------------------------------------------------
if docker compose -f "$COMPOSE_FILE" exec -T tool-gateway-stub \
  sh -c "wget -T 5 -q -O /dev/null https://google.com" 2>/dev/null; then
  pass "Gateway can reach external hosts (google.com reachable from dual-network container)"
else
  fail "Gateway CANNOT reach external hosts -- dual-network routing broken"
fi

# ---------------------------------------------------------------------------
# Test 6 -- Bot cannot reach host network services
# Attempt to reach host.docker.internal (Docker host)
# Expected: blocked
# ---------------------------------------------------------------------------
if docker compose -f "$COMPOSE_FILE" exec -T bot-test \
  sh -c "nc -z -w 3 host.docker.internal 80" 2>/dev/null; then
  fail "Bot can reach host network (host.docker.internal:80) -- isolation incomplete"
else
  pass "Bot cannot reach host network (host.docker.internal:80 blocked)"
fi

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
echo ""
echo "=== Results: ${PASS}/$((TOTAL - 0)) passed, ${FAIL} failed ==="
echo ""

# Tear down containers
info "Tearing down containers..."
docker compose -f "$COMPOSE_FILE" down 2>&1 | tail -3

echo ""

# Exit 0 only if all required tests pass (tests 1,2,4,5,6 are required)
# Test 3 is informational and does not affect exit code
if [ "$FAIL" -eq 0 ]; then
  echo -e "${GREEN}All required isolation tests PASSED${NC}"
  exit 0
else
  echo -e "${RED}${FAIL} isolation test(s) FAILED -- bot network isolation is not configured correctly${NC}"
  exit 1
fi
