# Lumigift Mainnet Launch Checklist

> **Target network:** Stellar Mainnet / Soroban  
> **Status:** 🔴 Not started — work through each section before go-live.

---

## 1. Security Audit

- [ ] Smart contract (Soroban escrow) reviewed by an independent auditor
- [ ] Audit report published and critical/high findings resolved
- [ ] Dependency audit: `npm audit --audit-level=high` passes with zero high/critical
- [ ] Cargo audit: `cargo audit` passes with zero vulnerabilities
- [ ] Secrets scan: `gitleaks detect` finds no leaked keys in history
- [ ] OWASP Top-10 review completed for all API routes
- [ ] Rate-limiting and brute-force protection verified on `/api/auth/*`
- [ ] SQL-injection audit (`docs/audit/sql-injection-audit.md`) signed off
- [ ] CSP headers validated in production build (`next.config.mjs`)
- [ ] Penetration test scheduled (or completed) by external firm

## 2. Smart Contract Deployment

- [ ] Escrow contract compiled with `stellar contract build` (release profile)
- [ ] Contract deployed to Stellar **mainnet** via `STELLAR_NETWORK=mainnet npm run contract:deploy`
- [ ] `STELLAR_ESCROW_CONTRACT_ID` updated in production environment
- [ ] Contract ID recorded in `.contract-ids.json` and committed
- [ ] Contract invocation smoke-tested end-to-end on mainnet
- [ ] Admin/owner key stored in HSM or secrets manager (not `.env`)
- [ ] Contract migration runbook reviewed (`docs/ops/contract-migration.md`)

## 3. Payment Provider — Live Keys

- [ ] Paystack account verified and live keys obtained
- [ ] `PAYSTACK_SECRET_KEY` (live) set in production secrets manager
- [ ] `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY` (live) set in production env
- [ ] Paystack webhook endpoint registered and `PAYSTACK_WEBHOOK_SECRET` set
- [ ] Stripe live keys set (`STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`)
- [ ] Stripe webhook endpoint registered and `STRIPE_WEBHOOK_SECRET` set
- [ ] End-to-end payment flow tested with real cards (small amounts)
- [ ] Refund and chargeback procedures documented

## 4. Infrastructure & Monitoring

- [ ] Production PostgreSQL provisioned with automated backups (`docs/ops/database-backup.md`)
- [ ] Redis provisioned with persistence enabled (`docs/ops/redis.md`)
- [ ] All environment variables set in production secrets manager (no `.env` files on server)
- [ ] `NEXTAUTH_SECRET` rotated to a fresh production value
- [ ] Sentry DSN configured and error alerts routed to on-call channel
- [ ] Uptime monitoring configured (`docs/ops/uptime-monitoring.md`) — target 99.9 % SLA
- [ ] Alerting thresholds set: p95 latency > 2 s, error rate > 1 %, DB connections > 80 %
- [ ] Log aggregation (Datadog / Logtail / CloudWatch) receiving production logs
- [ ] Cron job (`/api/cron/unlock`) verified running on schedule in production
- [ ] `CRON_SECRET` set and cron endpoint protected
- [ ] Load test results reviewed (`docs/performance/load-test-results.md`) — target 200 RPS

## 5. Legal & Compliance

- [ ] Terms of Service published at `/terms` and linked in footer
- [ ] Privacy Policy published at `/privacy` and linked in footer
- [ ] **NDPR compliance** (Nigeria Data Protection Regulation):
  - [ ] Data Processing Agreement (DPA) in place with all sub-processors
  - [ ] Data inventory / ROPA (Record of Processing Activities) documented
  - [ ] User consent mechanism for data collection implemented
  - [ ] Data subject rights (access, deletion) request process documented
  - [ ] Data breach notification procedure documented (72-hour rule)
- [ ] Cookie consent banner implemented (if analytics cookies used)
- [ ] KYC/AML obligations reviewed with legal counsel for NGN on-ramp
- [ ] Money-service-business licensing requirements assessed for Nigeria

## 6. Support Channels

- [ ] Support chat widget live (Crisp / Intercom) — see issue #426
- [ ] Support email (`support@lumigift.com`) active and monitored
- [ ] Help centre / FAQ page live (`/help`, `/faq`)
- [ ] On-call rotation defined for launch week (at least 2 engineers)
- [ ] Escalation path documented: chat → email → engineering on-call
- [ ] Runbook reviewed by all on-call engineers (`docs/ops/runbook.md`)

## 7. Rollback Plan

- [ ] Previous contract version ID recorded; re-deploy procedure documented
- [ ] Database migration rollback scripts tested (`migrations/`)
- [ ] Feature flags / kill switches in place for payment providers
- [ ] DNS TTL reduced to 60 s before launch (revert to 300 s after stable)
- [ ] Rollback decision criteria defined:
  - Error rate > 5 % for > 5 minutes → rollback
  - Payment failure rate > 2 % → disable payment provider
  - Smart contract exploit detected → pause contract + notify users
- [ ] Rollback drill completed in staging environment

## 8. Launch Communication Plan

### Pre-launch (T-7 days)
- [ ] Landing page / waitlist live
- [ ] Social media accounts active (Twitter/X, Instagram, LinkedIn)
- [ ] Press release drafted and embargoed with tech journalists
- [ ] Email list imported into email platform; launch announcement drafted

### Launch day (T-0)
- [ ] Announcement tweet / thread published
- [ ] Product Hunt launch scheduled
- [ ] Email blast sent to waitlist
- [ ] Stellar community forum post published
- [ ] Team available in support chat for first 8 hours

### Post-launch (T+1 to T+7)
- [ ] Daily metrics review (signups, gifts sent, conversion rate)
- [ ] User feedback collected and triaged
- [ ] Bug reports prioritised and hotfixes deployed within 24 h
- [ ] Week-1 retrospective scheduled

---

## Sign-off

| Area | Owner | Date | Signed |
|------|-------|------|--------|
| Security audit | | | ☐ |
| Contract deployment | | | ☐ |
| Payments | | | ☐ |
| Infrastructure | | | ☐ |
| Legal / NDPR | | | ☐ |
| Support | | | ☐ |
| Rollback plan | | | ☐ |
| Communications | | | ☐ |

> All sections must be signed off before the production deployment tag is created.

---

## Statistical Significance Threshold (A/B Tests)

Minimum detectable effect: **5 %** relative lift  
Required confidence level: **95 %** (p < 0.05)  
Minimum sample size per variant: **500 unique users**  
See `docs/adr/` for A/B testing ADR.
