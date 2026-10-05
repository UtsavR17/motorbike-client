import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthCard } from '@/components/account/AuthCard';
import { ForgotPasswordForm } from '@/components/account/AuthForms';

export const metadata: Metadata = {
  title: 'Forgot password',
  description: 'Reset your password with a code sent to your email.',
};

export default function ForgotPasswordPage() {
  return (
    <AuthCard
      title="Forgot your password?"
      description="Enter your email address. If it belongs to an account, we will send you a 6-digit code to set a new password."
      footer={
        <>
          Remembered it?{' '}
          <Link href="/login" className="link">
            Back to sign in
          </Link>
        </>
      }
    >
      <ForgotPasswordForm />
    </AuthCard>
  );
}
