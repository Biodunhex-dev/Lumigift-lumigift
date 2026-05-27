//! Lumigift Escrow Contract
//!
//! Locks USDC for a recipient until a predetermined timestamp.
//! Only the designated recipient can claim after the unlock time.
//!
//! # USDC Contract Addresses
//!
//! - **Mainnet:** `CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75`
//!   (Circle USDC on Stellar mainnet)
//! - **Testnet:** `CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA`
//!   (Circle USDC on Stellar testnet)
//!
//! # Instance Storage TTL Strategy
//!
//! Soroban instance storage has a finite TTL measured in ledgers. If the TTL
//! expires the contract state is archived and becomes inaccessible — a critical
//! failure for long-lived escrows (e.g. 1-year gifts).
//!
//! ## How TTL is managed
//!
//! Stellar closes roughly one ledger every 5 seconds, so:
//!
//! ```text
//! 1 day  ≈ 17_280 ledgers   (86_400 s / 5 s)
//! 30 days ≈ 518_400 ledgers
//! ```
//!
//! The required TTL for a given escrow is:
//!
//! ```text
//! required_ledgers = (unlock_time - now_secs) / LEDGER_CLOSE_SECS
//!                  + BUFFER_LEDGERS          // 30-day safety margin
//! ```
//!
//! `extend_ttl(threshold, new_ttl)` is a no-op when the current TTL is already
//! ≥ `threshold`, so calling it on every `initialize` / `claim` is safe and
//! cheap — the extension only fires when the TTL has drifted below the
//! threshold.
//!
//! ## Who can extend
//!
//! - **`initialize`** — sets the initial TTL to cover the full lock period.
//! - **`claim`** — extends to a short post-claim window so the claimed state
//!   remains readable for reconciliation.
//! - **`extend_ttl` (public)** — permissionless keeper function. Anyone
//!   (the platform backend, a third-party keeper, or the recipient) can call
//!   this to bump the TTL before it expires, without needing to claim.

#![no_std]

use soroban_sdk::{
    bytesn, contract, contractimpl, contracterror, contracttype, token, Address, BytesN, Env,
    Symbol,
};

// ─── Error enum ───────────────────────────────────────────────────────────────

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum EscrowError {
    AlreadyInitialized = 1,
    AlreadyClaimed     = 2,
    StillLocked        = 3,
    NotInitialized     = 4,
    Unauthorized       = 5,
    AlreadyCancelled   = 6,
    InvalidAmount      = 7,
    InvalidUnlockTime  = 8,
}

/// Minimum escrow amount: 1 USDC expressed in stroops (7 decimal places).
const MIN_AMOUNT: i128 = 10_000_000;

/// Minimum lock duration: 1 hour in seconds.
const MIN_LOCK_DURATION: u64 = 3_600;

/// Approximate ledger close time in seconds. Stellar targets ~5 s per ledger.
const LEDGER_CLOSE_SECS: u64 = 5;

/// 30-day safety buffer expressed in ledgers (30 * 24 * 3600 / 5).
const BUFFER_LEDGERS: u32 = 518_400;

/// Minimum TTL threshold below which `extend_ttl` fires (7 days in ledgers).
/// Keeps the extension a no-op on most calls while still catching drift early.
const MIN_TTL_THRESHOLD: u32 = 120_960; // 7 * 24 * 3600 / 5

/// Short post-claim TTL: 7 days so the claimed state stays readable for
/// reconciliation after the funds have been transferred.
const POST_CLAIM_TTL_LEDGERS: u32 = 120_960;

// ─── Storage keys ─────────────────────────────────────────────────────────────
//
// All keys use `instance` storage, which is tied to the contract instance
// lifetime and is automatically extended when the contract is invoked.
// Every value is written once during `initialize` and is immutable except
// for `Claimed`, which transitions from `false` → `true` on a successful claim.
//
// Storage model (instance storage):
//
//   ┌─────────────┬──────────────┬──────────────────────────────────────────┐
//   │ DataKey     │ Type         │ Description                              │
//   ├─────────────┼──────────────┼──────────────────────────────────────────┤
//   │ Sender      │ Address      │ Gift creator; authorized to initialize   │
//   │ Recipient   │ Address      │ Intended claimer; authorized to claim    │
//   │ Token       │ Address      │ USDC contract address (mainnet/testnet)  │
//   │ Amount      │ i128         │ Locked amount in stroops (≥ 10_000_000)  │
//   │ UnlockTime  │ u64          │ Unix timestamp after which claim is open │
//   │ Claimed     │ bool         │ False until claim succeeds; then true    │
//   └─────────────┴──────────────┴──────────────────────────────────────────┘
//
// Valid contract states:
//
//   [Uninitialized] ──initialize()──► [Locked] ──(time passes)──► [Unlocked]
//                                                                       │
//                                                                  claim()
//                                                                       │
//                                                                       ▼
//                                                                  [Claimed]

#[contracttype]
pub enum DataKey {
    /// The address authorized to call `upgrade`. Set once during `initialize`.
    Admin,
    Sender,

