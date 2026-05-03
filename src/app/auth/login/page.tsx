"use client";

import { useState, useId } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useCsrf } from "@/hooks/useCsrf";
import styles from "./page.module.css";

type Step = "phone" | "otp";

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { csrfFetch } = useCsrf();
  const errorId = useId();
  const statusId = useId();

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await csrfFetch("/api/v1/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setStep("otp");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send OTP");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const result = await signIn("credentials", {
        phone,
        otp,
        redirect: false,
      });
      if (result?.error) throw new Error("Invalid OTP. Please try again.");
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setLoading(false);
    }
  };

  const stepLabel =
    step === "phone"
      ? "Step 1 of 2: Enter your phone number"
      : "Step 2 of 2: Enter the verification code";

  return (
    <div className={styles.page}>
      <div className={`container container--sm ${styles.inner}`}>
        <div className="card">
          {/* Live region announces step changes to screen readers */}
          <p id={statusId} className="sr-only" aria-live="polite" aria-atomic="true">
            {stepLabel}
          </p>

          <h1 className={styles.title}>
            {step === "phone" ? "Sign in to Lumigift" : "Enter your OTP"}
          </h1>
          <p className={styles.subtitle} id={`${statusId}-desc`}>
            {step === "phone"
              ? "Enter your phone number to receive a one-time code."
              : `We sent a 6-digit code to ${phone}.`}
          </p>

          {step === "phone" ? (
            <form
              onSubmit={handleSendOtp}
              className={styles.form}
              noValidate
              aria-label="Phone number sign-in form"
              aria-describedby={`${statusId}-desc`}
            >
              <Input
                label="Phone Number"
                type="tel"
                placeholder="+2348012345678"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                autoComplete="tel"
                aria-label="Phone number in international format, e.g. +2348012345678"
                error={error ?? undefined}
              />
              <Button type="submit" fullWidth loading={loading}>
                Send Code
              </Button>
            </form>
          ) : (
            <form
              onSubmit={handleVerifyOtp}
              className={styles.form}
              noValidate
              aria-label="OTP verification form"
              aria-describedby={`${statusId}-desc`}
            >
              <Input
                label="6-Digit Code"
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                placeholder="123456"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                required
                autoComplete="one-time-code"
                aria-label="6-digit one-time password sent to your phone"
                aria-describedby={error ? errorId : undefined}
                error={error ?? undefined}
              />
              {/* Standalone error for the OTP step (also surfaced via Input's error prop above) */}
              {error && (
                <p
                  id={errorId}
                  className={styles.error}
                  role="alert"
                  aria-live="assertive"
                >
                  {error}
                </p>
              )}
              <Button type="submit" fullWidth loading={loading}>
                Verify &amp; Sign In
              </Button>
              <button
                type="button"
                className="btn btn--ghost btn--sm btn--full"
                onClick={() => {
                  setStep("phone");
                  setError(null);
                }}
                aria-label="Go back and change your phone number"
              >
                Change number
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
