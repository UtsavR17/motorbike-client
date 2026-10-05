import type { Metadata } from 'next';
import { BikeAddForm } from '@/components/account/GarageForms';
import { Breadcrumbs } from '@/components/ui/PageIntro';
import { requireCustomer } from '@/lib/auth/session';
import { getModels } from '@/lib/catalog/lookups';
import { bikeMaxYear } from '@/lib/auth/validation';

export const metadata: Metadata = { title: 'Add a bike' };

export default async function NewBikePage() {
  await requireCustomer('/account/garage/new');
  const models = await getModels();

  return (
    <div className="space-y-6">
      <div>
        <Breadcrumbs items={[{ href: '/account/garage', label: 'My garage' }, { label: 'Add a bike' }]} />
        <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">Add a bike</h1>
        <p className="mt-1 text-ink-muted">
          You will find the registration number and VIN on your registration documents.
        </p>
      </div>
      <div className="card p-5 sm:p-6">
        <BikeAddForm models={models} maxYear={bikeMaxYear()} />
      </div>
    </div>
  );
}
