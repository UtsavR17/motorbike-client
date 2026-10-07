import type { Metadata } from 'next';
import Link from 'next/link';
import { Bike as BikeIcon, CalendarClock, Store } from 'lucide-react';
import { ReserveForm } from '@/components/reservation/ReserveForm';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageIntro } from '@/components/ui/PageIntro';
import { ProductImage } from '@/components/ui/ProductImage';
import { BIKE_DEPOSIT_PERCENT, RESERVATION_VALID_DAYS } from '@/config/shop';
import { requireCustomer } from '@/lib/auth/session';
import { getBikeForSale } from '@/lib/catalog/bikes';
import { bikeIdSchema } from '@/lib/checkout/validation';
import { addDaysMauritius, balanceFor, depositFor } from '@/lib/commerce/reservation';
import { formatDate, formatMoney, formatWarranty } from '@/lib/format';
import { modelLabel } from '@/lib/labels';

export const metadata: Metadata = {
  title: 'Reserve a motorcycle',
  robots: { index: false, follow: false },
};

const CRUMBS = [
  { href: '/', label: 'Home' },
  { href: '/bikes', label: 'Motorcycles' },
  { label: 'Reserve' },
];

function Unavailable() {
  return (
    <>
      <PageIntro title="Reserve a motorcycle" crumbs={CRUMBS} />
      <div className="container-page py-8">
        <EmptyState
          icon={BikeIcon}
          title="This motorcycle is no longer available"
          action={
            <Link href="/bikes" className="btn-primary h-11">
              Browse motorcycles
            </Link>
          }
        >
          It has just been reserved or sold. Other units and models are waiting for you in the catalogue.
        </EmptyState>
      </div>
    </>
  );
}

export default async function ReservePage({ params }: { params: Promise<{ bikeId: string }> }) {
  const { bikeId: raw } = await params;
  const id = bikeIdSchema.safeParse(raw);
  await requireCustomer(id.success ? `/reserve/${id.data}` : '/bikes');
  if (!id.success) return <Unavailable />;

  // catalog_bikes only lists units that are for sale; it has no VIN column.
  const bike = await getBikeForSale(id.data);
  if (!bike) return <Unavailable />;

  const name = modelLabel(bike.brand, bike.model);
  const deposit = depositFor(bike.price);
  const balance = balanceFor(bike.price, deposit);
  const visitBy = formatDate(addDaysMauritius(new Date(), RESERVATION_VALID_DAYS));

  const specs = [
    { label: 'Year', value: bike.year ? String(bike.year) : null },
    { label: 'Colour', value: bike.color },
    { label: 'Engine', value: bike.engine_cc ? `${bike.engine_cc} cc` : null },
    { label: 'Fuel', value: bike.fuel_type },
    { label: 'Transmission', value: bike.transmission },
    { label: 'Warranty', value: formatWarranty(bike.warranty_months) },
  ].filter((s): s is { label: string; value: string } => Boolean(s.value));

  return (
    <>
      <PageIntro
        title="Reserve a motorcycle"
        description="Pay a deposit online to hold this motorcycle for you, then complete the purchase at the dealership."
        crumbs={[
          { href: '/', label: 'Home' },
          { href: '/bikes', label: 'Motorcycles' },
          { href: `/bikes/${bike.model_id}`, label: name },
          { label: 'Reserve' },
        ]}
      />
      <div className="container-page grid gap-6 py-6 lg:grid-cols-[1fr_380px] lg:items-start lg:py-8">
        <div className="space-y-6">
          <section aria-labelledby="bike-heading" className="card overflow-hidden sm:flex">
            <div className="relative aspect-[4/3] sm:w-2/5 sm:shrink-0">
              <ProductImage src={bike.image_url} alt={name} kind="bike" sizes="(min-width: 640px) 40vw, 100vw" preload />
            </div>
            <div className="p-5">
              <p className="text-sm font-medium uppercase tracking-wide text-ink-muted">{bike.brand}</p>
              <h2 id="bike-heading" className="text-xl font-bold">{name}</h2>
              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                {specs.map((s) => (
                  <div key={s.label}>
                    <dt className="text-ink-muted">{s.label}</dt>
                    <dd className="font-semibold">{s.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </section>

          <section aria-labelledby="how-heading" className="card space-y-3 p-5 text-sm">
            <h2 id="how-heading" className="text-lg font-semibold">How the reservation works</h2>
            <ul className="list-disc space-y-1.5 pl-5 text-ink-muted">
              <li>
                You pay a deposit of {BIKE_DEPOSIT_PERCENT}% of the price now, by card. The full price is never charged
                online.
              </li>
              <li>The motorcycle is taken off sale and held for you as soon as the deposit is paid.</li>
              <li>
                Visit the dealership within {RESERVATION_VALID_DAYS} days to pay the balance, complete the paperwork and
                collect the motorcycle. Bring your Order ID and ID card.
              </li>
              <li>Motorcycles are not delivered: collection is at the dealership only.</li>
            </ul>
            <p className="font-medium">For cancellations, please contact the dealership.</p>
          </section>
        </div>

        <aside aria-labelledby="deposit-heading" className="card space-y-4 p-5 lg:sticky lg:top-32">
          <h2 id="deposit-heading" className="text-lg font-semibold">Your reservation</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-ink-muted">Motorcycle price</dt>
              <dd className="shrink-0 whitespace-nowrap font-semibold">{formatMoney(bike.price)}</dd>
            </div>
            <div className="flex justify-between gap-3 border-t border-line pt-2 text-base">
              <dt className="font-semibold">Deposit to pay now ({BIKE_DEPOSIT_PERCENT}%)</dt>
              <dd className="shrink-0 whitespace-nowrap font-bold">{formatMoney(deposit)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-ink-muted">Balance at the dealership</dt>
              <dd className="shrink-0 whitespace-nowrap font-semibold">{formatMoney(balance)}</dd>
            </div>
          </dl>
          <p className="flex gap-2 rounded-control bg-page px-3 py-2.5 text-sm">
            <CalendarClock aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-accent-strong" />
            <span>
              Your reservation is valid for {RESERVATION_VALID_DAYS} days: visit the dealership by{' '}
              <strong>{visitBy}</strong>.
            </span>
          </p>
          <p className="flex gap-2 text-sm text-ink-muted">
            <Store aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-accent-strong" />
            <span>Collect from the dealership. No delivery for motorcycles.</span>
          </p>
          <ReserveForm bikeId={id.data} depositText={formatMoney(deposit)} />
          <Link href={`/bikes/${bike.model_id}`} className="link block text-center text-sm">
            Back to the {name}
          </Link>
        </aside>
      </div>
    </>
  );
}
