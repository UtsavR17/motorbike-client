import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AuthCard } from '@/components/account/AuthCard';
import { LoginForm } from '@/components/account/AuthForms';
import { GoogleButton } from '@/components/account/GoogleButton';
import { Notice } from '@/components/forms/FormMessage';
import { safeNext } from '@/lib/auth/redirect';
import { getCurrentUser } from '@/lib/auth/session';
import type { SearchParams } from '@/lib/params';

export const metadata: Metadata = {
  title: 'Sign in',
  description: 'Sign in to your account to manage your profile and garage.',
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const next = safeNext(sp.next, '') || undefined;
  if (await getCurrentUser()) redirect(next ?? '/account');

  const registerHref = next ? `/register?next=${encodeURIComponent(next)}` : '/register';
  return (
    <AuthCard
      title="Sign in"
      description="Welcome back. Sign in to manage your profile and your bikes."
      footer={
        <>
          New here?{' '}
          <Link href={registerHref} className="link">
            Create an account
          </Link>
        </>
      }
    >
      {sp.error === 'oauth' && (
        <div className="mb-4">
          <Notice tone="warn">Google sign-in did not complete. Please try again or use your email.</Notice>
        </div>
      )}
      <LoginForm next={next} />
      <GoogleButton next={next} />
    </AuthCard>
  );
}
