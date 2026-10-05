'use client';

import type { ReactNode } from 'react';
import { useFormStatus } from 'react-dom';

interface SubmitButtonProps {
  children: ReactNode;
  pendingLabel?: string;
  variant?: 'primary' | 'dark' | 'outline';
  className?: string;
}

/** Submit button that disables itself while its form's Server Action runs. */
export function SubmitButton({ children, pendingLabel, variant = 'primary', className = '' }: SubmitButtonProps) {
  const { pending } = useFormStatus();
  const base = { primary: 'btn-primary', dark: 'btn-dark', outline: 'btn-outline' }[variant];
  return (
    <button type="submit" disabled={pending} aria-disabled={pending} className={`${base} h-11 ${className}`}>
      {pending ? (pendingLabel ?? 'Please wait...') : children}
    </button>
  );
}
