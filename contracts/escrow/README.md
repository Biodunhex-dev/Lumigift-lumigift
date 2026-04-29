# Lumigift Escrow Contract

[![Contract Coverage](https://img.shields.io/badge/coverage-≥85%25-brightgreen)](../../.github/workflows/ci.yml)

Soroban smart contract that time-locks USDC for a recipient until a predetermined timestamp.

## Error Codes

| Variant | Code | Description |
|---|---|---|
| `AlreadyInitialized` | 1 | `initialize` was called on a contract that is already set up |
| `AlreadyClaimed` | 2 | `claim` was called after the funds were already claimed |
| `StillLocked` | 3 | `claim` was called before `unlock_time` has passed |
| `NotInitialized` | 4 | A function requiring state was called before `initialize` |
| `Unauthorized` | 5 | Reserved for future access-control checks |
| `AlreadyCancelled` | 6 | Reserved for future cancellation logic |

## Functions

### `initialize(sender, recipient, token, amount, unlock_time) → Result<(), EscrowError>`

Deploys escrow state and transfers `amount` of `token` from `sender` into the contract.
Fails with `AlreadyInitialized` if called more than once.

Automatically extends the instance TTL to cover `unlock_time` plus a 30-day buffer.

### `claim() → Result<(), EscrowError>`

Transfers the locked funds to `recipient`. Requires:
- Caller is `recipient`
- Current ledger timestamp ≥ `unlock_time`
- Funds have not already been claimed

Extends the instance TTL to a 7-day post-claim window so the claimed state remains readable for reconciliation.

### `extend_ttl() → Result<(), EscrowError>`

Permissionless keeper function — anyone can call this to bump the instance TTL before it expires. Returns `NotInitialized` if the contract has not been set up.

### `get_state() → Result<(Address, i128, u64, bool), EscrowError>`

Returns `(recipient, amount, unlock_time, claimed)`. Fails with `NotInitialized` if the contract has not been set up.

---

## Instance Storage TTL Strategy

Soroban instance storage has a finite TTL measured in ledgers. If the TTL expires the contract state is **archived and inaccessible** — a critical failure for long-lived escrows (e.g. 1-year gifts).

### The problem

Stellar's default maximum instance TTL is roughly 30 days. A gift with a 1-year unlock time would have its contract state archived ~11 months before the recipient can claim.

### The solution

The contract manages TTL proactively at three points:

| When | What happens |
|---|---|
| `initialize` | TTL set to `ceil((unlock_time - now) / 5s) + 518,400 ledgers` (30-day buffer) |
| `claim` | TTL extended to 120,960 ledgers (7 days) for post-claim readability |
| `extend_ttl` (public) | Anyone can bump the TTL; fires only when current TTL < 120,960 ledgers (7-day threshold) |

### Ledger arithmetic

Stellar closes roughly one ledger every **5 seconds**:

```
1 day   ≈  17,280 ledgers   (86,400 s ÷ 5 s)
7 days  ≈ 120,960 ledgers
30 days ≈ 518,400 ledgers
1 year  ≈ 6,307,200 ledgers
```

The required TTL for a given escrow is:

```
required_ledgers = ceil((unlock_time - now_secs) / 5)
                 + 518,400   ← 30-day safety buffer
```

`extend_ttl(threshold, new_ttl)` is a **no-op** when the current TTL is already ≥ `threshold`, so calling it on every `initialize` / `claim` is safe and cheap.

### Keeper responsibility

The platform backend should periodically call `extend_ttl` on all active escrows. Because the function is permissionless, third-party keepers or the recipient themselves can also call it. The 7-day threshold means a daily keeper job has a 7× safety margin before state archival.

```
Recommended keeper schedule: daily
Safety margin at 7-day threshold: 7 days
```

