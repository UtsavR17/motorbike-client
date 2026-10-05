import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AuthCard } from '@/components/account/AuthCard';
import { RegisterForm } from '@/components/account/AuthForms';
import { GoogleButton } from '@/components/account/GoogleButton';
import { safeNext } from '@/lib/auth/redirect';
import { getCurrentUser } from '@/lib/auth/session';
import type { SearchParams } from '@/lib/params';

export const metadata: Metadata = {
  title: 'Create an account',
  description: 'Create a customer account to save your bikes and manage your details.',
};

export default async function RegisterPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const next = safeNext(sp.next, '') || undefined;
  if (await getCurrentUser()) redirect('/account');

  return (
    <AuthCard
      title="Create an account"
      description="We will email you a 6-digit code to confirm your address."
      footer={
        <>
          Already have an account?{' '}
          <Link href={next ? `/login?next=${encodeURIComponent(next)}` : '/login'} className="link">
            Sign in
          </Link>
        </>
      }
    >
      <RegisterForm next={next} />
      <GoogleButton next={next} />
    </AuthCard>
  );
}
