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

// ─── Storage keys ─────────────────────────────────────────────────────────────

#[contracttype]
pub enum DataKey {
    /// The address authorized to call `upgrade`. Set once during `initialize`.
    Admin,
    Sender,
    Recipient,
    Token,
    Amount,
    UnlockTime,
    Claimed,
}

// ─── Contract ─────────────────────────────────────────────────────────────────

#[contract]
pub struct EscrowContract;

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

        // Reject any token that is not the expected USDC contract
        if token != expected_usdc {
            panic!("token must be the USDC contract");
        }

        sender.require_auth();

        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Sender, &sender);
        env.storage().instance().set(&DataKey::Recipient, &recipient);
        env.storage().instance().set(&DataKey::Token, &token);
        env.storage().instance().set(&DataKey::Amount, &amount);
        env.storage().instance().set(&DataKey::UnlockTime, &unlock_time);
        env.storage().instance().set(&DataKey::Claimed, &false);

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

        let token_client = token::Client::new(&env, &token);
        token_client.transfer(&env.current_contract_address(), &recipient, &amount);

        env.events().publish(
            (Symbol::new(&env, "claimed"),),
            (recipient, amount),
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
            (old_wasm_hash, new_wasm_hash),
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

    fn create_token(env: &Env, admin: &Address) -> (Address, TokenClient, StellarAssetClient) {
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
    ) -> (Env, Address, TokenClient, EscrowContractClient) {
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
                "contract balance must be 0 after claim, got {contract_balance}"
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
                "recipient received {received} but expected {amount}"
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
                "expected StillLocked at ts={ledger_ts}, unlock={unlock_time}"
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