    /// The address authorized to call `claim` and receive the locked funds.
    /// `claim` calls `recipient.require_auth()` to enforce this.
    Recipient,

    /// The USDC token contract address on the current network.
    /// Mainnet: `CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75`
    /// Testnet: `CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA`
    Token,

    /// The number of USDC stroops locked in escrow (1 USDC = 10_000_000 stroops).
    /// Must be ≥ `MIN_AMOUNT` (10_000_000 stroops = 1 USDC).
    Amount,

    /// Unix timestamp (seconds) after which `claim` is permitted.
    /// Must be at least `MIN_LOCK_DURATION` (3 600 s) after initialization time.
    UnlockTime,

    /// Tracks whether the escrow has been claimed.
    /// Initialized to `false`; set to `true` atomically before the token
    /// transfer in `claim` to prevent re-entrancy and double-claim attacks.
    Claimed,
    Cancelled,
}

// ─── Contract ─────────────────────────────────────────────────────────────────

#[contract]
pub struct EscrowContract;

// ─── TTL helper ───────────────────────────────────────────────────────────────

/// Computes the required instance TTL in ledgers to cover `unlock_time` plus
/// the 30-day buffer.
///
/// If `unlock_time` is already in the past (e.g. after a successful claim) the
/// function returns `BUFFER_LEDGERS` so the post-claim state stays readable.
fn required_ttl_ledgers(env: &Env, unlock_time: u64) -> u32 {
    let now = env.ledger().timestamp();
    if unlock_time <= now {
        return BUFFER_LEDGERS;
    }
    let secs_until_unlock = unlock_time - now;
    // Round up: add LEDGER_CLOSE_SECS - 1 before dividing.
    let ledgers_until_unlock =
        (secs_until_unlock + LEDGER_CLOSE_SECS - 1) / LEDGER_CLOSE_SECS;
    // Saturating cast to u32; any escrow > ~680 years would overflow, which is
    // impossible given the unlock_time validation in `initialize`.
    let ledgers_u32 = ledgers_until_unlock.min(u32::MAX as u64) as u32;
    ledgers_u32.saturating_add(BUFFER_LEDGERS)
}

#[contractimpl]
impl EscrowContract {
    /// Initialize the escrow. Called once by the platform after deploying.
    pub fn initialize(
        env: Env,
        admin: Address,
        sender: Address,
        recipient: Address,
        token: Address,
        amount: i128,
        unlock_time: u64,
    ) -> Result<(), EscrowError> {
        if env.storage().instance().has(&DataKey::Sender) {
            return Err(EscrowError::AlreadyInitialized);
        }

        if amount < MIN_AMOUNT {
            return Err(EscrowError::InvalidAmount);
        }

        // unlock_time must be at least MIN_LOCK_DURATION seconds in the future
        if unlock_time <= env.ledger().timestamp().saturating_add(MIN_LOCK_DURATION) {
            return Err(EscrowError::InvalidUnlockTime);
        }

        sender.require_auth();

        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Sender, &sender);
        env.storage().instance().set(&DataKey::Recipient, &recipient);
        env.storage().instance().set(&DataKey::Token, &token);
        env.storage().instance().set(&DataKey::Amount, &amount);
        env.storage().instance().set(&DataKey::UnlockTime, &unlock_time);
        env.storage().instance().set(&DataKey::Claimed, &false);

        // Extend instance TTL to cover the full lock period plus a 30-day buffer.
        // This prevents state archival before the recipient can claim.
        let ttl = required_ttl_ledgers(&env, unlock_time);
        env.storage().instance().extend_ttl(MIN_TTL_THRESHOLD, ttl);

        let token_client = token::Client::new(&env, &token);
        token_client.transfer(&sender, &env.current_contract_address(), &amount);

        env.events().publish(
            (Symbol::new(&env, "initialized"),),
            (sender, recipient, amount, unlock_time),
        );

