"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createGiftSchema, type CreateGiftInput } from "@/types/schemas";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { DateTimePicker } from "@/components/ui/DateTimePicker";
import { TemplateSelector } from "./TemplateSelector";
import { WizardProgress } from "./WizardProgress";
import { GiftPreviewCard } from "./GiftPreviewCard";
import { BLANK_TEMPLATE, type GiftTemplate } from "@/lib/giftTemplates";
import styles from "./GiftWizard.module.css";

// Step indices
const STEP_OCCASION = 0;
const STEP_RECIPIENT = 1;
const STEP_AMOUNT = 2;
const STEP_UNLOCK = 3;
const STEP_REVIEW = 4;

export function GiftWizard() {
  const [step, setStep] = useState(STEP_OCCASION);
  const [template, setTemplate] = useState<GiftTemplate>(BLANK_TEMPLATE);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    watch,
    handleSubmit,
    trigger,
    getValues,
    setValue,
    formState: { errors },
  } = useForm<CreateGiftInput>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(createGiftSchema) as any,
    defaultValues: { paymentProvider: "paystack" },
    mode: "onTouched",
  });

  const recipientPhone = watch("recipientPhone");
  const watchedUnlockAt = watch("unlockAt");

  function handleTemplateSelect(tpl: GiftTemplate) {
    setTemplate(tpl);
    if (tpl.suggestedMessage) {
      setValue("message", tpl.suggestedMessage);
    }
    setStep(STEP_RECIPIENT);
  }

  async function next(fields: (keyof CreateGiftInput)[]) {
    const valid = await trigger(fields);
    if (valid) setStep((s) => s + 1);
  }

  function back() {
    setStep((s) => Math.max(0, s - 1));
  }

  const onSubmit = async (data: CreateGiftInput) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/gifts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      window.location.href = json.data.paymentUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.wrapper}>
      {step > STEP_OCCASION && <WizardProgress currentStep={step} />}

      {step === STEP_OCCASION && (
        <TemplateSelector onSelect={handleTemplateSelect} />
      )}

      {step === STEP_RECIPIENT && (
        <div className={styles.stepContent}>
          <h2 className={styles.stepTitle}>Who is this gift for?</h2>
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
            label="Recipient's Email (optional — for email notifications)"
            type="email"
            placeholder="amara@example.com"
            error={errors.recipientEmail?.message}
            {...register("recipientEmail")}
          />
          <div className={styles.nav}>
            <Button variant="secondary" onClick={back}>Back</Button>
            <Button onClick={() => next(["recipientName", "recipientPhone"])}>Next</Button>
          </div>
        </div>
      )}

      {step === STEP_AMOUNT && (
        <div className={styles.stepContent}>
          <h2 className={styles.stepTitle}>Amount &amp; Message</h2>
          <Input
            label="Gift Amount (₦)"
            type="number"
            placeholder="5000"
            min={500}
            error={errors.amountNgn?.message}
            {...register("amountNgn", { valueAsNumber: true })}
          />
          <div className="input-group">
            <label className="input-label" htmlFor="message">
              Personal Message (optional)
            </label>
            <textarea
              id="message"
              className="input"
              rows={4}
              placeholder="Write something heartfelt…"
              {...register("message")}
            />
            {errors.message && (
              <span className="input-error-msg">{errors.message.message}</span>
            )}
          </div>
          <div className={styles.nav}>
            <Button variant="secondary" onClick={back}>Back</Button>
            <Button onClick={() => next(["amountNgn"])}>Next</Button>
          </div>
        </div>
      )}

      {step === STEP_UNLOCK && (
        <div className={styles.stepContent}>
          <h2 className={styles.stepTitle}>When should it unlock?</h2>
          <DateTimePicker
            label="Unlock Date & Time"
            id="unlockAt"
            error={errors.unlockAt?.message}
            selectedDate={watchedUnlockAt}
            recipientPhone={recipientPhone}
            {...register("unlockAt")}
          />
          <div className={styles.nav}>
            <Button variant="secondary" onClick={back}>Back</Button>
            <Button onClick={() => next(["unlockAt"])}>Review Gift</Button>
          </div>
        </div>
      )}

      {step === STEP_REVIEW && (
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <h2 className={styles.stepTitle}>Review your gift</h2>
          <GiftPreviewCard
            data={getValues()}
            template={template}
            onEdit={(targetStep) => setStep(targetStep)}
          />
          {error && <p className={styles.error}>{error}</p>}
          <div className={styles.nav}>
            <Button type="button" variant="secondary" onClick={back}>Back</Button>
            <Button type="submit" loading={loading}>Continue to Payment</Button>
          </div>
        </form>
      )}
    </div>
  );
}
