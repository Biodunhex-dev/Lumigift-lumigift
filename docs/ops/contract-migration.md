# Contract Upgrade & Migration Guide

This document describes how to upgrade the Lumigift escrow contract using the
Soroban upgrade mechanism and how to migrate active escrows when a breaking
change requires deploying a new contract.

---

## Upgrade Mechanism

The contract exposes an `upgrade(new_wasm_hash: BytesN<32>)` function that
replaces the contract's WASM in-place. The contract address and all stored
state are preserved — only the executable code changes.

**Authorization:** Only the `admin` address stored during `initialize` can call
`upgrade`. Any other caller will receive an authorization error.

**Event emitted:**
```
topic:  ("upgraded",)
data:   (old_contract_address, new_wasm_hash)
```

### Step-by-step: upgrading a deployed contract

1. **Build the new WASM:**
   ```bash
   npm run contract:build
   # Output: contracts/target/wasm32-unknown-unknown/release/lumigift_escrow.wasm
   ```

2. **Upload the new WASM to the network (get the hash):**
   ```bash
   stellar contract upload \
     --network testnet \
     --source <ADMIN_SECRET_KEY> \
     --wasm contracts/target/wasm32-unknown-unknown/release/lumigift_escrow.wasm
   # Outputs: <NEW_WASM_HASH>
   ```

3. **Call `upgrade` on the existing contract:**
   ```bash
   stellar contract invoke \
     --network testnet \
     --source <ADMIN_SECRET_KEY> \
     --id <CONTRACT_ID> \
     -- upgrade \
     --new_wasm_hash <NEW_WASM_HASH>
   ```

4. **Verify the upgrade:**
   ```bash
   stellar contract info --network testnet --id <CONTRACT_ID>
   # Confirm the WASM hash matches <NEW_WASM_HASH>
   ```

---

## Migrating Active Escrows (Breaking Changes)

If a breaking change requires deploying a **new contract** (e.g., storage layout
changes that cannot be handled in-place), follow this process:

### 1. Snapshot active escrows

Query all escrows that are not yet claimed from the database:

```sql
SELECT stellar_contract_id, sender_address, recipient_address, amount_stroops, unlock_time
FROM gifts
WHERE claimed = false
  AND stellar_contract_id IS NOT NULL;
```

### 2. Deploy the new contract version

```bash
STELLAR_NETWORK=testnet npm run contract:deploy
# Note the new CONTRACT_ID
```

### 3. Re-initialize each active escrow on the new contract

For each active escrow, the platform must:

1. Call `initialize` on the **new** contract with the original parameters.
2. Fund the new contract with the escrowed USDC (transfer from platform wallet).
3. Update the `stellar_contract_id` in the database to the new contract address.

> **Note:** The platform wallet must hold sufficient USDC to re-fund all active
> escrows. Coordinate with the treasury before executing migration.

### 4. Drain the old contract (if possible)

If the old contract has an emergency withdrawal function, call it to recover
any remaining funds. Otherwise, wait for all active escrows to be claimed
naturally before decommissioning.

### 5. Update environment variables

```bash
# Update STELLAR_ESCROW_CONTRACT_ID in all environments
STELLAR_ESCROW_CONTRACT_ID=<NEW_CONTRACT_ID>
```

Update GitHub secrets (`STAGING_STELLAR_ESCROW_CONTRACT_ID`,
`STELLAR_ESCROW_CONTRACT_ID`) and redeploy the Next.js app.

---

## Rollback

The `upgrade` function is **not reversible** via the contract itself. To roll
back, repeat the upgrade process with the previous WASM hash (which must have
been uploaded to the network previously).

Always keep the WASM hash of the previous version in your deployment log before
upgrading.
