# SQL Injection Audit — Issue #87

**Date:** 2026-04-29  
**Auditor:** Automated scan + manual review  
**Status:** ✅ No vulnerabilities found

## Scope

All files in `src/` and `scripts/` that call `pool.query()` were reviewed for raw string interpolation in SQL statements.

## Methodology

1. Searched for all `pool.query(` call sites using static analysis.
2. Verified each call uses parameterized placeholders (`$1`, `$2`, …) for user-supplied values.
3. Confirmed no template literals concatenate user input directly into SQL strings.

## Findings

| File | Query | Parameterized? | Notes |
|------|-------|---------------|-------|
| `src/lib/auth.ts` | `SELECT 1 FROM known_devices WHERE user_id = $1 AND fingerprint = $2` | ✅ Yes | |
| `src/lib/auth.ts` | `INSERT INTO known_devices (user_id, fingerprint) VALUES ($1, $2)` | ✅ Yes | |
| `src/lib/auth.ts` | `UPDATE known_devices SET last_seen_at = NOW() WHERE user_id = $1 AND fingerprint = $2` | ✅ Yes | |
| `src/lib/auth.ts` | `SELECT id, phone, name FROM users WHERE phone = $1` | ✅ Yes | |
| `src/app/api/v1/users/route.ts` | `SELECT 1 FROM users WHERE phone = $1 LIMIT 1` | ✅ Yes | |
| `src/app/api/v1/auth/register/route.ts` | `SELECT 1 FROM users WHERE phone = $1 LIMIT 1` | ✅ Yes | |
| `src/app/api/v1/auth/register/route.ts` | `INSERT INTO users (id, phone, display_name) VALUES ($1, $2, $3)` | ✅ Yes | |
| `src/app/api/v1/auth/report-login/route.ts` | `INSERT INTO suspicious_login_reports (user_id, fingerprint) VALUES ($1, $2)` | ✅ Yes | |
| `src/server/services/gift.service.ts` | `SELECT display_name FROM users WHERE id = $1` | ✅ Yes | |
| `src/server/services/invitation.service.ts` | `INSERT INTO gift_invitations … VALUES ($1, $2, $3, $4, $5, $6)` | ✅ Yes | |
| `src/server/services/invitation.service.ts` | `SELECT … FROM gift_invitations WHERE token = $1` | ✅ Yes | |
| `src/server/services/invitation.service.ts` | `UPDATE gift_invitations SET status = 'accepted' … WHERE id = $1` | ✅ Yes | |
| `src/server/services/invitation.service.ts` | `UPDATE gift_invitations SET status = 'claimed' … WHERE id = $1` | ✅ Yes | |
| `src/server/services/invitation.service.ts` | `SELECT … FROM gift_invitations WHERE recipient_phone = $1 AND gift_id = $2` | ✅ Yes | |
| `scripts/seed-test-db.ts` | DDL statements (CREATE TABLE, CREATE INDEX) | ✅ N/A | No user input; static schema only |
| `scripts/seed-test-db.ts` | `INSERT INTO users … VALUES ($1, $2, $3)` | ✅ Yes | |
| `scripts/seed-test-db.ts` | `INSERT INTO gifts … VALUES ($1, $2, …)` | ✅ Yes | |
| `src/app/api/v1/payments/__tests__/webhook.integration.test.ts` | Various test queries | ✅ Yes | Test file; no user input |

## Conclusion

**No SQL injection vulnerabilities were found.** All database queries consistently use the `pg` driver's parameterized query API (`pool.query(sql, [params])`). No raw template literal string interpolation of user-controlled values was detected.

## Preventive Controls Added

An ESLint rule (`no-restricted-syntax`) has been added to `.eslintrc.json` to detect potential SQL injection patterns at lint time. See the rule configuration for details.

## Recommendations

1. Maintain the parameterized query pattern for all future database calls.
2. Run `npm run lint` in CI to enforce the ESLint SQL injection rule on every PR.
3. Re-run this audit whenever a new database query is introduced (can be automated via the ESLint rule).
4. Consider adopting a query builder (e.g., Kysely) in the future to make parameterization the only possible path.
