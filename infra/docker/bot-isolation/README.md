# Bot Network Isolation Test

Validates the Docker network isolation topology that mirrors the production bot architecture.

## Architecture

```
┌─────────────────────────────────────────┐
│           bot-internal network           │
│         (internal: true)                 │
│                                          │
│  ┌──────────────┐  ┌──────────────────┐  │
│  │  bot-test    │  │ tool-gateway-stub │  │
│  │  (bot-only)  │  │ (bot-internal    │  │
│  └──────────────┘  │  + external)     │  │
│                    └───────┬──────────┘  │
└────────────────────────────│─────────────┘
                             │
                    ┌────────┴────────┐
                    │ external network │
                    │ (internet access)│
                    └─────────────────┘
```

**Key principle:** Bots on `bot-internal` (an `internal: true` bridge network) cannot reach the internet or the Docker host. Their only reachable service is `tool-gateway-stub`, which bridges `bot-internal` and `external` networks — mirroring the production Tool Gateway topology.

## Running the Test

```bash
./egress-test.sh
```

Expected output:

```
=== Bot Network Isolation Egress Test ===

[PASS] TCP to external IP (8.8.8.8:443) blocked
[PASS] HTTP to external hostname (google.com) blocked
[INFO] DNS resolves external names (expected -- resolved IP not routable, TCP still blocked)
[PASS] Bot can reach Tool Gateway stub (HTTP 200, body: Gateway OK)
[PASS] Gateway can reach external hosts (google.com reachable from dual-network container)
[PASS] Bot cannot reach host network (host.docker.internal:80 blocked)

=== Results: 6/6 passed, 0 failed ===

All required isolation tests PASSED
```

## Files

| File | Purpose |
|------|---------|
| `docker-compose.yml` | Network topology: `bot-internal` (internal) + `external` networks, two services |
| `Dockerfile.bot-test` | Alpine 3.20 with curl, wget, bind-tools, netcat-openbsd for egress testing |
| `Dockerfile.gateway-stub` | Alpine 3.20 with Python 3 HTTP server listening on port 8080 |
| `egress-test.sh` | Automated egress validation: runs all 6 tests, reports PASS/FAIL, tears down |

## What Is Tested

| Test | What It Validates | Required |
|------|------------------|----------|
| 1 | TCP to external IP (8.8.8.8:443) is blocked from bot | Yes |
| 2 | HTTP to external hostname (google.com) is blocked from bot | Yes |
| 3 | DNS resolution behavior on internal network (informational) | No |
| 4 | Bot CAN reach Tool Gateway stub via HTTP on internal network | Yes |
| 5 | Tool Gateway stub CAN reach external hosts (dual-network works) | Yes |
| 6 | Bot cannot reach Docker host network | Yes |

## Notes

- Test 3 is informational: Docker's embedded DNS may resolve external hostnames even on `internal: true` networks. The key is that the resolved IP is not routable. Tests 1 and 2 validate that TCP connections (not just DNS) are blocked.
- Production uses GCP VPC firewall rules for bot isolation. This Docker topology is the local dev analog.
- See `01-RESEARCH.md` Pattern 4 and Pitfall 3 for detailed background.
