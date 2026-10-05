import type { Metadata } from 'next';
import { ReadOnlyValue } from '@/components/forms/Field';
import { ProfileForm } from '@/components/account/ProfileForm';
import { requireCustomer } from '@/lib/auth/session';

export const metadata: Metadata = { title: 'Profile' };

export default async function ProfilePage() {
  const { customer } = await requireCustomer('/account/profile');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Profile</h1>
        <p className="mt-1 text-ink-muted">Keep your contact details up to date so we can reach you.</p>
      </div>
      <div className="card space-y-5 p-5 sm:p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <ReadOnlyValue label="Email" value={<span className="break-all">{customer.email}</span>} />
          <ReadOnlyValue label="NIC number" value={customer.nic} />
        </div>
        <p className="text-xs text-ink-muted">
          To change your email or NIC number, please contact the dealership.
        </p>
        <ProfileForm
          mode="update"
          initial={{
            firstName: customer.firstName,
            lastName: customer.lastName,
            phone: customer.phone,
            street: customer.street,
            town: customer.town,
            homeNumber: customer.homeNumber ?? '',
            postCode: customer.postCode ?? '',
          }}
        />
      </div>
    </div>
  );
}
