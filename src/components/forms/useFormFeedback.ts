'use client';

import { useEffect, useRef } from 'react';
import type { FormState } from '@/lib/forms';

/**
 * After each submission, moves focus to the first field with an error, or to the
 * form message when there is no field error (or on success).
 */
export function useFormFeedback(state: FormState) {
  const formRef = useRef<HTMLFormElement>(null);
  const messageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!state.submittedAt) return;
    const errors = state.fieldErrors ?? {};
    if (state.status === 'error' && Object.keys(errors).length > 0 && formRef.current) {
      const first = Array.from(formRef.current.elements).find(
        (el): el is HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement =>
          (el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement) &&
          !el.disabled &&
          Boolean(errors[el.name]),
      );
      if (first) {
        first.focus();
        return;
      }
    }
    messageRef.current?.focus();
  }, [state]);

  return { formRef, messageRef };
}