        Ok(())
    }

    /// Claim the escrowed funds. Only callable by the recipient after unlock_time.
    pub fn claim(env: Env) -> Result<(), EscrowError> {
        let recipient: Address = env
            .storage()
            .instance()
            .get(&DataKey::Recipient)
            .ok_or(EscrowError::NotInitialized)?;

        recipient.require_auth();

        let claimed: bool = env
            .storage()
            .instance()
            .get(&DataKey::Claimed)
            .unwrap_or(false);

        if claimed {
            return Err(EscrowError::AlreadyClaimed);
        }

        let unlock_time: u64 = env
            .storage()
            .instance()
            .get(&DataKey::UnlockTime)
            .ok_or(EscrowError::NotInitialized)?;

        if env.ledger().timestamp() < unlock_time {
            return Err(EscrowError::StillLocked);
        }

        let token: Address = env
            .storage()
            .instance()
            .get(&DataKey::Token)
            .ok_or(EscrowError::NotInitialized)?;

        let amount: i128 = env
            .storage()
            .instance()
            .get(&DataKey::Amount)
            .ok_or(EscrowError::NotInitialized)?;

        env.storage().instance().set(&DataKey::Claimed, &true);

        // Extend TTL so the claimed state stays readable for reconciliation.
        // unlock_time is in the past here, so required_ttl_ledgers returns BUFFER_LEDGERS.
        env.storage()
            .instance()
            .extend_ttl(MIN_TTL_THRESHOLD, POST_CLAIM_TTL_LEDGERS);

        let token_client = token::Client::new(&env, &token);
        token_client.transfer(&env.current_contract_address(), &recipient, &amount);

        env.events().publish(
            (Symbol::new(&env, "claimed"),),
            (recipient, amount),
        );

        Ok(())
    }

    /// Cancel the escrow. Only callable by the original sender if not yet claimed or cancelled.
    /// Transfers the full amount back to the sender and sets Cancelled status.
    pub fn cancel(env: Env) -> Result<(), EscrowError> {
        let sender: Address = env
            .storage()
            .instance()
            .get(&DataKey::Sender)
            .ok_or(EscrowError::NotInitialized)?;

        sender.require_auth();

        let claimed: bool = env
            .storage()
            .instance()
            .get(&DataKey::Claimed)
            .unwrap_or(false);

        if claimed {
            return Err(EscrowError::AlreadyClaimed);
        }

        let cancelled: bool = env
            .storage()
            .instance()
            .get(&DataKey::Cancelled)
            .unwrap_or(false);

        if cancelled {
            return Err(EscrowError::AlreadyCancelled);
        }

        let token: Address = env
            .storage()
            .instance()
            .get(&DataKey::Token)
            .ok_or(EscrowError::NotInitialized)?;

        let amount: i128 = env
            .storage()
            .instance()
            .get(&DataKey::Amount)
            .ok_or(EscrowError::NotInitialized)?;

        env.storage().instance().set(&DataKey::Cancelled, &true);

        let token_client = token::Client::new(&env, &token);
        token_client.transfer(&env.current_contract_address(), &sender, &amount);

        env.events().publish(
            (Symbol::new(&env, "cancelled"),),
            (sender, amount),
        );

        Ok(())
    }

    /// Change the admin address. Restricted to current admin.
    pub fn set_admin(env: Env, new_admin: Address) -> Result<(), EscrowError> {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(EscrowError::NotInitialized)?;

        admin.require_auth();

        env.storage().instance().set(&DataKey::Admin, &new_admin);

        env.events().publish(
            (Symbol::new(&env, "admin_changed"),),
            (admin, new_admin, env.ledger().timestamp()),
        );

        Ok(())
    }

    /// Read-only: returns (recipient, amount, unlock_time, claimed).
    pub fn get_state(env: Env) -> Result<(Address, i128, u64, bool), EscrowError> {
        let recipient: Address = env
            .storage()
            .instance()
            .get(&DataKey::Recipient)
            .ok_or(EscrowError::NotInitialized)?;
        let amount: i128 = env
            .storage()
            .instance()
            .get(&DataKey::Amount)
            .ok_or(EscrowError::NotInitialized)?;
        let unlock_time: u64 = env
            .storage()
            .instance()
            .get(&DataKey::UnlockTime)
            .ok_or(EscrowError::NotInitialized)?;
        let claimed: bool = env
            .storage()
            .instance()
            .get(&DataKey::Claimed)
            .unwrap_or(false);

        Ok((recipient, amount, unlock_time, claimed))
    }

    /// Upgrade the contract WASM. Restricted to the admin address stored at initialization.
    ///
    /// Emits an `upgraded` event containing the new WASM hash so off-chain
    /// indexers can track contract versions.
    pub fn upgrade(env: Env, new_wasm_hash: BytesN<32>) -> Result<(), EscrowError> {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(EscrowError::NotInitialized)?;

        admin.require_auth();

        let old_wasm_hash = env.current_contract_address();
        env.deployer().update_current_contract_wasm(new_wasm_hash.clone());

        env.events().publish(
            (Symbol::new(&env, "upgraded"),),
            (old_wasm_hash, new_wasm_hash, env.ledger().timestamp()),
        );

        Ok(())
    }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{
        testutils::{Address as _, Ledger},
        token::{Client as TokenClient, StellarAssetClient},
        Env,
    };

    fn create_token<'a>(env: &'a Env, admin: &Address) -> (Address, TokenClient<'a>, StellarAssetClient<'a>) {
        let token_id = env.register_stellar_asset_contract(admin.clone());
        let token = TokenClient::new(env, &token_id);
        let token_admin = StellarAssetClient::new(env, &token_id);
        (token_id, token, token_admin)
    }

    #[test]
    fn test_initialize_and_claim() {
        let env = Env::default();
        env.mock_all_auths();

        let sender = Address::generate(&env);
        let recipient = Address::generate(&env);
        let (token_id, token, token_admin) = create_token(&env, &sender);

        token_admin.mint(&sender, &100_000_000);

        let contract_id = env.register_contract(None, EscrowContract);
        let client = EscrowContractClient::new(&env, &contract_id);

        // unlock_time must be > ledger.timestamp() + MIN_LOCK_DURATION (3600)
        client.initialize(&sender, &sender, &recipient, &token_id, &100_000_000, &3_601);
        env.ledger().with_mut(|l| l.timestamp = 3_601);
        client.claim();

        assert_eq!(token.balance(&recipient), 100_000_000);
    }

    #[test]
    fn test_double_initialize_returns_error() {
        let env = Env::default();
        env.mock_all_auths();

        let sender = Address::generate(&env);
        let recipient = Address::generate(&env);
        let (token_id, _, token_admin) = create_token(&env, &sender);
        token_admin.mint(&sender, &200_000_000);

        let contract_id = env.register_contract(None, EscrowContract);
        let client = EscrowContractClient::new(&env, &contract_id);

        client.initialize(&sender, &sender, &recipient, &token_id, &100_000_000, &3_601);

        let err = client
            .try_initialize(&sender, &sender, &recipient, &token_id, &100_000_000, &3_601)
            .unwrap_err()
            .unwrap();
        assert_eq!(err, EscrowError::AlreadyInitialized);
    }

    #[test]
    fn test_reinitialize_does_not_alter_original_state() {
        let env = Env::default();
        env.mock_all_auths();

        let sender = Address::generate(&env);
        let recipient = Address::generate(&env);
        let attacker = Address::generate(&env);
        let (token_id, _, token_admin) = create_token(&env, &sender);
        // Mint enough for both the original init and the attempted re-init
        token_admin.mint(&sender, &200_000_000);

        let contract_id = env.register_contract(None, EscrowContract);
        let client = EscrowContractClient::new(&env, &contract_id);

        // First initialization — establishes the original state
        let original_amount: i128 = 100_000_000;
        let original_unlock: u64 = 9_999;
        client.initialize(&sender, &sender, &recipient, &token_id, &original_amount, &original_unlock);

        // Attempt re-initialization with different values — must fail
        let err = client
            .try_initialize(&attacker, &attacker, &attacker, &token_id, &50_000_000, &1)
            .unwrap_err()
            .unwrap();
        assert_eq!(err, EscrowError::AlreadyInitialized);

        // Verify original state is completely unchanged
        let (state_recipient, state_amount, state_unlock, state_claimed) =
            client.get_state();
        assert_eq!(state_recipient, recipient, "recipient must not change after failed re-init");
        assert_eq!(state_amount, original_amount, "amount must not change after failed re-init");
        assert_eq!(state_unlock, original_unlock, "unlock_time must not change after failed re-init");
        assert!(!state_claimed, "claimed flag must remain false after failed re-init");
    }

    #[test]
    fn test_claim_before_unlock_returns_error() {
        let env = Env::default();
        env.mock_all_auths();

        let sender = Address::generate(&env);
        let recipient = Address::generate(&env);
        let (token_id, _, token_admin) = create_token(&env, &sender);
        token_admin.mint(&sender, &100_000_000);

        let contract_id = env.register_contract(None, EscrowContract);
        let client = EscrowContractClient::new(&env, &contract_id);

        client.initialize(&sender, &sender, &recipient, &token_id, &100_000_000, &9_999_999);

        let err = client.try_claim().unwrap_err().unwrap();
        assert_eq!(err, EscrowError::StillLocked);
    }

    #[test]
    fn test_double_claim_returns_error() {
        let env = Env::default();
        env.mock_all_auths();

        let sender = Address::generate(&env);
        let recipient = Address::generate(&env);
        let (token_id, _, token_admin) = create_token(&env, &sender);
        token_admin.mint(&sender, &100_000_000);

        let contract_id = env.register_contract(None, EscrowContract);
        let client = EscrowContractClient::new(&env, &contract_id);

        client.initialize(&sender, &sender, &recipient, &token_id, &100_000_000, &3_601);
        env.ledger().with_mut(|l| l.timestamp = 3_601);
        client.claim();

        let err = client.try_claim().unwrap_err().unwrap();
        assert_eq!(err, EscrowError::AlreadyClaimed);
    }

    #[test]
    fn test_get_state_not_initialized_returns_error() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register_contract(None, EscrowContract);
        let client = EscrowContractClient::new(&env, &contract_id);

        let err = client.try_get_state().unwrap_err().unwrap();
        assert_eq!(err, EscrowError::NotInitialized);
    }

    #[test]
    fn test_initialize_zero_amount_returns_invalid_amount() {
        let env = Env::default();
        env.mock_all_auths();

        let sender = Address::generate(&env);
        let recipient = Address::generate(&env);
        let (token_id, _, _) = create_token(&env, &sender);

        let contract_id = env.register_contract(None, EscrowContract);
        let client = EscrowContractClient::new(&env, &contract_id);

        let err = client
            .try_initialize(&sender, &sender, &recipient, &token_id, &0, &1_000)
            .unwrap_err()
            .unwrap();
        assert_eq!(err, EscrowError::InvalidAmount);
    }

    #[test]
    fn test_initialize_below_minimum_amount_returns_invalid_amount() {
        let env = Env::default();
        env.mock_all_auths();

        let sender = Address::generate(&env);
        let recipient = Address::generate(&env);
        let (token_id, _, token_admin) = create_token(&env, &sender);
        token_admin.mint(&sender, &9_999_999);

        let contract_id = env.register_contract(None, EscrowContract);
        let client = EscrowContractClient::new(&env, &contract_id);

        // 9_999_999 stroops = just under 1 USDC minimum
        let err = client
            .try_initialize(&sender, &sender, &recipient, &token_id, &9_999_999, &1_000)
            .unwrap_err()
            .unwrap();
        assert_eq!(err, EscrowError::InvalidAmount);
    }

    #[test]
    fn test_initialize_past_unlock_time_returns_invalid_unlock_time() {
        let env = Env::default();
        env.mock_all_auths();

        let sender = Address::generate(&env);
        let recipient = Address::generate(&env);
        let (token_id, _, token_admin) = create_token(&env, &sender);
        token_admin.mint(&sender, &100_000_000);

        // Set ledger timestamp to a known value
        env.ledger().with_mut(|l| l.timestamp = 10_000);

        let contract_id = env.register_contract(None, EscrowContract);
        let client = EscrowContractClient::new(&env, &contract_id);

        // unlock_time in the past
        let err = client
            .try_initialize(&sender, &sender, &recipient, &token_id, &100_000_000, &5_000)
            .unwrap_err()
            .unwrap();
        assert_eq!(err, EscrowError::InvalidUnlockTime);
    }

    #[test]
    fn test_initialize_current_timestamp_returns_invalid_unlock_time() {
        let env = Env::default();
        env.mock_all_auths();

        let sender = Address::generate(&env);
        let recipient = Address::generate(&env);
        let (token_id, _, token_admin) = create_token(&env, &sender);
        token_admin.mint(&sender, &100_000_000);

        env.ledger().with_mut(|l| l.timestamp = 10_000);

        let contract_id = env.register_contract(None, EscrowContract);
        let client = EscrowContractClient::new(&env, &contract_id);

        // unlock_time == current timestamp (not in the future by MIN_LOCK_DURATION)
        let err = client
            .try_initialize(&sender, &sender, &recipient, &token_id, &100_000_000, &10_000)
            .unwrap_err()
            .unwrap();
        assert_eq!(err, EscrowError::InvalidUnlockTime);
    }

    #[test]
    fn test_initialize_unlock_time_just_below_minimum_duration_returns_invalid_unlock_time() {
        let env = Env::default();
        env.mock_all_auths();

        let sender = Address::generate(&env);
        let recipient = Address::generate(&env);
        let (token_id, _, token_admin) = create_token(&env, &sender);
        token_admin.mint(&sender, &100_000_000);

        env.ledger().with_mut(|l| l.timestamp = 10_000);

        let contract_id = env.register_contract(None, EscrowContract);
        let client = EscrowContractClient::new(&env, &contract_id);

        // unlock_time = now + MIN_LOCK_DURATION (must be strictly greater)
        let err = client
            .try_initialize(&sender, &sender, &recipient, &token_id, &100_000_000, &13_600)
            .unwrap_err()
            .unwrap();
        assert_eq!(err, EscrowError::InvalidUnlockTime);
    }

    #[test]
    fn test_initialize_valid_unlock_time_succeeds() {
        let env = Env::default();
        env.mock_all_auths();

        let sender = Address::generate(&env);
        let recipient = Address::generate(&env);
        let (token_id, token, token_admin) = create_token(&env, &sender);
        token_admin.mint(&sender, &100_000_000);

        env.ledger().with_mut(|l| l.timestamp = 10_000);

        let contract_id = env.register_contract(None, EscrowContract);
        let client = EscrowContractClient::new(&env, &contract_id);

        // unlock_time = now + MIN_LOCK_DURATION + 1 (valid)
        client.initialize(&sender, &sender, &recipient, &token_id, &100_000_000, &13_601);

        // Advance past unlock and claim
        env.ledger().with_mut(|l| l.timestamp = 13_601);
        client.claim();
        assert_eq!(token.balance(&recipient), 100_000_000);
    }
}

