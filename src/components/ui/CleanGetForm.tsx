'use client';

import { useRouter } from 'next/navigation';
import type { FormEvent, ReactNode } from 'react';

interface CleanGetFormProps {
  action: string;
  children: ReactNode;
  className?: string;
  'aria-label'?: string;
  role?: string;
  onNavigate?: () => void;
}

/**
 * A plain GET form that works without JavaScript. With JavaScript it drops empty
 * fields so URLs stay short and shareable, then navigates client-side.
 */
export function CleanGetForm({ action, children, className, onNavigate, ...rest }: CleanGetFormProps) {
  const router = useRouter();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const params = new URLSearchParams();
    for (const [name, value] of new FormData(event.currentTarget)) {
      if (typeof value === 'string' && value.trim() !== '') params.append(name, value.trim());
    }
    const qs = params.toString();
    onNavigate?.();
    router.push(qs ? `${action}?${qs}` : action);
  }

  return (
    <form action={action} method="get" onSubmit={handleSubmit} className={className} {...rest}>
      {children}
    </form>
  );
}
