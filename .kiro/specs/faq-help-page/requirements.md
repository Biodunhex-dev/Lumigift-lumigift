# Requirements Document

## Introduction

Lumigift currently has no self-service help resource. Users who have questions about how time-locking works, what happens if they lose their phone, or whether they can cancel a gift have nowhere to turn. This feature introduces a user-facing FAQ and help documentation page at `/help` (or `/faq`) that covers the most common questions across five topic areas: how gifts work, supported payment methods, what happens at unlock, cancellation policy, and security. The page will be linked from both the landing page and the authenticated dashboard so users can find it at any point in their journey.

---

## Glossary

- **FAQ_Page**: The static help and FAQ page served at `/help`.
- **Gift**: A time-locked cash transfer created by a Sender and claimed by a Recipient.
- **Sender**: An authenticated Lumigift user who creates and pays for a Gift.
- **Recipient**: The person designated to receive a Gift, identified by phone number.
- **Unlock_Date**: The date and time chosen by the Sender after which the Recipient may claim the Gift.
- **Escrow_Contract**: The Soroban smart contract on the Stellar blockchain that holds Gift funds until the Unlock_Date passes.
- **Claim**: The action a Recipient takes to transfer unlocked Gift funds to their Stellar wallet.
- **Cancellation**: The action a Sender takes to cancel a Gift before it has been claimed.
- **OTP**: One-time password sent via SMS used to authenticate users.
- **USDC**: USD Coin stablecoin used to denominate Gift value on the Stellar network.
- **NGN**: Nigerian Naira, the currency Senders use to pay for Gifts via Paystack.
- **Paystack**: The primary payment provider for NGN payments.
- **Stripe**: The secondary payment provider for international (non-NGN) card payments.

---

## Requirements

### Requirement 1: FAQ Page Route

**User Story:** As a user, I want to visit a dedicated help page, so that I can find answers to common questions without contacting support.

#### Acceptance Criteria

1. THE FAQ_Page SHALL be accessible at the `/help` URL path.
2. THE FAQ_Page SHALL return an HTTP 200 response for unauthenticated and authenticated users.
3. THE FAQ_Page SHALL render content server-side and include appropriate page metadata (title and description) for search engine discoverability.

---

### Requirement 2: How Gifts Work

**User Story:** As a prospective or new user, I want to understand how Lumigift gifts work end-to-end, so that I can confidently send or receive a gift.

#### Acceptance Criteria

1. THE FAQ_Page SHALL include a section explaining that a Gift is a cash transfer held in an Escrow_Contract on the Stellar blockchain until the Unlock_Date chosen by the Sender.
2. THE FAQ_Page SHALL explain that the Recipient receives an SMS notification when a Gift is created but the amount remains hidden until the Unlock_Date.
3. THE FAQ_Page SHALL explain that after the Unlock_Date passes, the Recipient must log in and Claim the Gift to receive the funds in their Stellar wallet.
4. THE FAQ_Page SHALL explain that Gift value is denominated in USDC so the amount does not change between creation and Claim.
5. THE FAQ_Page SHALL explain that unclaimed Gifts expire after 365 days and funds are automatically refunded to the Sender.

---

### Requirement 3: Supported Payment Methods

**User Story:** As a Sender, I want to know which payment methods are accepted, so that I can choose the right option before starting the gift creation flow.

#### Acceptance Criteria

1. THE FAQ_Page SHALL state that NGN card and bank-transfer payments are accepted via Paystack for Nigerian users.
2. THE FAQ_Page SHALL state that international card payments are accepted via Stripe for non-NGN users.
3. THE FAQ_Page SHALL explain that the NGN amount paid is converted to USDC at the exchange rate at the time of Gift creation.
4. THE FAQ_Page SHALL state that the minimum and maximum Gift amounts are subject to the platform's daily sending limits.

---

### Requirement 4: What Happens at Unlock

**User Story:** As a Recipient, I want to understand what happens when my gift unlocks, so that I know what steps to take to receive my money.

#### Acceptance Criteria

