# Lumigift Escrow Contract

[![Contract Coverage](https://img.shields.io/badge/coverage-≥85%25-brightgreen)](../../.github/workflows/ci.yml)

Soroban smart contract that time-locks USDC for a recipient until a predetermined timestamp.

---

## Storage Model

All state is kept in **instance storage** (tied to the contract instance lifetime and
auto-extended on every invocation). Every key is written once during `initialize` and
is immutable except `Claimed`, which transitions `false → true` on a successful claim.

| `DataKey`    | Rust type | Description |
|--------------|-----------|-------------|
| `Sender`     | `Address` | Gift creator; authorized the initial token transfer |
| `Recipient`  | `Address` | Address authorized to call `claim` and receive funds |
| `Token`      | `Address` | USDC contract address (see network addresses below) |
| `Amount`     | `i128`    | Locked amount in stroops (≥ 10 000 000 = 1 USDC) |
| `UnlockTime` | `u64`     | Unix timestamp (seconds) after which `claim` is open |
| `Claimed`    | `bool`    | `false` until claim succeeds; set to `true` atomically before transfer |

### USDC Contract Addresses

| Network  | Address |
|----------|---------|
| Mainnet  | `CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75` |
| Testnet  | `CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA` |

---

## Contract State Diagram

```
                        initialize()
[Uninitialized] ──────────────────────► [Locked]
                                            │
                                   ledger.timestamp ≥ unlock_time
                                            │
                                            ▼
                                       [Unlocked]
                                            │
                                        claim()
                                            │
                                            ▼
                                        [Claimed]
```

State transitions:

| From          | Event / Condition                          | To          |
|---------------|--------------------------------------------|-------------|
| Uninitialized | `initialize()` called with valid args      | Locked      |
| Locked        | `ledger.timestamp >= unlock_time`          | Unlocked    |
| Unlocked      | `claim()` called by recipient              | Claimed     |
| Any           | `initialize()` called again               | ❌ `AlreadyInitialized` |
| Claimed       | `claim()` called again                    | ❌ `AlreadyClaimed` |
| Locked        | `claim()` called before unlock            | ❌ `StillLocked` |

---

## Error Codes

| Variant              | Code | When raised |
|----------------------|------|-------------|
| `AlreadyInitialized` | 1    | `initialize` called on an already-initialized contract |
| `AlreadyClaimed`     | 2    | `claim` called after funds were already claimed |
| `StillLocked`        | 3    | `claim` called before `unlock_time` has passed |
| `NotInitialized`     | 4    | Any function requiring state called before `initialize` |
| `Unauthorized`       | 5    | Reserved for future access-control checks |
| `AlreadyCancelled`   | 6    | Reserved for future cancellation logic |
| `InvalidAmount`      | 7    | `amount` is below `MIN_AMOUNT` (10 000 000 stroops) |
| `InvalidUnlockTime`  | 8    | `unlock_time` is not at least `MIN_LOCK_DURATION` (3 600 s) in the future |

---

## Contract Interface

### `initialize(sender, recipient, token, amount, unlock_time) → Result<(), EscrowError>`

Stores escrow parameters and transfers `amount` stroops of `token` from `sender`
into the contract address.

**Preconditions:**
- Contract must not already be initialized (`AlreadyInitialized`)
- `amount >= MIN_AMOUNT` (10 000 000 stroops = 1 USDC) (`InvalidAmount`)
- `unlock_time > ledger.timestamp() + MIN_LOCK_DURATION` (`InvalidUnlockTime`)
- `sender` must authorize the call (token transfer requires sender auth)

**Emits event:** `("initialized",)` → `(sender, recipient, amount, unlock_time)`

---

Automatically extends the instance TTL to cover `unlock_time` plus a 30-day buffer.

### `claim() → Result<(), EscrowError>`

Transfers the locked funds to `recipient`.

**Preconditions:**
- Contract must be initialized (`NotInitialized`)
- Caller must be `recipient` (enforced via `require_auth`)
- `ledger.timestamp() >= unlock_time` (`StillLocked`)
- Funds must not already be claimed (`AlreadyClaimed`)

**Atomicity:** `Claimed` is set to `true` *before* the token transfer to prevent
re-entrancy and double-claim attacks.

**Emits event:** `("claimed",)` → `(recipient, amount)`

---

Extends the instance TTL to a 7-day post-claim window so the claimed state remains readable for reconciliation.

### `extend_ttl() → Result<(), EscrowError>`

Permissionless keeper function — anyone can call this to bump the instance TTL before it expires. Returns `NotInitialized` if the contract has not been set up.

### `get_state() → Result<(Address, i128, u64, bool), EscrowError>`

Returns `(recipient, amount, unlock_time, claimed)`.

Fails with `NotInitialized` if `initialize` has not been called.

---

## Building & Testing

```bash
# Build WASM
npm run contract:build          # from repo root

# Run all contract tests
cd contracts && cargo test

# Run only double-claim tests
cd contracts && cargo test double_claim
```
