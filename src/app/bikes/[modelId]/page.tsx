import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Bike as BikeIcon, CalendarClock, Store } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import { Breadcrumbs } from '@/components/ui/PageIntro';
import { ProductImage } from '@/components/ui/ProductImage';
import { BIKE_DEPOSIT_PERCENT } from '@/config/shop';
import { getBikeModel, listBikesForModel } from '@/lib/catalog/bikes';
import { getModel } from '@/lib/catalog/lookups';
import {
  depositFor,
  formatMoney,
  formatPriceRange,
  formatRange,
  formatWarranty,
  joinList,
  pluralize,
} from '@/lib/format';
import { modelLabel } from '@/lib/labels';
import { parseId } from '@/lib/params';
import type { Bike } from '@/types/catalog';

interface BikePageProps {
  params: Promise<{ modelId: string }>;
}

/** Model summary (with units) or the bare model (none for sale); null means 404. */
async function loadModel(modelIdParam: string) {
  const modelId = parseId(modelIdParam);
  if (!modelId) return null;
  const summary = await getBikeModel(modelId);
  if (summary) return { modelId, summary, base: summary };
  const base = await getModel(modelId);
  return base ? { modelId, summary: null, base } : null;
}

export async function generateMetadata({ params }: BikePageProps): Promise<Metadata> {
  const loaded = await loadModel((await params).modelId);
  if (!loaded) return { title: 'Motorcycle not found' };
  const name = modelLabel(loaded.base.brand, loaded.base.model);
  return {
    title: name,
    description: loaded.summary
      ? `${name}: ${pluralize(loaded.summary.units_available, 'unit')} available, ${formatPriceRange(loaded.summary.min_price, loaded.summary.max_price)}.`
      : `${name}: no units available right now.`,
  };
}

function tank(capacity: number | null): string {
  return capacity === null ? 'Not listed' : `${capacity} L`;
}

function depositText(price: number): string {
  return `Reserve online with a deposit of ${formatMoney(depositFor(price))} (${BIKE_DEPOSIT_PERCENT}%). Pay the balance at the dealership.`;
}

function ReserveButton({ unit, describedBy }: { unit: Bike; describedBy: string }) {
  return (
    <div>
      <button type="button" disabled className="btn-primary w-full" aria-describedby={describedBy}>
        <CalendarClock aria-hidden="true" className="h-4 w-4" />
        Reserve with deposit
      </button>
      <p id={describedBy} className="mt-1.5 text-xs text-ink-muted">
        {depositText(unit.price)} Online reservations open soon.
      </p>
    </div>
  );
}