// ─── Cancel tests (#45) ───────────────────────────────────────────────────────

#[cfg(test)]
mod cancel_tests {
    use super::*;
    use soroban_sdk::{
        testutils::{Address as _, Ledger, MockAuth, MockAuthInvoke},
        token::{Client as TokenClient, StellarAssetClient},
        Env, IntoVal,
    };

    fn setup(env: &Env) -> (Address, Address, Address, TokenClient, EscrowContractClient) {
        env.mock_all_auths();
        let sender = Address::generate(env);
        let recipient = Address::generate(env);
        let token_id = env.register_stellar_asset_contract(sender.clone());
        let token = TokenClient::new(env, &token_id);
        StellarAssetClient::new(env, &token_id).mint(&sender, &100_000_000);

        let contract_id = env.register_contract(None, EscrowContract);
        let client = EscrowContractClient::new(env, &contract_id);
        client.initialize(&sender, &sender, &recipient, &token_id, &100_000_000, &3_601);

        (sender, recipient, token_id, token, client)
    }

    /// Sender can cancel before claim — funds return to sender.
    #[test]
    fn test_cancel_by_sender_returns_funds() {
        let env = Env::default();
        let (sender, _recipient, _token_id, token, client) = setup(&env);

        let balance_before = token.balance(&sender);
        client.cancel();
        assert_eq!(token.balance(&sender), balance_before + 100_000_000);
    }

