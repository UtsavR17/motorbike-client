import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { ReadOnlyValue } from '@/components/forms/Field';
import { ProfileForm } from '@/components/account/ProfileForm';
import { getCustomerOrNull, requireUser } from '@/lib/auth/session';

export const metadata: Metadata = { title: 'Complete your profile' };

export default async function CompleteProfilePage() {
  const user = await requireUser('/account/profile/complete');
  if (await getCustomerOrNull()) redirect('/account/profile');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Complete your profile</h1>
        <p className="mt-1 max-w-2xl text-ink-muted">
          We need a few details to set up your customer account. If you have bought from or serviced with us before,
          use the same NIC number and email as in our records and we will link your existing customer record.
        </p>
      </div>
      <div className="card space-y-5 p-5 sm:p-6">
        <ReadOnlyValue
          label="Email"
          value={user.email ?? 'Not available'}
          note="Your profile uses the email you signed in with."
        />
        <ProfileForm mode="create" />
      </div>
    </div>
  );
}
