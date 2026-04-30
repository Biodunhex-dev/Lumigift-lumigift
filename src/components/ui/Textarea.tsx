import { clsx } from "clsx";
import { forwardRef } from "react";

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, hint, id, className, ...props }, ref) => {
    const textareaId = id ?? label?.toLowerCase().replace(/\s+/g, "-");
    return (
      <div className="input-group">
        {label && (
          <label className="input-label" htmlFor={textareaId}>
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          className={clsx("input", error && "input--error", className)}
          aria-invalid={!!error}
          aria-describedby={error ? `${textareaId}-error` : hint ? `${textareaId}-hint` : undefined}
          {...props}
        />
        {hint && !error && (
          <span id={`${textareaId}-hint`} className="input-error-msg" style={{ color: "var(--color-text-muted)" }}>
            {hint}
          </span>
        )}
        {error && (
          <span id={`${textareaId}-error`} className="input-error-msg" role="alert">
            {error}
          </span>
        )}
      </div>
    );
  }
);

Textarea.displayName = "Textarea";