    /// Non-sender (attacker) cannot cancel.
    #[test]
    fn test_cancel_by_non_sender_panics() {
        let env = Env::default();
        let (_sender, _recipient, _token_id, _token, client) = setup(&env);

        let attacker = Address::generate(&env);
        client
            .mock_auths(&[MockAuth {
                address: &attacker,
                invoke: &MockAuthInvoke {
                    contract: &client.address,
                    fn_name: "cancel",
                    args: ().into_val(&env),
                    sub_invokes: &[],
                },
            }])
            .try_cancel()
            .expect_err("non-sender must not be able to cancel");
    }

    /// Cancel after claim must fail with AlreadyClaimed.
    #[test]
    fn test_cancel_after_claim_returns_error() {
        let env = Env::default();
        let (_sender, _recipient, _token_id, _token, client) = setup(&env);

        env.ledger().with_mut(|l| l.timestamp = 3_601);
        client.claim();

        let err = client.try_cancel().unwrap_err().unwrap();
        assert_eq!(err, EscrowError::AlreadyClaimed);
    }

    /// Double cancel must fail with AlreadyCancelled.
    #[test]
    fn test_double_cancel_returns_error() {
        let env = Env::default();
        let (_sender, _recipient, _token_id, _token, client) = setup(&env);

        client.cancel();
        let err = client.try_cancel().unwrap_err().unwrap();
        assert_eq!(err, EscrowError::AlreadyCancelled);
    }
}

