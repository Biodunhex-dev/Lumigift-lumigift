# Production Incident Runbook

This runbook provides procedures for handling common production incidents in Lumigift. Each incident includes symptoms, diagnosis steps, resolution steps, and escalation paths.

## General Guidelines

- **Alert Channels**: Incidents are alerted via Vercel monitoring, DataDog, or manual reports
- **Response Times**:
  - P0 (Critical): <15 minutes
  - P1 (High): <1 hour
  - P2 (Medium): <4 hours
- **Communication**: Update stakeholders via Slack #incidents channel
- **Post-Mortem**: Conduct blameless post-mortem for all P0/P1 incidents

## Database Connection Failure

### Symptoms
- API endpoints return 500 errors with "database connection failed"
- Application logs show `ConnectionError` or `ECONNREFUSED`
- Dashboard shows stale data
- User login/registration fails

### Diagnosis Steps
1. Check Vercel function logs for connection errors
2. Verify PostgreSQL instance status in cloud provider dashboard
3. Check connection pool exhaustion: `SELECT count(*) FROM pg_stat_activity WHERE state = 'idle in transaction';`
4. Test database connectivity: `psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "SELECT 1"`
5. Check for long-running queries: `SELECT pid, now() - query_start, query FROM pg_stat_activity WHERE state != 'idle' ORDER BY query_start;`

### Resolution Steps
1. **Connection Pool Exhaustion**:
   - Restart affected Vercel functions
   - Increase pool size if pattern persists (update `DATABASE_URL` with `?pool_size=20`)

2. **Database Instance Down**:
   - Restart database instance via cloud provider console
   - If restart fails, restore from latest backup
   - Update DNS/connection strings if instance migrated

3. **Network Issues**:
   - Check VPC security groups allow connections from Vercel
   - Verify SSL certificates are valid
   - Test from different regions

### Escalation Path
- If database unrecoverable: Escalate to engineering lead for data restoration
- If widespread outage: Escalate to CTO for customer communication

## Redis Outage

### Symptoms
- Paystack webhook processing fails
- Cron jobs don't execute
- Application logs show Redis connection errors
- User payments stuck in "processing" state

### Diagnosis Steps
1. Check Redis instance status in cloud provider
2. Test connectivity: `redis-cli -h $REDIS_HOST -p $REDIS_PORT ping`
3. Check Redis memory usage: `redis-cli info memory`
4. Verify AOF persistence status: `redis-cli info persistence`
5. Check for long-running Lua scripts: `redis-cli script kill` (if applicable)

### Resolution Steps
1. **Redis Instance Down**:
   - Restart Redis instance
   - If AOF corrupted, follow recovery procedure in `docs/ops/redis.md`
   - Re-queue missed jobs from PostgreSQL backup

2. **Memory Exhaustion**:
   - Increase Redis instance size
   - Clear expired keys: `redis-cli keys "*" | xargs redis-cli del` (careful!)
   - Implement key expiration policies

3. **Connection Issues**:
   - Check Redis ACLs allow application connections
   - Verify TLS configuration if enabled

### Escalation Path
- If data loss: Escalate to engineering lead for job reconstruction
- If Redis cluster issues: Contact cloud provider support

## Stellar Network Degradation

### Symptoms
- Gift claims fail with "network error"
- Contract deployments timeout
- Application logs show Stellar RPC errors
- Users report "transaction failed" messages

### Diagnosis Steps
1. Check Stellar network status: https://status.stellar.org/
2. Test RPC connectivity: `curl -X POST https://soroban-rpc.stellar.org -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","id":1,"method":"getHealth"}'`
3. Check Horizon API: `curl https://horizon.stellar.org/`
4. Monitor Soroban RPC latency and error rates
5. Check application logs for `NetworkError` or `TimeoutError`

### Resolution Steps
1. **Temporary Network Issues**:
   - Implement exponential backoff retry logic
   - Switch to backup RPC endpoints if available
   - Queue failed transactions for later retry

2. **RPC Node Issues**:
   - Update RPC URLs to healthy nodes
   - Implement RPC failover in application config

3. **Horizon API Issues**:
   - Use alternative Horizon instances
   - Implement caching for frequently accessed data

### Escalation Path
- If network-wide outage: Monitor Stellar status page, no immediate action
- If application-specific: Escalate to engineering team for code fixes

## Paystack Webhook Failures

### Symptoms
- Payments don't update gift status
- Users report successful payment but gift still "pending"
- Paystack dashboard shows webhook delivery failures
- Application logs show webhook signature validation errors

### Diagnosis Steps
1. Check Vercel function logs for webhook endpoint errors
2. Verify webhook URL in Paystack dashboard matches production URL
3. Test webhook signature validation manually
4. Check Redis queue for stuck webhook jobs
5. Verify Paystack API key validity

### Resolution Steps
1. **Webhook URL Mismatch**:
   - Update webhook URL in Paystack dashboard
   - Resend failed webhooks via Paystack dashboard

2. **Signature Validation Issues**:
   - Verify `PAYSTACK_SECRET_KEY` environment variable
   - Check webhook payload parsing logic

3. **Processing Failures**:
   - Clear Redis queue and reprocess webhooks
   - Manually update affected gift statuses from Paystack dashboard data

