import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.RESEND_FROM_EMAIL ?? "Lumigift <gifts@lumigift.com>";

export interface GiftEmailData {
  recipientName: string;
  senderName?: string;
  amountNgn?: number;
  unlockAt?: Date;
  message?: string;
}

function baseTemplate(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <style>
    body { margin: 0; padding: 0; background: #0d0d14; font-family: Inter, system-ui, sans-serif; color: #f0f0f5; }
    .container { max-width: 560px; margin: 40px auto; background: #16161f; border: 1px solid #2a2a3a; border-radius: 16px; overflow: hidden; }
    .header { background: linear-gradient(135deg, #6c3bff, #5a2ee0); padding: 32px 40px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; color: #fff; }
    .body { padding: 32px 40px; }
    .body p { margin: 0 0 16px; font-size: 15px; line-height: 1.6; color: #c0c0d0; }
    .highlight { background: #1e1e2a; border-radius: 12px; padding: 20px 24px; margin: 24px 0; }
    .highlight .label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #9898b0; margin: 0 0 4px; }
    .highlight .value { font-size: 18px; font-weight: 700; color: #f0f0f5; margin: 0; }
    .footer { padding: 20px 40px; text-align: center; font-size: 12px; color: #5a5a72; border-top: 1px solid #1e1e2a; }
    .btn { display: inline-block; background: #6c3bff; color: #fff; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: 600; font-size: 14px; margin: 8px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header"><h1>🎁 Lumigift</h1></div>
    <div class="body">${body}</div>
    <div class="footer">© 2024 Lumigift · <a href="{{unsubscribe_url}}" style="color:#5a5a72">Unsubscribe</a></div>
  </div>
</body>
</html>`;
}

export async function sendGiftReceivedEmail(
  to: string,
  data: GiftEmailData
): Promise<void> {
  const body = `
    <p>Hi ${data.recipientName},</p>
    <p>You've received a time-locked gift${data.senderName ? ` from <strong>${data.senderName}</strong>` : ""}! 🎉</p>
    <div class="highlight">
      <p class="label">Unlocks on</p>
      <p class="value">${data.unlockAt ? data.unlockAt.toLocaleDateString("en-NG", { dateStyle: "long" }) : "a surprise date"}</p>
    </div>
    <p>The gift amount and any personal message will be revealed when it unlocks. Stay tuned!</p>
  `;
  await resend.emails.send({
    from: FROM,
    to,
    subject: "🎁 You've received a Lumigift!",
    html: baseTemplate("You've received a Lumigift!", body),
  });
}

export async function sendUnlockReminderEmail(
  to: string,
  data: GiftEmailData
): Promise<void> {
  const body = `
    <p>Hi ${data.recipientName},</p>
    <p>Great news — your Lumigift has just unlocked! 🔓</p>
    ${data.amountNgn ? `<div class="highlight"><p class="label">Gift Amount</p><p class="value">₦${data.amountNgn.toLocaleString("en-NG")}</p></div>` : ""}
    ${data.message ? `<div class="highlight"><p class="label">Message</p><p class="value" style="font-size:15px;font-style:italic">"${data.message}"</p></div>` : ""}
    <p>Log in to claim your gift now.</p>
    <a class="btn" href="${process.env.NEXT_PUBLIC_APP_URL ?? "https://lumigift.com"}/dashboard">Claim Your Gift</a>
  `;
  await resend.emails.send({
    from: FROM,
    to,
    subject: "🔓 Your Lumigift has unlocked!",
    html: baseTemplate("Your Lumigift has unlocked!", body),
  });
}

export async function sendClaimConfirmationEmail(
  to: string,
  data: GiftEmailData
): Promise<void> {
  const body = `
    <p>Hi ${data.recipientName},</p>
    <p>Your Lumigift has been successfully claimed! ✅</p>
    ${data.amountNgn ? `<div class="highlight"><p class="label">Amount Claimed</p><p class="value">₦${data.amountNgn.toLocaleString("en-NG")}</p></div>` : ""}
    <p>The funds have been sent to your Stellar wallet. Thank you for using Lumigift!</p>
  `;
  await resend.emails.send({
    from: FROM,
    to,
    subject: "✅ Lumigift claimed successfully",
    html: baseTemplate("Lumigift claimed!", body),
  });
}
