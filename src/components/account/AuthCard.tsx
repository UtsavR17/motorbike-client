import type { ReactNode } from 'react';

/** Centred card used by the sign-in, registration and password pages. */
export function AuthCard({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="container-page flex justify-center py-10 sm:py-14">
      <div className="w-full max-w-md">
        <div className="card p-6 sm:p-8">
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          {description && <div className="mt-2 text-sm text-ink-muted">{description}</div>}
          <div className="mt-6">{children}</div>
        </div>
        {footer && <div className="mt-4 text-center text-sm text-ink-muted">{footer}</div>}
      </div>
    </div>
  );
}
