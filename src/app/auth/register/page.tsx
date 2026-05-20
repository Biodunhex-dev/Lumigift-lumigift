"use client";

import { useState, useId } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useCsrf } from "@/hooks/useCsrf";
import styles from "./page.module.css";

type Step = "register" | "done";

export default function RegisterPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const invitationToken = searchParams.get("invitation") || "";

  const [step, setStep] = useState<Step>("register");
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { csrfFetch } = useCsrf();
  const errorId = useId();
  const statusId = useId();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const body: Record<string, string> = {
        displayName,
        phone,
      };
      if (invitationToken) {
        body.invitationToken = invitationToken;
      }

      const res = await csrfFetch("/api/v1/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const json = await res.json();
      if (!json.success) throw new Error(json.error);

      // After successful registration, redirect to login to verify OTP
      setStep("done");
      setTimeout(() => {
        router.push(`/auth/login?phone=${encodeURIComponent(phone)}`);
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  if (step === "done") {
    return (
      <div className={styles.page}>
        <div className={`container container--sm ${styles.inner}`}>
          <div className="card">
            <h1 className={styles.title}>Account Created! 🎉</h1>
            <p className={styles.subtitle}>Redirecting to verification...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={`container container--sm ${styles.inner}`}>
        <div className="card">
          <h1 className={styles.title}>Create Your Lumigift Account</h1>
          <p className={styles.subtitle}>
            {invitationToken
              ? "Complete your registration to claim your gift!"
              : "Join Lumigift to send and receive digital gifts."}
          </p>

          <form
            onSubmit={handleRegister}
            className={styles.form}
            noValidate
            aria-label="Registration form"
          >
            <Input
              label="Full Name"
              type="text"
              placeholder="e.g. Amara Obi"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
              autoComplete="name"
            />

            <Input
              label="Phone Number"
              type="tel"
              placeholder="+2348012345678"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              autoComplete="tel"
            />

            {error && (
              <div className={styles.error} id={errorId} role="alert">
                {error}
              </div>
            )}

            <Button type="submit" fullWidth loading={loading}>
              Create Account
            </Button>
          </form>

          <p className={styles.footer}>
            Already have an account?{" "}
            <a href="/auth/login">Sign in instead</a>
          </p>
        </div>
      </div>
    </div>
  );
}
