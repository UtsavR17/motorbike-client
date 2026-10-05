import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthCard } from '@/components/account/AuthCard';
import { ResetPasswordForm } from '@/components/account/AuthForms';
import { Notice } from '@/components/forms/FormMessage';
import { emailSchema } from '@/lib/auth/validation';
import type { SearchParams } from '@/lib/params';

export const metadata: Metadata = {
  title: 'Set a new password',
  robots: { index: false, follow: false },
};

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const parsed = emailSchema.safeParse(typeof sp.email === 'string' ? sp.email : '');
  const email = parsed.success ? parsed.data : '';

  return (
    <AuthCard
      title="Set a new password"
      description="Enter the 6-digit code from our email and choose a new password."
      footer={
        <>
          No code?{' '}
          <Link href="/forgot-password" className="link">
            Request a new one
          </Link>
        </>
      }
    >
      {sp.sent === '1' && (
        <div className="mb-4">
          <Notice tone="info">
            If an account exists for this email, we sent a code. It can take a minute to arrive; check your spam
            folder too.
          </Notice>
        </div>
      )}
      <ResetPasswordForm email={email} />
    </AuthCard>
  );
}
