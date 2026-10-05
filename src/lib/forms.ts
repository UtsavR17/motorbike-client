import type { FieldErrors } from '@/lib/auth/validation';

/** Result returned by every form Server Action (used with useActionState). */
export interface FormState {
  status: 'idle' | 'error' | 'success';
  message?: string;
  fieldErrors?: FieldErrors;
  /** Non-secret values echoed back so fields keep what the user typed. Never passwords or codes. */
  values?: Record<string, string>;
  /** Changes on every submission so the form can re-focus the first error. */
  submittedAt?: number;
}

export const initialFormState: FormState = { status: 'idle' };

export function errorState(
  values: Record<string, string> | undefined,
  mapped: { message?: string; fieldErrors?: FieldErrors },
): FormState {
  const hasFields = mapped.fieldErrors && Object.keys(mapped.fieldErrors).length > 0;
  return {
    status: 'error',
    message: mapped.message ?? (hasFields ? 'Please check the highlighted fields.' : undefined),
    fieldErrors: mapped.fieldErrors,
    values,
    submittedAt: Date.now(),
  };
}

export function successState(message: string, values?: Record<string, string>): FormState {
  return { status: 'success', message, values, submittedAt: Date.now() };
}
