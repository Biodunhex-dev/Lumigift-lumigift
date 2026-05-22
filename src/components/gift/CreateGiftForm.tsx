"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createGiftSchema } from "@/types/schemas";
import type { CreateGiftInput } from "@/types/schemas";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { GiftPreview } from "./GiftPreview";
import { useState } from "react";
import { useCsrf } from "@/hooks/useCsrf";
import { formatNGN } from "@/lib/currency";
import styles from "./CreateGiftForm.module.css";

type Step = "form" | "preview";

export function CreateGiftForm() {
  const [step, setStep] = useState<Step>("form");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usdcEquivalent, setUsdcEquivalent] = useState("…");
  const [showUnregisteredWarning, setShowUnregisteredWarning] = useState(false);
  const [recipientRegistered, setRecipientRegistered] = useState<boolean | null>(null);

  const { csrfFetch } = useCsrf();

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<CreateGiftInput>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(createGiftSchema) as any,
    defaultValues: { paymentProvider: "paystack", recipientIsRegistered: true },
    mode: "onBlur",
  });

  // Step 1 → Step 2: fetch USDC estimate then show preview
  const onFormSubmit = async (data: CreateGiftInput) => {
    setError(null);
    try {
      // Check if recipient is registered (GET — no CSRF needed)
      const checkRes = await fetch(`/api/v1/users?phone=${encodeURIComponent(data.recipientPhone)}`);
      if (checkRes.ok) {
        const checkJson = await checkRes.json();
        setRecipientRegistered(checkJson.data?.exists ?? false);
        if (!checkJson.data?.exists) {
          setShowUnregisteredWarning(true);
          return; // Don't proceed to preview yet
        }
      } else {
        // If check fails, assume registered to not block
        setRecipientRegistered(true);
      }

      // GET — no CSRF needed
      const res = await fetch(`/api/v1/exchange-rate?ngn=${data.amountNgn}`);
      if (res.ok) {
        const json = await res.json();
        setUsdcEquivalent(json.data?.usdc ?? "—");
      }
    } catch {
      // non-critical — preview still shows without USDC estimate
    }
    setStep("preview");
  };

  const onProceedUnregistered = async () => {
    setShowUnregisteredWarning(false);
    // Now proceed to fetch exchange rate and preview
    try {
      const data = getValues();
      // GET — no CSRF needed
      const res = await fetch(`/api/v1/exchange-rate?ngn=${data.amountNgn}`);
      if (res.ok) {
        const json = await res.json();
        setUsdcEquivalent(json.data?.usdc ?? "—");
      }
    } catch {
      // non-critical
    }
    setStep("preview");
  };

  const onCancelUnregistered = () => {
    setShowUnregisteredWarning(false);
  };

  const onConfirm = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = getValues();
      const res = await csrfFetch("/api/v1/gifts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          recipientIsRegistered: recipientRegistered ?? true,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        setError(errorData.error || "Failed to create gift");
        return;
      }

      const json = await res.json();
      const { paymentUrl } = json.data;

      // Redirect to payment
      window.location.href = paymentUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  if (step === "preview") {
    return (
      <GiftPreview
        data={getValues()}
        usdcEquivalent={usdcEquivalent}
        onEdit={() => setStep("form")}
        onConfirm={onConfirm}
        loading={loading}
        error={error}
      />
    );
  }

  return (
    <>
      <form className={styles.form} onSubmit={handleSubmit(onFormSubmit as Parameters<typeof handleSubmit>[0])} noValidate>
        <h2 className={styles.title}>Send a Gift</h2>

        <Input
          label="Recipient's Name"
          placeholder="e.g. Amara"
          error={errors.recipientName?.message}
          {...register("recipientName")}
        />

        <Input
          label="Recipient's Phone"
          type="tel"
          placeholder="+2348012345678"
          error={errors.recipientPhone?.message}
          {...register("recipientPhone")}
        />

        <Input
          label="Gift Amount (₦)"
          type="number"
          placeholder="5000"
          min={500}
          max={500000}
          error={errors.amountNgn?.message}
          {...register("amountNgn", { valueAsNumber: true })}
        />
        <p className="input-hint">
          Min {formatNGN(500)} · Max {formatNGN(500000)} · Daily limit {formatNGN(1000000)}
        </p>

        <Input
          label="Unlock Date & Time"
          type="datetime-local"
          error={errors.unlockAt?.message}
          {...register("unlockAt")}
        />

        <Textarea
          label="Personal Message (optional)"
          id="message"
          rows={3}
          placeholder="Write something heartfelt…"
          error={errors.message?.message}
          {...register("message")}
        />

        <Button type="submit" fullWidth>
          Preview Gift →
        </Button>
      </form>

      {showUnregisteredWarning && (
        <div className={styles.overlay}>
          <div className={styles.modal}>
            <h3>Unregistered Recipient</h3>
            <p>The recipient's phone number is not registered with Lumigift. They will receive an SMS invitation to claim the gift, but must register first.</p>
            <p>Are you sure you want to proceed?</p>
            <div className={styles.modalActions}>
              <Button onClick={onCancelUnregistered} variant="secondary">
                Cancel
              </Button>
              <Button onClick={onProceedUnregistered}>
                Proceed
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
