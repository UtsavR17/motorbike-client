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
import { emptyListing, resultsHeadline } from '@/lib/catalog/search-page';
import { formatMoney } from '@/lib/format';
import {
  BIKE_SORT_LABELS,
  BIKES_FORM_FIELDS,
  MAX_SEARCH_LENGTH,
  bikesLinks,
  bikesWithoutFilters,
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

  // Every link and the form's hidden fields come from one helper (Fix Phase 6).
  const links = bikesLinks(query);
  const result = await listBikeModels(query);
  if (result.outOfRange) redirect(links.page(result.pageCount));
  // Only for an empty filtered page: would the same search find models without the filters?
  const unfilteredTotal =
    result.total === 0 && links.hasFilters ? (await listBikeModels(bikesWithoutFilters(query), 1)).total : 0;
  const empty = emptyListing('motorcycles', query.q, links.hasFilters, unfilteredTotal);
  const headline = resultsHeadline(result.total, query.q);

  const chips: FilterChip[] = [];
  if (query.q) chips.push({ key: 'q', label: `Search: "${query.q}"`, removeHref: links.remove('q') });
  if (brand) chips.push({ key: 'brand', label: brand.brand, removeHref: links.remove('brand') });
  if (query.fuel) chips.push({ key: 'fuel', label: query.fuel, removeHref: links.remove('fuel') });
  if (query.transmission)
    chips.push({ key: 'transmission', label: query.transmission, removeHref: links.remove('transmission') });
  if (query.min !== undefined) chips.push({ key: 'min', label: `Min ${formatMoney(query.min)}`, removeHref: links.remove('min') });
  if (query.max !== undefined) chips.push({ key: 'max', label: `Max ${formatMoney(query.max)}`, removeHref: links.remove('max') });

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
            <CleanGetForm key={links.self} action="/bikes" aria-label="Filter motorcycles" className="card space-y-5 p-4">
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

              {/* Every other parameter (sort) travels along; the page resets to 1. */}
              {links.hiddenFields(BIKES_FORM_FIELDS).map(([name, value]) => (
                <input key={name} type="hidden" name={name} value={value} />
              ))}

              <div className="flex flex-col gap-2">
                <button type="submit" className="btn-dark w-full">
                  Apply filters
                </button>
                {links.hasFilters && (
                  <Link href={links.clearFilters} className="btn-outline w-full">
                    Clear filters
                  </Link>
                )}
                {query.q && (
                  <Link href={links.clearSearch} className="btn-outline w-full">
                    Clear search
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
            <div>
              {headline && <p className="font-semibold">{headline}</p>}
              <ResultCount page={result.page} pageSize={PAGE_SIZE} total={result.total} />
            </div>
            <SortLinks
              current={query.sort}
              options={BIKE_SORT_LABELS}
              hrefFor={links.sort}
            />
          </div>

          <ActiveFilters
            chips={chips}
            clearFiltersHref={links.hasFilters ? links.clearFilters : null}
            clearSearchHref={query.q ? links.clearSearch : null}
          />

          {result.items.length === 0 ? (
            chips.length === 0 ? (
              <EmptyState icon={Bike} title="No motorcycles in stock right now">
                New stock arrives regularly. Please check back soon.
              </EmptyState>
            ) : (
              <EmptyState
                icon={Bike}
                title={empty.title}
                action={
                  empty.action && (
                    <Link href={empty.action === 'clearFilters' ? links.clearFilters : links.clearSearch} className="btn-dark">
                      {empty.action === 'clearFilters' ? 'Clear filters' : 'Clear search'}
                    </Link>
                  )
                }
              >
                {empty.body}
              </EmptyState>
            )
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {result.items.map((model) => (
                <li key={model.model_id}>
                  <BikeModelCard model={model} />
                </li>
              ))}
            </ul>
          )}

          <Pagination page={result.page} pageCount={result.pageCount} hrefFor={links.page} />
        </section>
      </div>
    </>
  );
}
