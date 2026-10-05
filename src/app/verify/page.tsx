import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthCard } from '@/components/account/AuthCard';
import { ResendCodeForm, VerifyForm } from '@/components/account/AuthForms';
import { Notice } from '@/components/forms/FormMessage';
import { safeNext } from '@/lib/auth/redirect';
import { emailSchema } from '@/lib/auth/validation';
import type { SearchParams } from '@/lib/params';

export const metadata: Metadata = {
  title: 'Confirm your email',
  robots: { index: false, follow: false },
};

export default async function VerifyPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const parsed = emailSchema.safeParse(typeof sp.email === 'string' ? sp.email : '');
  const email = parsed.success ? parsed.data : '';
  const next = safeNext(sp.next, '') || undefined;

  return (
    <AuthCard
      title="Confirm your email"
      description={
        email ? (
          <>Enter the 6-digit code sent to <strong className="text-ink">{email}</strong>.</>
        ) : (
          'Enter your email address and the 6-digit code from our email.'
        )
      }
      footer={
        <>
          Wrong address?{' '}
          <Link href="/register" className="link">
            Start again
          </Link>
        </>
      }
    >
      <div className="mb-4">
        {sp.unconfirmed === '1' ? (
          <Notice tone="warn">
            Your email address is not confirmed yet. Enter the code from our email, or request a new one below.
          </Notice>
        ) : (
          <Notice tone="info">
            If this email can be used, we sent you a code. It can take a minute to arrive; check your spam folder too.
          </Notice>
        )}
      </div>
      <VerifyForm email={email} next={next} />
      <div className="mt-4">
        <ResendCodeForm email={email} />
      </div>
    </AuthCard>
  );
}
