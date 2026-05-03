import axios from "axios";
import { serverConfig } from "@/server/config";

const termiiClient = axios.create({
  baseURL: "https://api.ng.termii.com/api",
  headers: { "Content-Type": "application/json" },
});

/**
 * Sends a new-device login alert to the user via SMS.
 * Called when a login is detected from an unrecognised device fingerprint.
 *
 * @param phone - E.164-formatted destination phone number.
 * @param options.time - Human-readable timestamp of the login event (UTC string).
 * @param options.country - Country name resolved from the login IP address.
 * @param options.reportUrl - URL the user can visit to report a suspicious login.
 * @returns Resolves when the SMS has been dispatched to Termii.
 * @throws If the Termii API returns a non-2xx response.
 */
export async function sendNewDeviceAlert(
  phone: string,
  { time, country, reportUrl }: { time: string; country: string; reportUrl: string }
): Promise<void> {
  await termiiClient.post("/sms/send", {
    to: phone,
    from: serverConfig.termii.senderId,
    sms:
      `Lumigift: New login detected on your account.\n` +
      `Time: ${time}\nLocation: ${country}\n` +
      `Not you? Report it: ${reportUrl}`,
    type: "plain",
    channel: "generic",
    api_key: serverConfig.termii.apiKey,
  });
}

/**
 * Generates a 6-digit OTP, sends it to the given phone number via SMS,
 * and returns the generated OTP so the caller can persist it.
 *
 * @param phone - E.164-formatted destination phone number.
 * @returns The 6-digit OTP string that was sent.
 * @throws If the Termii API returns a non-2xx response.
 */
export async function sendOtp(phone: string): Promise<string> {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  await termiiClient.post("/sms/send", {
    to: phone,
    from: serverConfig.termii.senderId,
    sms: `Your Lumigift verification code is: ${otp}. Valid for 10 minutes.`,
    type: "plain",
    channel: "generic",
    api_key: serverConfig.termii.apiKey,
  });

  return otp;
}

/**
 * Sends a gift invitation SMS to an unregistered recipient.
 * The invitation includes a link to claim the gift after registering.
 *
 * @param phone - E.164-formatted destination phone number.
 * @param invitationToken - The invitation token for the gift.
 * @param recipientName - The name of the person sending the gift.
 * @returns Resolves when the SMS has been dispatched to Termii.
 * @throws If the Termii API returns a non-2xx response.
 */
export async function sendGiftInvitation(
  phone: string,
  invitationToken: string,
  senderName: string
): Promise<void> {
  const claimLink = `${serverConfig.app.url}/auth/register?invitation=${encodeURIComponent(invitationToken)}`;

  await termiiClient.post("/sms/send", {
    to: phone,
    from: serverConfig.termii.senderId,
    sms:
      `${senderName} sent you a gift on Lumigift! 🎁\n` +
      `Register to claim it: ${claimLink}\n` +
      `Valid for 30 days.`,
    type: "plain",
    channel: "generic",
    api_key: serverConfig.termii.apiKey,
  });
}