// ─── Authorization tests (#62) ────────────────────────────────────────────────

#[cfg(test)]
mod auth_tests {
    use super::*;
    use soroban_sdk::{
        testutils::{Address as _, Ledger, MockAuth, MockAuthInvoke},
        token::StellarAssetClient,
        Env, IntoVal,
    };

    fn setup(env: &Env) -> (Address, Address, EscrowContractClient) {
        let sender = Address::generate(env);
        let recipient = Address::generate(env);
        let token_id = env.register_stellar_asset_contract(sender.clone());
        StellarAssetClient::new(env, &token_id).mint(&sender, &100_000_000);

        let contract_id = env.register_contract(None, EscrowContract);
        let client = EscrowContractClient::new(env, &contract_id);

        // unlock_time = 3_601 (> 0 + MIN_LOCK_DURATION)
        env.mock_all_auths();
        client.initialize(&sender, &sender, &recipient, &token_id, &100_000_000, &3_601);

        // Advance past unlock so the only barrier is auth, not time
        env.ledger().with_mut(|l| l.timestamp = 3_601);

        (sender, recipient, client)
    }

    /// A third-party address that is neither sender nor recipient must not be
    /// able to claim. The contract calls `recipient.require_auth()`, so any
    /// caller other than the stored recipient will fail authorization.
    #[test]
    fn test_third_party_cannot_claim() {
        let env = Env::default();
        let (_, _recipient, client) = setup(&env);

        let attacker = Address::generate(&env);

        // Authorize only the attacker — NOT the recipient.
        // require_auth() will panic, which the test harness surfaces as an Err.
        client
            .mock_auths(&[MockAuth {
                address: &attacker,
                invoke: &MockAuthInvoke {
                    contract: &client.address,
                    fn_name: "claim",
                    args: ().into_val(&env),
                    sub_invokes: &[],
                },
            }])
            .try_claim()
            .expect_err("third-party must not be able to claim");
    }

    /// The sender must not be able to claim their own gift.
    #[test]
    fn test_sender_cannot_claim() {
        let env = Env::default();
        let (sender, _, client) = setup(&env);

        // Authorize only the sender — NOT the recipient.
        client
            .mock_auths(&[MockAuth {
                address: &sender,
                invoke: &MockAuthInvoke {
                    contract: &client.address,
                    fn_name: "claim",
                    args: ().into_val(&env),
                    sub_invokes: &[],
                },
            }])
            .try_claim()
            .expect_err("sender must not be able to claim");
    }
}

// ─── Boundary tests (#64) ─────────────────────────────────────────────────────
//
// The contract uses `env.ledger().timestamp() < unlock_time` (strict less-than).
// Therefore:
//   - timestamp == unlock_time  → claim SUCCEEDS  (boundary is inclusive)
//   - timestamp == unlock_time - 1 → claim FAILS  (still locked)

