import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Bike } from 'lucide-react';
import { ActiveFilters, type FilterChip } from '@/components/catalog/ActiveFilters';
import { BikeModelCard } from '@/components/catalog/BikeModelCard';
import { FilterPanel } from '@/components/catalog/FilterPanel';
import { PriceFields } from '@/components/catalog/PriceFields';
import { SortLinks } from '@/components/catalog/SortLinks';
import { CleanGetForm } from '@/components/ui/CleanGetForm';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageIntro } from '@/components/ui/PageIntro';
import { Pagination, ResultCount } from '@/components/ui/Pagination';
import { PAGE_SIZE } from '@/config/shop';
import { getBikeFacets, listBikeModels } from '@/lib/catalog/bikes';
import { formatMoney } from '@/lib/format';
import {
  BIKE_SORT_LABELS,
  MAX_SEARCH_LENGTH,
  bikesHref,
  parseBikesQuery,
  type BikesQuery,
  type SearchParams,
} from '@/lib/params';

export const metadata: Metadata = {
  title: 'Motorcycles',
  description: 'New motorcycles available at the dealership. Compare models, specifications and prices.',
};

export default async function BikesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const facets = await getBikeFacets();
  const parsed = parseBikesQuery(await searchParams, facets);
  const brand = facets.brands.find((b) => b.brand_id === parsed.brand);
  const query: BikesQuery = { ...parsed, brand: brand?.brand_id };

  const result = await listBikeModels(query);
  if (result.outOfRange) redirect(bikesHref(query, { page: result.pageCount }));

  const reset = { page: 1 };
  const chips: FilterChip[] = [];
  if (query.q) chips.push({ key: 'q', label: `Search: "${query.q}"`, removeHref: bikesHref(query, { ...reset, q: undefined }) });
  if (brand) chips.push({ key: 'brand', label: brand.brand, removeHref: bikesHref(query, { ...reset, brand: undefined }) });
  if (query.fuel) chips.push({ key: 'fuel', label: query.fuel, removeHref: bikesHref(query, { ...reset, fuel: undefined }) });
  if (query.transmission)
    chips.push({ key: 'transmission', label: query.transmission, removeHref: bikesHref(query, { ...reset, transmission: undefined }) });
  if (query.min !== undefined) chips.push({ key: 'min', label: `Min ${formatMoney(query.min)}`, removeHref: bikesHref(query, { ...reset, min: undefined }) });
  if (query.max !== undefined) chips.push({ key: 'max', label: `Max ${formatMoney(query.max)}`, removeHref: bikesHref(query, { ...reset, max: undefined }) });

  return (
    <>
      <PageIntro
        title="Motorcycles"
        description="New motorcycles in stock at the dealership. Reserve online with a deposit soon, then collect in store."
        crumbs={[{ href: '/', label: 'Home' }, { label: 'Motorcycles' }]}
      />

      <div className="container-page grid gap-6 py-6 lg:grid-cols-[260px_1fr] lg:gap-8 lg:py-8">
        <aside aria-label="Filters">
          <FilterPanel activeCount={chips.length}>
            <CleanGetForm key={bikesHref(query)} action="/bikes" aria-label="Filter motorcycles" className="card space-y-5 p-4">
              <div>
                <label htmlFor="filter-q" className="field-label">
                  Search
                </label>
                <input
                  id="filter-q"
                  name="q"
                  type="search"
                  maxLength={MAX_SEARCH_LENGTH}
                  defaultValue={query.q ?? ''}
                  placeholder="Model name"
                  className="field"
                />
              </div>

              <div>
                <label htmlFor="filter-brand" className="field-label">
                  Brand
                </label>
                <select id="filter-brand" name="brand" defaultValue={query.brand ?? ''} className="field">
                  <option value="">All brands</option>
                  {facets.brands.map((b) => (
                    <option key={b.brand_id} value={b.brand_id}>
                      {b.brand}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="filter-fuel" className="field-label">
                  Fuel type
                </label>
                <select id="filter-fuel" name="fuel" defaultValue={query.fuel ?? ''} className="field">
                  <option value="">Any fuel</option>
                  {facets.fuelTypes.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="filter-transmission" className="field-label">
                  Transmission
                </label>
                <select
                  id="filter-transmission"
                  name="transmission"
                  defaultValue={query.transmission ?? ''}
                  className="field"
                >
                  <option value="">Any transmission</option>
                  {facets.transmissions.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <PriceFields min={query.min} max={query.max} />

              {query.sort !== 'price_asc' && <input type="hidden" name="sort" value={query.sort} />}

              <div className="flex flex-col gap-2">
                <button type="submit" className="btn-dark w-full">
                  Apply filters
                </button>
                {chips.length > 0 && (
                  <Link href="/bikes" className="btn-outline w-full">
                    Clear filters
                  </Link>
                )}
              </div>
            </CleanGetForm>
          </FilterPanel>
        </aside>

        <section aria-labelledby="results-heading" className="min-w-0 space-y-4">
          <h2 id="results-heading" className="sr-only">
            Results
          </h2>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <ResultCount page={result.page} pageSize={PAGE_SIZE} total={result.total} />
            <SortLinks
              current={query.sort}
              options={BIKE_SORT_LABELS}
              hrefFor={(sort) => bikesHref(query, { sort, page: 1 })}
            />
          </div>

          <ActiveFilters chips={chips} clearHref="/bikes" />

          {result.items.length === 0 ? (
            <EmptyState
              icon={Bike}
              title={chips.length > 0 ? 'No motorcycles match your filters' : 'No motorcycles in stock right now'}
              action={
                chips.length > 0 ? (
                  <Link href="/bikes" className="btn-dark">
                    Clear filters
                  </Link>
                ) : undefined
              }
            >
              {chips.length > 0
                ? 'Try another brand, fuel type or a wider price range.'
                : 'New stock arrives regularly. Please check back soon.'}
            </EmptyState>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {result.items.map((model) => (
                <li key={model.model_id}>
                  <BikeModelCard model={model} />
                </li>
              ))}
            </ul>
          )}

          <Pagination page={result.page} pageCount={result.pageCount} hrefFor={(page) => bikesHref(query, { page })} />
        </section>
      </div>
    </>
  );
}
