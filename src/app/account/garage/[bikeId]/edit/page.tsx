import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { BikeEditForm } from '@/components/account/GarageForms';
import { ReadOnlyValue } from '@/components/forms/Field';
import { Breadcrumbs } from '@/components/ui/PageIntro';
import { bikeName, getMyBike } from '@/lib/account/garage';
import { requireCustomer } from '@/lib/auth/session';
import { bikeMaxYear } from '@/lib/auth/validation';
import { parseId } from '@/lib/params';

export const metadata: Metadata = { title: 'Edit bike' };

export default async function EditBikePage({ params }: { params: Promise<{ bikeId: string }> }) {
  const { bikeId: raw } = await params;
  const { customer } = await requireCustomer('/account/garage');
  const bikeId = parseId(raw);
  if (!bikeId) notFound();
  const bike = await getMyBike(customer.id, bikeId);
  if (!bike) notFound();

  return (
    <div className="space-y-6">
      <div>
        <Breadcrumbs items={[{ href: '/account/garage', label: 'My garage' }, { label: 'Edit bike' }]} />
        <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">Edit {bikeName(bike)}</h1>
        <p className="mt-1 text-ink-muted">
          You can change the registration number and year. To correct the model or VIN, please contact the dealership.
        </p>
      </div>
      <div className="card space-y-5 p-5 sm:p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <ReadOnlyValue label="Model" value={bikeName(bike)} />
          <ReadOnlyValue label="VIN" value={<span className="break-all">{bike.vin}</span>} />
        </div>
        <BikeEditForm bikeId={bike.id} registration={bike.registration} year={bike.year} maxYear={bikeMaxYear()} />
      </div>
    </div>
  );
}