export default async function BikeDetailPage({ params }: BikePageProps) {
  const loaded = await loadModel((await params).modelId);
  if (!loaded) notFound();
  const { modelId, summary, base } = loaded;
  const units = summary ? await listBikesForModel(modelId) : [];
  const name = modelLabel(base.brand, base.model);

  const specs = summary
    ? [
        { label: 'Price', value: formatPriceRange(summary.min_price, summary.max_price) },
        { label: 'Units available', value: String(summary.units_available) },
        { label: 'Model year', value: formatRange(summary.min_year, summary.max_year) },
        { label: 'Engine', value: formatRange(summary.min_engine_cc, summary.max_engine_cc, 'cc') },
        { label: 'Fuel', value: joinList(summary.fuel_types) || null },
        { label: 'Transmission', value: joinList(summary.transmissions) || null },
        { label: 'Colours', value: joinList(summary.colors) || null },
      ].filter((s): s is { label: string; value: string } => Boolean(s.value))
    : [];

  return (
    <div className="container-page py-6 lg:py-8">
      <Breadcrumbs items={[{ href: '/', label: 'Home' }, { href: '/bikes', label: 'Motorcycles' }, { label: name }]} />

      <div className="mt-4 grid gap-6 lg:grid-cols-2 lg:gap-10">
        <div className="card relative aspect-[4/3] overflow-hidden">
          <ProductImage src={base.image_url} alt={name} kind="bike" sizes="(min-width: 1024px) 50vw, 100vw" preload />
        </div>

        <div className="space-y-5">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-ink-muted">{base.brand}</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">{base.model}</h1>
            {summary && (
              <p className="mt-3 text-3xl font-bold">{formatPriceRange(summary.min_price, summary.max_price)}</p>
            )}
          </div>

          {specs.length > 0 && (
            <dl className="card grid grid-cols-1 gap-px overflow-hidden bg-line sm:grid-cols-2">
              {specs.map((s) => (
                <div key={s.label} className="bg-card p-4">
                  <dt className="text-sm text-ink-muted">{s.label}</dt>
                  <dd className="mt-1 font-semibold">{s.value}</dd>
                </div>
              ))}
            </dl>
          )}

          <section aria-labelledby="collection-heading" className="card flex gap-3 p-4">
            <Store aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-accent-strong" />
            <div className="text-sm">
              <h2 id="collection-heading" className="font-semibold">
                Collection at the dealership
              </h2>
              <p className="mt-1 text-ink-muted">
                Motorcycles are not delivered. Collect yours at the dealership, where we complete the paperwork,
                registration and a handover check with you.
              </p>
            </div>
          </section>
        </div>
      </div>

      <section aria-labelledby="units-heading" className="mt-10">
        <h2 id="units-heading" className="text-xl font-bold">
          Available units
        </h2>

        {units.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              icon={BikeIcon}
              title="No units available right now"
              action={
                <Link href="/bikes" className="btn-dark">
                  Browse motorcycles
                </Link>
              }
            >
              The {name} is sold out at the moment. New stock arrives regularly.
            </EmptyState>
          </div>
        ) : (
          <>
            <p className="mt-1 text-sm text-ink-muted">
              {pluralize(units.length, 'unit')} in stock. Each unit is a specific motorcycle at the dealership.
            </p>

            {/* Large screens: table */}
            <div className="card mt-4 hidden overflow-hidden lg:block">
              <table className="w-full text-left text-sm">
                <caption className="sr-only">Available units of the {name}</caption>
                <thead className="bg-page text-ink-muted">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-medium">Colour</th>
                    <th scope="col" className="px-4 py-3 font-medium">Year</th>
                    <th scope="col" className="px-4 py-3 font-medium">Engine</th>
                    <th scope="col" className="px-4 py-3 font-medium">Fuel</th>
                    <th scope="col" className="px-4 py-3 font-medium">Transmission</th>
                    <th scope="col" className="px-4 py-3 font-medium">Tank</th>
                    <th scope="col" className="px-4 py-3 font-medium">Warranty</th>
                    <th scope="col" className="px-4 py-3 font-medium">Price</th>
                    <th scope="col" className="w-64 px-4 py-3 font-medium">
                      <span className="sr-only">Reserve</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {units.map((u, i) => (
                    <tr key={u.bike_id} className="align-top">
                      <td className="px-4 py-4 font-medium">{u.color ?? 'Not listed'}</td>
                      <td className="px-4 py-4">{u.year ?? 'Not listed'}</td>
                      <td className="px-4 py-4">{u.engine_cc ? `${u.engine_cc} cc` : 'Not listed'}</td>
                      <td className="px-4 py-4">{u.fuel_type ?? 'Not listed'}</td>
                      <td className="px-4 py-4">{u.transmission ?? 'Not listed'}</td>
                      <td className="px-4 py-4">{tank(u.fuel_tank_capacity)}</td>
                      <td className="px-4 py-4">{formatWarranty(u.warranty_months)}</td>
                      <td className="px-4 py-4 font-bold">{formatMoney(u.price)}</td>
                      <td className="px-4 py-4">
                        <ReserveButton unit={u} describedBy={`deposit-table-${i}`} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Small screens: one card per unit */}
            <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:hidden">
              {units.map((u, i) => (
                <li key={u.bike_id} className="card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-semibold">
                      {u.color ?? 'Colour not listed'}
                      {u.year ? `, ${u.year}` : ''}
                    </p>
                    <p className="text-lg font-bold">{formatMoney(u.price)}</p>
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    <dt className="text-ink-muted">Engine</dt>
                    <dd>{u.engine_cc ? `${u.engine_cc} cc` : 'Not listed'}</dd>
                    <dt className="text-ink-muted">Fuel</dt>
                    <dd>{u.fuel_type ?? 'Not listed'}</dd>
                    <dt className="text-ink-muted">Transmission</dt>
                    <dd>{u.transmission ?? 'Not listed'}</dd>
                    <dt className="text-ink-muted">Tank</dt>
                    <dd>{tank(u.fuel_tank_capacity)}</dd>
                    <dt className="text-ink-muted">Warranty</dt>
                    <dd>{formatWarranty(u.warranty_months)}</dd>
                  </dl>
                  <div className="mt-4">
                    <ReserveButton unit={u} describedBy={`deposit-card-${i}`} />
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}