1. THE FAQ_Page SHALL explain that on the Unlock_Date the Escrow_Contract releases the Gift and the Recipient is notified via SMS.
2. THE FAQ_Page SHALL explain that the Recipient must log in to Lumigift using their phone number and OTP to access the Claim flow.
3. THE FAQ_Page SHALL explain that the Recipient must provide a valid Stellar wallet public key to complete the Claim.
4. THE FAQ_Page SHALL explain that once a Claim is submitted the USDC transfer is processed on the Stellar network and a transaction hash is provided as confirmation.
5. IF the Recipient does not have a Stellar wallet, THE FAQ_Page SHALL direct the Recipient to information about creating one before attempting to Claim.

---

### Requirement 5: Cancellation Policy

**User Story:** As a Sender, I want to understand when and how I can cancel a gift, so that I know my options if my plans change.

#### Acceptance Criteria

1. THE FAQ_Page SHALL state that a Sender may cancel a Gift only while the Gift is in the `locked` or `scheduled` state (i.e., before the Unlock_Date has passed and before the Recipient has claimed it).
2. THE FAQ_Page SHALL state that cancellation is initiated by the Sender from the dashboard and that only the Sender of a Gift may cancel it.
3. THE FAQ_Page SHALL state that upon cancellation the NGN amount is refunded to the original payment method via Paystack.
4. THE FAQ_Page SHALL state that Gifts that have already been claimed cannot be cancelled or reversed.
5. THE FAQ_Page SHALL state that Gifts that have already been unlocked but not yet claimed may still be cancelled by the Sender.

---

### Requirement 6: Security

**User Story:** As a user, I want to understand how Lumigift keeps my money and account safe, so that I can trust the platform with my funds.

#### Acceptance Criteria

1. THE FAQ_Page SHALL explain that Gift funds are held in a non-custodial Soroban Escrow_Contract on the Stellar blockchain and are not held by Lumigift directly.
2. THE FAQ_Page SHALL explain that authentication uses phone number and OTP via SMS and that no password is stored.
3. THE FAQ_Page SHALL explain that recipient phone numbers are stored as one-way cryptographic hashes and are never stored in plaintext.
4. THE FAQ_Page SHALL explain that OTP requests are rate-limited to protect against abuse.
5. THE FAQ_Page SHALL explain that users who suspect their account has been compromised should contact support immediately at the published security contact address.
6. THE FAQ_Page SHALL explain that Lumigift uses device fingerprinting to detect and flag suspicious login activity.

---

### Requirement 7: Navigation Links

**User Story:** As a user, I want to find the help page from the landing page and dashboard, so that I can access help at any point in my journey.

#### Acceptance Criteria

1. THE Landing_Page SHALL include a visible link to the FAQ_Page in the page footer or navigation.
2. THE Dashboard SHALL include a visible link to the FAQ_Page in the page footer or navigation.
3. WHEN a user activates the help link, THE Browser SHALL navigate to `/help`.
4. THE FAQ_Page SHALL include a link back to the landing page (`/`) so users can return easily.

---

### Requirement 8: Content Accuracy

**User Story:** As a user, I want the FAQ answers to reflect how the system actually behaves, so that I am not misled by outdated or incorrect information.

#### Acceptance Criteria

1. THE FAQ_Page SHALL accurately describe the gift lifecycle states (`draft`, `pending_payment`, `funded`, `locked`, `scheduled`, `unlocked`, `claimed`, `expired`, `cancelled`) in user-friendly language without exposing internal state names.
2. THE FAQ_Page SHALL accurately describe the cancellation eligibility rules as implemented in the gift service (only `locked` and `scheduled` gifts may be cancelled by the Sender).
3. THE FAQ_Page SHALL accurately describe the 365-day expiry and automatic refund behaviour.
4. THE FAQ_Page SHALL accurately describe the two supported payment providers (Paystack for NGN, Stripe for international).
5. WHEN the underlying system behaviour changes, THE FAQ_Page content SHALL be updated to reflect the change before the change is deployed to production.

---

### Requirement 9: Accessibility and Responsiveness

**User Story:** As a user on any device, I want the help page to be readable and navigable, so that I can find answers regardless of how I access Lumigift.

#### Acceptance Criteria

1. THE FAQ_Page SHALL render correctly on viewport widths from 320 px to 1440 px.
2. THE FAQ_Page SHALL use semantic HTML elements (headings, lists, sections) so that screen readers can navigate the content.
3. THE FAQ_Page SHALL provide sufficient colour contrast between text and background in accordance with the existing Lumigift design system.
4. THE FAQ_Page SHALL allow keyboard navigation between FAQ sections without requiring a mouse.