### Escalation Path
- If Paystack API issues: Contact Paystack support
- If widespread payment failures: Escalate to CTO for payment provider communication

## Cron Job Failure

### Symptoms
- Gifts don't unlock on schedule
- Expiry processing doesn't run
- Application logs missing cron execution entries
- Vercel cron dashboard shows failures

### Diagnosis Steps
1. Check Vercel cron job status and logs
2. Verify cron schedule configuration
3. Test cron endpoints manually: `curl https://lumigift.com/api/cron/unlock`
4. Check for long-running cron jobs blocking new executions
5. Verify database connectivity from cron functions

### Resolution Steps
1. **Cron Function Errors**:
   - Fix code issues and redeploy
   - Manually trigger missed unlocks via admin interface

2. **Schedule Issues**:
   - Update cron expressions in Vercel dashboard
   - Adjust timezone settings if needed

3. **Timeout Issues**:
   - Optimize cron job performance
   - Split large jobs into batches

### Escalation Path
- If manual intervention needed: Escalate to engineering lead
- If cron system down: Contact Vercel support

## Application Performance Degradation

### Symptoms
- API response times >5 seconds
- High error rates (>5%)
- Database CPU/memory usage spikes
- User reports of slow loading

### Diagnosis Steps
1. Check Vercel function metrics and logs
2. Monitor database performance: slow query logs
3. Check Redis memory and connection counts
4. Review recent deployments for performance regressions
5. Test external API dependencies (Paystack, Stellar)

### Resolution Steps
1. **Database Performance**:
   - Add missing indexes on frequently queried columns
   - Optimize slow queries
   - Scale database instance if needed

2. **Application Issues**:
   - Roll back recent deployments if suspected
   - Implement caching for expensive operations
   - Scale Vercel function concurrency

3. **External Dependencies**:
   - Implement circuit breakers for failing services
   - Add timeouts and retry logic

### Escalation Path
- If performance doesn't improve: Escalate to engineering team for deep analysis
- If affecting revenue: Escalate to CTO

## Security Incident

### Symptoms
- Unusual login attempts or API usage
- Unexpected data modifications
- Security monitoring alerts
- User reports of unauthorized access

### Diagnosis Steps
1. Review application security logs
2. Check for suspicious IP addresses or user agents
3. Verify API key usage and permissions
4. Audit recent database changes
5. Check for malware or unauthorized code deployments

### Resolution Steps
1. **Immediate Response**:
   - Rotate compromised credentials
   - Block suspicious IPs
   - Disable affected user accounts

2. **Investigation**:
   - Preserve logs and evidence
   - Conduct security audit
   - Implement additional monitoring

3. **Recovery**:
   - Restore from clean backups if needed
   - Update security policies

### Escalation Path
- Always escalate to CTO and security team
- Involve legal if data breach suspected
- Notify affected users if necessary

## Communication Templates

### Internal Incident Update
```
🚨 Incident Update: [Brief Title]

Status: [Investigating|Identified|Resolved]
Impact: [Description of user impact]
Timeline:
- Detected: [Time]
- Current status: [What we know]
- ETA: [If known]

Next update: [Time]
```

### Customer Communication
```
Subject: Lumigift Service Update

Dear valued user,

We're experiencing [brief issue description] that may affect [specific functionality].

Our team is working to resolve this quickly. Service should be restored by [ETA].

We apologize for any inconvenience.

Best,
Lumigift Team
```

---

*This runbook is reviewed quarterly and updated as systems evolve. Last reviewed: [Date]*

## Log Aggregation

### Overview
All application logs are emitted as structured JSON (pino) to stdout. In production
the log stream is shipped to **Logtail / Betterstack** via the `LOG_AGGREGATION_URL`
and `LOG_AGGREGATION_TOKEN` environment variables.

### Setup
1. Create a **HTTP source** in Betterstack (or your chosen provider).
2. Copy the ingest URL and token into your deployment environment:
   ```
   LOG_AGGREGATION_URL=https://in.logs.betterstack.com
   LOG_AGGREGATION_TOKEN=<source-token>
   ```
3. Set `LOG_LEVEL=info` in production (use `debug` locally).

### Retention Policy
Configure **30-day retention** in the Betterstack source settings
(Sources → your source → Retention).

### Alerts
Configure the following alert rules in Betterstack (or equivalent):

| Alert | Condition | Channel |
|-------|-----------|---------|
| High error rate | `level = "error"` count > 10 in 5 min | Slack #incidents |
| Auth failures | `service = "auth"` + `level = "error"` > 5 in 1 min | Slack #incidents |
| Payment failures | `service = "paystack"` + `level = "error"` > 3 in 5 min | Slack #incidents |

### Key Metrics Dashboard
Create a dashboard with these queries:

- **Request rate**: count of `level = "info"` logs per minute
- **Error rate**: count of `level = "error"` logs per minute
- **Auth errors**: filter `service = "auth"` + `level = "error"`
- **P95 latency**: if using pino-http, filter on `responseTime` field

### Sensitive Data
The logger redacts the following fields before shipping:
`phone`, `recipientPhone`, `recipientPhoneHash`, `authorization`, `cookie`.
