import Link from "next/link";
import type { FAQSectionProps } from "../components/FAQSection";

export interface FAQContent {
  sections: Omit<FAQSectionProps, "className">[];
  lastReviewed: Date;
  version: string;
}

export const faqContent: FAQContent = {
  lastReviewed: new Date("2024-12-19"),
  version: "1.0.0",
  sections: [
    {
      id: "how-gifts-work",
      title: "How Gifts Work",
      description: "Learn about Lumigift's time-locked gift system and how it works end-to-end.",
      items: [
        {
          id: "what-is-lumigift",
          question: "What is Lumigift and how does it work?",
          answer: (
            <div>
              <p>
                Lumigift is a platform for sending time-locked cash gifts. When you create a gift, 
                the money is held in a smart contract on the Stellar blockchain until a specific 
                unlock date that you choose.
              </p>
              <p>
                The recipient receives an SMS notification that a gift is waiting for them, but 
                the amount remains completely hidden until the unlock date arrives. This creates 
                a true surprise element for special occasions like birthdays and anniversaries.
              </p>
            </div>
          ),
        },
        {
          id: "gift-lifecycle",
          question: "What happens after I send a gift?",
          answer: (
            <div>
              <p>Here's the complete gift lifecycle:</p>
              <ol>
                <li><strong>Payment:</strong> You pay in Nigerian Naira via Paystack, and the amount is converted to USDC</li>
                <li><strong>Escrow:</strong> The USDC is locked in a smart contract on the Stellar blockchain</li>
                <li><strong>Notification:</strong> The recipient gets an SMS saying a gift is waiting (amount hidden)</li>
                <li><strong>Unlock:</strong> On your chosen date, the gift unlocks and the recipient is notified</li>
                <li><strong>Claim:</strong> The recipient logs in and claims the USDC to their Stellar wallet</li>
              </ol>
            </div>
          ),
        },
        {
          id: "usdc-denomination",
          question: "Why are gifts denominated in USDC?",
          answer: "Gifts are converted to USDC (a US Dollar stablecoin) to ensure the value doesn't change between when you send the gift and when the recipient claims it. This protects against currency fluctuations and ensures your ₦5,000 gift maintains its dollar value over time.",
        },
        {
          id: "gift-expiry",
          question: "What happens if a gift isn't claimed?",
          answer: "If a gift remains unclaimed for 365 days after the unlock date, it automatically expires and the USDC is refunded to your original payment method. You'll receive an SMS notification when this happens.",
        },
        {
          id: "scheduled-gifts",
          question: "Can I schedule when the recipient gets notified?",
          answer: (
            <div>
              <p>
                Yes! When creating a gift, you can optionally set a "delivery date" that's separate 
                from the unlock date. This lets you:
              </p>
              <ul>
                <li>Create the gift weeks in advance</li>
                <li>Have it delivered to the recipient on a specific date</li>
                <li>Set the unlock date for later (like their actual birthday)</li>
              </ul>
              <p>
                The delivery date must be before or equal to the unlock date to give recipients 
                time to receive and claim their gifts.
              </p>
            </div>
          ),
        },
      ],
    },
    {
      id: "payment-methods",
      title: "Supported Payment Methods",
      description: "Information about payment options, limits, and currency conversion.",
      items: [
        {
          id: "paystack-ngn",
          question: "What payment methods do you accept?",
          answer: (
            <div>
              <p>We support two payment providers:</p>
              <ul>
                <li><strong>Paystack:</strong> For Nigerian users paying in Naira (₦) via bank transfer or debit card</li>
                <li><strong>Stripe:</strong> For international users paying with credit/debit cards in other currencies</li>
              </ul>
              <p>
                Most Nigerian users will use Paystack, which offers the best rates and local 
                payment methods including bank transfers and USSD.
              </p>
            </div>
          ),
        },
        {
          id: "currency-conversion",
          question: "How is the NGN to USDC conversion calculated?",
          answer: "When you pay in Nigerian Naira, we convert your payment to USDC using the live exchange rate at the time of gift creation. This rate is fetched from the Stellar network and cached for 60 seconds to ensure accuracy. The USDC amount is locked in the smart contract, protecting against future currency fluctuations.",
        },
        {
          id: "payment-limits",
          question: "Are there limits on gift amounts?",
          answer: (
            <div>
              <p>Yes, there are several limits in place for security:</p>
              <ul>
                <li><strong>Minimum gift:</strong> ₦500 per gift</li>
                <li><strong>Maximum gift:</strong> ₦500,000 per gift</li>
                <li><strong>Daily limit:</strong> Total sending limit per user per day</li>
              </ul>
              <p>
                These limits help protect against fraud and ensure the platform remains 
                accessible to all users. Contact support if you need to send larger amounts.
              </p>
            </div>
          ),
        },
        {
          id: "payment-security",
          question: "Is my payment information secure?",
          answer: "Yes. We never store your payment details. All payments are processed directly by Paystack (for NGN) or Stripe (for international), both of which are PCI DSS compliant payment processors. Lumigift only receives confirmation that payment was successful.",
        },
      ],
    },
    {
      id: "unlock-process",
      title: "What Happens at Unlock",
      description: "Understanding the gift unlock process and how recipients claim their gifts.",
      items: [
        {
          id: "unlock-notification",
          question: "How does the recipient know when their gift unlocks?",
          answer: "On the unlock date you specified, the smart contract automatically releases the gift and we send the recipient an SMS notification. This message will reveal the gift amount and provide instructions on how to claim it.",
        },
        {
          id: "claim-process",
          question: "How does the recipient claim their gift?",
          answer: (
            <div>
              <p>To claim a gift, the recipient needs to:</p>
              <ol>
                <li>Click the link in the SMS notification or visit the Lumigift website</li>
                <li>Log in using their phone number and the OTP (one-time password) sent via SMS</li>
                <li>Provide their Stellar wallet public key (starts with 'G')</li>
                <li>Confirm the claim to transfer the USDC to their wallet</li>
              </ol>
              <p>
                The entire process takes just a few minutes, and they'll receive a transaction 
                hash as proof of the transfer.
              </p>
            </div>
          ),
        },
        {
          id: "stellar-wallet",
          question: "What if the recipient doesn't have a Stellar wallet?",
          answer: (
            <div>
              <p>
                Recipients need a Stellar wallet to receive USDC. If they don't have one, 
                they can create a free wallet using:
              </p>
              <ul>
                <li><strong>Lobstr:</strong> Mobile app available on iOS and Android</li>
                <li><strong>Stellar Laboratory:</strong> Web-based wallet for desktop users</li>
                <li><strong>Freighter:</strong> Browser extension wallet</li>
              </ul>
              <p>
                We provide step-by-step instructions during the claim process to help 
                recipients set up their wallet if needed.
              </p>
            </div>
          ),
        },
        {
          id: "claim-deadline",
          question: "Is there a deadline to claim gifts?",
          answer: "Recipients have 365 days from the unlock date to claim their gift. After this period, the gift expires and the USDC is automatically refunded to the sender's original payment method.",
        },
        {
          id: "multiple-gifts",
          question: "Can someone receive multiple gifts?",
          answer: "Yes! Recipients can receive multiple gifts from different senders. Each gift is independent and can be claimed separately. All gifts sent to the same phone number will appear in their account when they log in.",
        },
      ],
    },
    {
      id: "cancellation-policy",
      title: "Cancellation Policy",
      description: "When and how you can cancel gifts, and what happens to your money.",
      items: [
        {
          id: "when-can-cancel",
          question: "When can I cancel a gift?",
          answer: (
            <div>
              <p>You can cancel a gift in these situations:</p>
              <ul>
                <li><strong>Scheduled gifts:</strong> Before the delivery date (while in 'scheduled' state)</li>
                <li><strong>Locked gifts:</strong> Before the unlock date has passed</li>
                <li><strong>Unlocked gifts:</strong> Even after unlock, as long as the recipient hasn't claimed it yet</li>
              </ul>
              <p>
                Once a recipient has claimed their gift, it cannot be cancelled or reversed 
                since the USDC has already been transferred to their wallet.
              </p>
            </div>
          ),
        },
        {
          id: "how-to-cancel",
          question: "How do I cancel a gift?",
          answer: (
            <div>
              <p>To cancel a gift:</p>
              <ol>
                <li>Log in to your Lumigift dashboard</li>
                <li>Find the gift you want to cancel</li>
                <li>Click the "Cancel" button (only visible for eligible gifts)</li>
                <li>Confirm the cancellation</li>
              </ol>
              <p>
                For scheduled gifts, you can also use the dedicated cancellation endpoint. 
                Only you (the sender) can cancel your own gifts.
              </p>
            </div>
          ),
        },
        {
          id: "refund-process",
          question: "How do refunds work?",
          answer: "When you cancel a gift, the full NGN amount is refunded to your original payment method via Paystack. Refunds typically process within 3-5 business days, though this depends on your bank. You'll receive an email confirmation when the refund is initiated.",
        },
        {
          id: "cannot-cancel",
          question: "What if I can't cancel a gift?",
          answer: (
            <div>
              <p>You cannot cancel a gift if:</p>
              <ul>
                <li>The recipient has already claimed it</li>
                <li>The gift has expired (365 days after unlock)</li>
                <li>You're not the original sender</li>
              </ul>
              <p>
                If you believe there's an error or have special circumstances, contact our 
                support team for assistance.
              </p>
            </div>
          ),
        },
        {
          id: "partial-refunds",
          question: "Are there any fees for cancellation?",
          answer: "No, there are no fees for cancelling gifts. You'll receive a full refund of the amount you paid. However, any payment processing fees charged by Paystack during the original transaction are non-refundable, as per their standard policy.",
        },
      ],
    },
    {
      id: "security",
      title: "Security",
      description: "How we keep your money and personal information safe.",
      items: [
        {
          id: "smart-contract-custody",
          question: "How is my money protected?",
          answer: (
            <div>
              <p>
                Your gift funds are protected by multiple layers of security:
              </p>
              <ul>
                <li><strong>Smart contracts:</strong> Funds are held in audited Soroban smart contracts on Stellar, not by Lumigift</li>
                <li><strong>Non-custodial:</strong> We never have access to your money once it's in the contract</li>
                <li><strong>Blockchain security:</strong> Protected by the Stellar network's consensus mechanism</li>
                <li><strong>Time-locks:</strong> Funds can only be released on or after the specified unlock date</li>
              </ul>
              <p>
                This means even if Lumigift's servers went offline, your gifts would still 
                unlock and be claimable directly from the blockchain.
              </p>
            </div>
          ),
        },
        {
          id: "authentication",
          question: "How does login and authentication work?",
          answer: (
            <div>
              <p>
                Lumigift uses phone-based authentication for security and simplicity:
              </p>
              <ul>
                <li><strong>No passwords:</strong> We don't store any passwords that could be compromised</li>
                <li><strong>SMS OTP:</strong> Each login requires a one-time password sent to your phone</li>
                <li><strong>Rate limiting:</strong> OTP requests are limited to prevent abuse (3 per phone per 10 minutes)</li>
                <li><strong>Device tracking:</strong> We monitor for suspicious login patterns</li>
              </ul>
              <p>
                This approach is both more secure and more convenient than traditional passwords.
              </p>
            </div>
          ),
        },
        {
          id: "privacy-protection",
          question: "How do you protect my privacy?",
          answer: (
            <div>
              <p>
                We take privacy seriously and minimize data collection:
              </p>
              <ul>
                <li><strong>Phone number hashing:</strong> Recipient phone numbers are stored as one-way cryptographic hashes</li>
                <li><strong>No plaintext storage:</strong> We never store recipient phone numbers in readable form</li>
                <li><strong>Minimal data:</strong> We only collect information necessary for the service to function</li>
                <li><strong>No selling:</strong> We never sell or share your personal information with third parties</li>
              </ul>
            </div>
          ),
        },
        {
          id: "suspicious-activity",
          question: "What if I notice suspicious activity on my account?",
          answer: (
            <div>
              <p>
                If you suspect your account has been compromised:
              </p>
              <ol>
                <li>Contact our support team immediately</li>
                <li>Check your gift history for any unauthorized transactions</li>
                <li>If you received a suspicious login SMS, click the "this wasn't me" link</li>
              </ol>
              <p>
                We use device fingerprinting to detect unusual login patterns and will 
                flag suspicious activity automatically. Always report security concerns 
                to our support team as soon as possible.
              </p>
            </div>
          ),
        },
        {
          id: "platform-security",
          question: "How secure is the Lumigift platform itself?",
          answer: (
            <div>
              <p>
                Lumigift is built with security best practices:
              </p>
              <ul>
                <li><strong>HTTPS everywhere:</strong> All communications are encrypted in transit</li>
                <li><strong>Regular security audits:</strong> Code and infrastructure are regularly reviewed</li>
                <li><strong>Secure hosting:</strong> Infrastructure hosted on secure, monitored cloud platforms</li>
                <li><strong>Rate limiting:</strong> Protection against abuse and automated attacks</li>
                <li><strong>Input validation:</strong> All user inputs are validated and sanitized</li>
              </ul>
            </div>
          ),
        },
      ],
    },
  ],
};