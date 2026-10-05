import { CheckCircle2, TriangleAlert } from 'lucide-react';
import type { ReactNode, Ref } from 'react';
import type { FormState } from '@/lib/forms';

/** Form-level message. Focusable so screen-reader and keyboard users land on it. */
export function FormMessage({ state, ref }: { state: FormState; ref?: Ref<HTMLDivElement> }) {
  if (!state.message || state.status === 'idle') return null;
  const isError = state.status === 'error';
  const Icon = isError ? TriangleAlert : CheckCircle2;
  return (
    <div
      ref={ref}
      tabIndex={-1}
      role={isError ? 'alert' : 'status'}
      className={`flex gap-2 rounded-control px-3 py-2.5 text-sm font-medium ${
        isError ? 'bg-bad-soft text-bad' : 'bg-ok-soft text-ok'
      }`}
    >
      <Icon aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{state.message}</span>
    </div>
  );
}

/** Static banner (for example a notice passed in the URL). */
export function Notice({ tone = 'success', children }: { tone?: 'success' | 'info' | 'warn'; children: ReactNode }) {
  const styles = {
    success: 'bg-ok-soft text-ok',
    info: 'bg-accent-soft text-ink',
    warn: 'bg-warn-soft text-warn',
  }[tone];
  return (
    <div role="status" className={`rounded-control px-4 py-3 text-sm font-medium ${styles}`}>
      {children}
    </div>
  );
}
