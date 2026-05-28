"use client";

import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import styles from "./DateTimePicker.module.css";

const PHONE_TIMEZONE_MAP: Record<string, string> = {
  "+234": "Africa/Lagos",
  "+1": "America/New_York",
  "+44": "Europe/London",
  "+91": "Asia/Kolkata",
  "+61": "Australia/Sydney",
  "+81": "Asia/Tokyo",
};

function lookupTimezone(phone?: string) {
  if (!phone) return undefined;
  for (const prefix of Object.keys(PHONE_TIMEZONE_MAP)) {
    if (phone.startsWith(prefix)) {
      return PHONE_TIMEZONE_MAP[prefix];
    }
  }
  return undefined;
}

interface DateTimePickerProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  selectedDate?: string;
  recipientPhone?: string;
}

export function DateTimePicker({
  label,
  error,
  selectedDate,
  recipientPhone,
  id,
  ...inputProps
}: DateTimePickerProps) {
  const [minValue, setMinValue] = useState("");
  const [timeZone, setTimeZone] = useState("");
  const recipientTimeZone = useMemo(() => lookupTimezone(recipientPhone), [recipientPhone]);
  const selectedReadable = useMemo(() => {
    if (!selectedDate) return undefined;
    const parsed = new Date(selectedDate);
    return Number.isNaN(parsed.getTime()) ? undefined : format(parsed, "EEE, MMM d, yyyy 'at' h:mm a");
  }, [selectedDate]);

  useEffect(() => {
    const now = new Date(Date.now() + 60 * 60 * 1000);
    const pad = (value: number) => String(value).padStart(2, "0");
    setMinValue(
      `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`
    );
    setTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC");
  }, []);

  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>{label}</label>
      <input
        id={id}
        type="datetime-local"
        className={styles.input}
        min={minValue}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        {...inputProps}
      />
      <div className={styles.meta}>
        <p className={styles.timezone} suppressHydrationWarning>
          Your local timezone: <strong>{timeZone || "…"}</strong>
        </p>
        {recipientTimeZone && recipientTimeZone !== timeZone ? (
          <p className={styles.recipientTimezone}>
            Recipient timezone: <strong>{recipientTimeZone}</strong>
          </p>
        ) : null}
        {selectedReadable ? (
          <p className={styles.selected}>Selected: <strong>{selectedReadable}</strong></p>
        ) : null}
      </div>
      {error ? (
        <p id={`${id}-error`} className={styles.error}>{error}</p>
      ) : null}
    </div>
  );
}
