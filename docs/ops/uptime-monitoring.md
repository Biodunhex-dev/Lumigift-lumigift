# Uptime Monitoring

This document describes the uptime monitoring setup for Lumigift's critical endpoints and infrastructure.

## Monitored Endpoints

| Endpoint | Check Interval | Alert Threshold |
|----------|---------------|-----------------|
| `GET /api/health` | 1 minute | 2 consecutive failures |
| Stellar Horizon API (`STELLAR_HORIZON_URL`) | 1 minute | 2 consecutive failures |
| Soroban RPC (`STELLAR_RPC_URL`) | 5 minutes | 2 consecutive failures |

## Setup: BetterUptime (Recommended)

[BetterUptime](https://betteruptime.com) provides monitors, on-call schedules, and a hosted status page.

### 1. Create Monitors

Log in to BetterUptime and create the following monitors:

**Monitor 1 — App Health**
- URL: `https://<your-domain>/api/health`
- Method: `GET`
- Check frequency: **1 minute**
- Expected status: `200`
- Expected response body contains: `"status":"ok"`
- Alert after: **2 consecutive failures**

**Monitor 2 — Stellar Horizon**
- URL: `https://horizon.stellar.org/` (mainnet) or `https://horizon-testnet.stellar.org/` (testnet)
- Method: `GET`
- Check frequency: **1 minute**
- Expected status: `200`
- Alert after: **2 consecutive failures**

**Monitor 3 — Soroban RPC**
- URL: `https://soroban-rpc.stellar.org` (mainnet) or `https://soroban-testnet.stellar.org` (testnet)
- Method: `POST`
- Request body: `{"jsonrpc":"2.0","id":1,"method":"getHealth"}`
- Headers: `Content-Type: application/json`
- Check frequency: **5 minutes**
- Expected status: `200`
- Alert after: **2 consecutive failures**

### 2. Configure PagerDuty Alerts

1. In BetterUptime → **Integrations** → **PagerDuty** → connect your PagerDuty account.
2. Set the integration key from your PagerDuty service.
3. Assign the PagerDuty integration to each monitor above.
4. In PagerDuty, configure an escalation policy:
   - Level 1: On-call engineer (immediate)
   - Level 2: Engineering lead (after 15 min no acknowledgement)

Alternatively, use **Slack** alerts:
- BetterUptime → **Integrations** → **Slack** → select `#incidents` channel.

### 3. Status Page

1. In BetterUptime → **Status Pages** → **New Status Page**.
2. Add the three monitors above as components:
   - "Lumigift App" → `/api/health` monitor
   - "Stellar Network" → Horizon monitor
   - "Smart Contracts" → Soroban RPC monitor
3. Set a custom domain (e.g., `status.lumigift.app`) via CNAME to BetterUptime.
4. Link the status page URL in the app footer and README.

## Alternative: Statuspage.io

If using Atlassian Statuspage:

1. Create components matching the three monitors above.
2. Use the Statuspage API or a cron job to update component status based on health check results.
3. Configure PagerDuty or email notifications for subscribers.

## Incident Response

When an alert fires:

1. **Acknowledge** the alert in PagerDuty within 15 minutes.
2. **Diagnose** using the runbook: `docs/ops/runbook.md`.
3. **Update** the status page with an incident note.
4. **Resolve** the alert once the endpoint recovers.
5. **Post-mortem**: For P0/P1 incidents, file a post-mortem within 48 hours.

### Quick Diagnosis Commands

```bash
# Check app health
curl -s https://<your-domain>/api/health | jq .

# Check Stellar Horizon
curl -s https://horizon.stellar.org/ | jq .status

# Check Soroban RPC
curl -s -X POST https://soroban-rpc.stellar.org \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"getHealth"}' | jq .
```

## Environment Variables

No additional environment variables are required for monitoring. The monitors call public endpoints.

If you add authenticated monitoring (e.g., a `/api/health/deep` endpoint that checks DB connectivity), add a `HEALTH_CHECK_SECRET` env var and pass it as a Bearer token in the monitor's request headers.

## Reviewing Monitor Status

- BetterUptime dashboard: https://betteruptime.com/team/monitors
- Status page: https://status.lumigift.app (once configured)
- PagerDuty incidents: https://lumigift.pagerduty.com/incidents