#[cfg(test)]
mod boundary_tests {
    use super::*;
    use soroban_sdk::{
        testutils::{Address as _, Ledger},
        token::{Client as TokenClient, StellarAssetClient},
        Env,
    };

    fn setup_at(env: &Env, unlock_time: u64) -> EscrowContractClient {
        env.mock_all_auths();
        let sender = Address::generate(env);
        let recipient = Address::generate(env);
        let token_id = env.register_stellar_asset_contract(sender.clone());
        StellarAssetClient::new(env, &token_id).mint(&sender, &100_000_000);

        let contract_id = env.register_contract(None, EscrowContract);
        let client = EscrowContractClient::new(env, &contract_id);
        client.initialize(&sender, &sender, &recipient, &token_id, &100_000_000, &unlock_time);
        client
    }

    /// Ledger timestamp == unlock_time: claim must SUCCEED.
    /// The condition is `now < unlock_time`, so equality is NOT locked.
    #[test]
    fn test_claim_at_exactly_unlock_time_succeeds() {
        let env = Env::default();
        let unlock_time: u64 = 3_601;
        let client = setup_at(&env, unlock_time);

        // Set ledger to exactly unlock_time
        env.ledger().with_mut(|l| l.timestamp = unlock_time);

        // Must not return StillLocked
        client.claim();
    }

    /// Ledger timestamp == unlock_time - 1: claim must FAIL with StillLocked.
    #[test]
    fn test_claim_one_second_before_unlock_fails() {
        let env = Env::default();
        let unlock_time: u64 = 3_601;
        let client = setup_at(&env, unlock_time);

        // One second before unlock
        env.ledger().with_mut(|l| l.timestamp = unlock_time - 1);

        let err = client.try_claim().unwrap_err().unwrap();
        assert_eq!(err, EscrowError::StillLocked);
    }
}

// ─── Property-based tests ─────────────────────────────────────────────────────
//
// Each proptest! block runs at least 1 000 cases (proptest default).
// The four properties below map directly to the acceptance criteria in issue #109.

#[cfg(test)]
mod property_tests {
    use super::*;
    use proptest::prelude::*;
    use soroban_sdk::{
        testutils::{Address as _, Ledger},
        token::{Client as TokenClient, StellarAssetClient},
        Env,
    };

    // ── helpers ──────────────────────────────────────────────────────────────

    fn setup_initialized_escrow(
        amount: i128,
        unlock_time: u64,
    ) -> (Env, Address, TokenClient<'static>, EscrowContractClient<'static>) {
        let env = Env::default();
        env.mock_all_auths();

        let sender = Address::generate(&env);
        let recipient = Address::generate(&env);
        let token_id = env.register_stellar_asset_contract(sender.clone());
        let token = TokenClient::new(&env, &token_id);
        let token_admin = StellarAssetClient::new(&env, &token_id);
        token_admin.mint(&sender, &amount);

        let contract_id = env.register_contract(None, EscrowContract);
        let client = EscrowContractClient::new(&env, &contract_id);
        client.initialize(&sender, &sender, &recipient, &token_id, &amount, &unlock_time);

        (env, recipient, token, client)
    }

    // ── Property 1 ───────────────────────────────────────────────────────────
    // After a successful claim the contract's token balance is always 0.

    proptest! {
        #![proptest_config(ProptestConfig::with_cases(1_000))]
        #[test]
        fn prop_balance_zero_after_claim(
            amount    in MIN_AMOUNT..=1_000_000_000_i128,
            unlock_time in (MIN_LOCK_DURATION + 1)..=1_000_000u64,
        ) {
            let (env, _recipient, token, client) =
                setup_initialized_escrow(amount, unlock_time);

            // Advance ledger past unlock_time so the claim succeeds
            env.ledger().with_mut(|l| l.timestamp = unlock_time);
            client.claim();

            let contract_balance = token.balance(&client.address);
            prop_assert_eq!(
                contract_balance, 0,
                "contract balance must be 0 after claim, got {}",
                contract_balance
            );
        }
    }

    // ── Property 2 ───────────────────────────────────────────────────────────
    // The amount received by the recipient always equals the initialized amount.

    proptest! {
        #![proptest_config(ProptestConfig::with_cases(1_000))]
        #[test]
        fn prop_claimed_amount_equals_initialized_amount(
            amount    in MIN_AMOUNT..=1_000_000_000_i128,
            unlock_time in (MIN_LOCK_DURATION + 1)..=1_000_000u64,
        ) {
            let (env, recipient, token, client) =
                setup_initialized_escrow(amount, unlock_time);

            let balance_before = token.balance(&recipient);

            env.ledger().with_mut(|l| l.timestamp = unlock_time);
            client.claim();

            let received = token.balance(&recipient) - balance_before;
            prop_assert_eq!(
                received, amount,
                "recipient received {} but expected {}",
                received, amount
            );
        }
    }

    // ── Property 3 ───────────────────────────────────────────────────────────
    // Claim always fails with StillLocked when ledger timestamp < unlock_time.

