import type { InputHTMLAttributes, ReactNode } from 'react';

interface FieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'name' | 'id'> {
  name: string;
  label: string;
  error?: string;
  hint?: ReactNode;
  optional?: boolean;
  id?: string;
}

/** Labelled input with hint and error text wired up through aria-describedby. */
export function Field({ name, label, error, hint, optional, id, className = '', ...input }: FieldProps) {
  const fieldId = id ?? `field-${name}`;
  const hintId = hint ? `${fieldId}-hint` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={className}>
      <label htmlFor={fieldId} className="field-label">
        {label}
        {optional && <span className="font-normal text-ink-muted"> (optional)</span>}
      </label>
      <input
        id={fieldId}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={`field h-11 ${error ? 'border-bad' : ''} read-only:bg-page read-only:text-ink-muted`}
        {...input}
      />
      {error && (
        <p id={errorId} className="mt-1 text-sm font-medium text-bad">
          {error}
        </p>
      )}
      {hint && (
        <p id={hintId} className="mt-1 text-xs text-ink-muted">
          {hint}
        </p>
      )}
    </div>
  );
}

/** Read-only value shown as text (for fields customers cannot change). */
export function ReadOnlyValue({ label, value, note }: { label: string; value: ReactNode; note?: string }) {
  return (
    <div>
      <p className="field-label">{label}</p>
      <p className="rounded-control border border-line bg-page px-3 py-2.5 text-sm text-ink">{value}</p>
      {note && <p className="mt-1 text-xs text-ink-muted">{note}</p>}
    </div>
  );
}
