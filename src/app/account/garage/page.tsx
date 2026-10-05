import type { Metadata } from 'next';
import Link from 'next/link';
import { Bike, Pencil, Plus, Search } from 'lucide-react';
import { DeleteBikeButton } from '@/components/account/GarageForms';
import { Notice } from '@/components/forms/FormMessage';
import { EmptyState } from '@/components/ui/EmptyState';
import { bikeName, listMyBikes } from '@/lib/account/garage';
import { noticeText } from '@/lib/account/notices';
import { requireCustomer } from '@/lib/auth/session';
import type { SearchParams } from '@/lib/params';

export const metadata: Metadata = { title: 'My garage' };

function shopHref(modelId: number, year: number | null): string {
  const p = new URLSearchParams({ model: String(modelId) });
  if (year) p.set('year', String(year));
  return `/parts?${p.toString()}`;
}

export default async function GaragePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { customer } = await requireCustomer('/account/garage');
  const bikes = await listMyBikes(customer.id);
  const notice = noticeText((await searchParams).notice);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">My garage</h1>
          <p className="mt-1 text-ink-muted">Save your bikes to find parts that fit them faster.</p>
        </div>
        {bikes.length > 0 && (
          <Link href="/account/garage/new" className="btn-primary h-11">
            <Plus aria-hidden="true" className="h-4 w-4" />
            Add a bike
          </Link>
        )}
      </div>

      {notice && <Notice>{notice}</Notice>}

      {bikes.length === 0 ? (
        <EmptyState
          icon={Bike}
          title="Your garage is empty"
          action={
            <Link href="/account/garage/new" className="btn-primary h-11">
              <Plus aria-hidden="true" className="h-4 w-4" />
              Add your first bike
            </Link>
          }
        >
          Add your motorcycle to see parts that fit it with one click.
        </EmptyState>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {bikes.map((bike) => {
            const name = bikeName(bike);
            return (
              <li key={bike.id} className="card flex flex-col p-5">
                <div className="flex items-start gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-control bg-accent-soft text-accent-strong">
                    <Bike aria-hidden="true" className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    {bike.brand && (
                      <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">{bike.brand}</p>
                    )}
                    <h2 className="text-lg font-semibold leading-snug">{bike.model ?? 'Unknown model'}</h2>
                  </div>
                </div>
                <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
                  <dt className="text-ink-muted">Year</dt>
                  <dd className="font-medium">{bike.year ?? 'Not set'}</dd>
                  <dt className="text-ink-muted">Registration</dt>
                  <dd className="font-medium">{bike.registration}</dd>
                  <dt className="text-ink-muted">VIN</dt>
                  <dd className="font-medium break-all">{bike.vin}</dd>
                </dl>
                <div className="mt-5 flex flex-wrap items-start gap-2">
                  <Link href={shopHref(bike.modelId, bike.year)} className="btn-dark h-10">
                    <Search aria-hidden="true" className="h-4 w-4" />
                    Shop parts for this bike
                  </Link>
                  <Link href={`/account/garage/${bike.id}/edit`} className="btn-outline h-10">
                    <Pencil aria-hidden="true" className="h-4 w-4" />
                    Edit<span className="sr-only"> {name}</span>
                  </Link>
                  <DeleteBikeButton bikeId={bike.id} name={name} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