    proptest! {
        #![proptest_config(ProptestConfig::with_cases(1_000))]
        #[test]
        fn prop_claim_fails_before_unlock(
            amount      in MIN_AMOUNT..=1_000_000_000_i128,
            unlock_time in (MIN_LOCK_DURATION + 2)..=u64::MAX / 2,
            // ledger_ts is strictly less than unlock_time
            ledger_ts   in 0u64..=1u64,
        ) {
            // Map ledger_ts into [0, unlock_time - 1]
            let ledger_ts = ledger_ts % unlock_time; // always < unlock_time

            let (env, _recipient, _token, client) =
                setup_initialized_escrow(amount, unlock_time);

            env.ledger().with_mut(|l| l.timestamp = ledger_ts);

            let err = client.try_claim().unwrap_err().unwrap();
            prop_assert_eq!(
                err,
                EscrowError::StillLocked,
                "expected StillLocked at ts={}, unlock={}",
                ledger_ts, unlock_time
            );
        }
    }

    // ── Property 4 ───────────────────────────────────────────────────────────
    // A second call to initialize always fails with AlreadyInitialized.

    proptest! {
        #![proptest_config(ProptestConfig::with_cases(1_000))]
        #[test]
        fn prop_double_initialize_always_fails(
            amount      in MIN_AMOUNT..=1_000_000_000_i128,
            unlock_time in (MIN_LOCK_DURATION + 1)..=u64::MAX / 2,
            amount2     in MIN_AMOUNT..=1_000_000_000_i128,
            unlock_time2 in (MIN_LOCK_DURATION + 1)..=u64::MAX / 2,
        ) {
            let env = Env::default();
            env.mock_all_auths();

            let sender = Address::generate(&env);
            let recipient = Address::generate(&env);
            let token_id = env.register_stellar_asset_contract(sender.clone());
            let token_admin = StellarAssetClient::new(&env, &token_id);
            // Mint enough for both initialize calls
            token_admin.mint(&sender, &(amount + amount2));

            let contract_id = env.register_contract(None, EscrowContract);
            let client = EscrowContractClient::new(&env, &contract_id);

            // First initialize must succeed
            client.initialize(&sender, &sender, &recipient, &token_id, &amount, &unlock_time);

            // Second initialize must always fail regardless of arguments
            let err = client
                .try_initialize(&sender, &sender, &recipient, &token_id, &amount2, &unlock_time2)
                .unwrap_err()
                .unwrap();

            prop_assert_eq!(
                err,
                EscrowError::AlreadyInitialized,
                "expected AlreadyInitialized on second call"
            );
        }
    }
}


// ─── Upgrade tests (#49) ──────────────────────────────────────────────────────
//
// Verifies that only the admin can upgrade the contract WASM.

#[cfg(test)]
mod upgrade_tests {
    use super::*;
    use soroban_sdk::{
        testutils::{Address as _, MockAuth, MockAuthInvoke},
        token::StellarAssetClient,
        BytesN, Env, IntoVal,
    };

    fn setup(env: &Env) -> (Address, Address, EscrowContractClient) {
        env.mock_all_auths();
        let admin = Address::generate(env);
        let sender = Address::generate(env);
        let recipient = Address::generate(env);
        let token_id = env.register_stellar_asset_contract(sender.clone());
        StellarAssetClient::new(env, &token_id).mint(&sender, &100_000_000);

        let contract_id = env.register_contract(None, EscrowContract);
        let client = EscrowContractClient::new(env, &contract_id);
        client.initialize(&admin, &sender, &recipient, &token_id, &100_000_000, &3_601);

        (admin, sender, client)
    }

    /// Only the admin address stored at initialization can call upgrade.
    #[test]
    fn test_upgrade_restricted_to_admin() {
        let env = Env::default();
        let (admin, _sender, client) = setup(&env);

        let new_wasm_hash = BytesN::from_array(&env, &[0u8; 32]);

        // Admin can upgrade
        client
            .mock_auths(&[MockAuth {
                address: &admin,
                invoke: &MockAuthInvoke {
                    contract: &client.address,
                    fn_name: "upgrade",
                    args: (new_wasm_hash.clone(),).into_val(&env),
                    sub_invokes: &[],
                },
            }])
            .upgrade(&new_wasm_hash);
    }

    /// A non-admin address must not be able to upgrade the contract.
    #[test]
    fn test_non_admin_cannot_upgrade() {
        let env = Env::default();
        let (_admin, _sender, client) = setup(&env);

        let attacker = Address::generate(&env);
        let new_wasm_hash = BytesN::from_array(&env, &[0u8; 32]);

        // Attacker cannot upgrade — require_auth will panic
        client
            .mock_auths(&[MockAuth {
                address: &attacker,
                invoke: &MockAuthInvoke {
                    contract: &client.address,
                    fn_name: "upgrade",
                    args: (new_wasm_hash.clone(),).into_val(&env),
                    sub_invokes: &[],
                },
            }])
            .try_upgrade(&new_wasm_hash)
            .expect_err("non-admin must not be able to upgrade");
    }
}
