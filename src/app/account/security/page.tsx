import type { Metadata } from 'next';
import { ReadOnlyValue } from '@/components/forms/Field';
import { ChangePasswordForm } from '@/components/account/AuthForms';
import { Notice } from '@/components/forms/FormMessage';
import { requireUser } from '@/lib/auth/session';

export const metadata: Metadata = { title: 'Security' };

export default async function SecurityPage() {
  const user = await requireUser('/account/security');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Security</h1>
        <p className="mt-1 text-ink-muted">How you sign in to your account.</p>
      </div>
      <div className="card space-y-5 p-5 sm:p-6">
        <ReadOnlyValue label="Sign-in email" value={<span className="break-all">{user.email ?? 'Not available'}</span>} />
        {user.hasPassword ? (
          <section aria-labelledby="password-heading" className="space-y-4">
            <h2 id="password-heading" className="text-lg font-semibold">Change password</h2>
            <p className="text-sm text-ink-muted">Enter your current password first, then choose a new one.</p>
            <ChangePasswordForm />
          </section>
        ) : (
          <Notice tone="info">
            You sign in with Google, so this account has no password to change. Manage your Google sign-in in your
            Google account settings.
          </Notice>
        )}
      </div>
    </div>
  );
}
