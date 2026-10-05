import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Bike, PackageSearch, Warehouse } from 'lucide-react';
import { ActiveFilters, type FilterChip } from '@/components/catalog/ActiveFilters';
import { FilterPanel } from '@/components/catalog/FilterPanel';
import { PartCard } from '@/components/catalog/PartCard';
import { PriceFields } from '@/components/catalog/PriceFields';
import { SortLinks } from '@/components/catalog/SortLinks';
import { CleanGetForm } from '@/components/ui/CleanGetForm';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageIntro } from '@/components/ui/PageIntro';
import { Pagination, ResultCount } from '@/components/ui/Pagination';
import { PAGE_SIZE } from '@/config/shop';
import { getGarageChips } from '@/lib/account/garage';
import { getBrands, getCategories, getModels } from '@/lib/catalog/lookups';
import { listPartProducts } from '@/lib/catalog/parts';
import { formatMoney } from '@/lib/format';
import { modelLabel } from '@/lib/labels';
import {
  MAX_SEARCH_LENGTH,
  PART_SORT_LABELS,
  parsePartsQuery,
  partsHref,
  type PartsQuery,
  type SearchParams,
} from '@/lib/params';

export const metadata: Metadata = {
  title: 'Spare parts',
  description: 'Genuine motorcycle spare parts with live stock levels. Filter by category, brand, price or your bike.',
};

export default async function PartsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const parsed = parsePartsQuery(await searchParams);
  const [categories, brands, models, garage] = await Promise.all([
    getCategories(),
    getBrands(),
    parsed.model ? getModels() : Promise.resolve([]),
    getGarageChips(),
  ]);

  // Ids that do not match a known category, brand or model are ignored.
  const category = categories.find((c) => c.category_id === parsed.category);
  const brand = brands.find((b) => b.brand_id === parsed.brand);
  const model = models.find((m) => m.model_id === parsed.model);
  const query: PartsQuery = {
    ...parsed,
    category: category?.category_id,
    brand: brand?.brand_id,
    model: model?.model_id,
    year: model ? parsed.year : undefined,
  };

  const result = await listPartProducts(query);
  if (result.outOfRange) redirect(partsHref(query, { page: result.pageCount }));

  const reset = { page: 1 };
  const fitsLabel = model
    ? `Fits: ${modelLabel(model.brand, model.model)}${query.year ? ` (${query.year})` : ''}`
    : null;
  const chips: FilterChip[] = [];
  if (fitsLabel)
    chips.push({ key: 'model', label: fitsLabel, removeHref: partsHref(query, { ...reset, model: undefined, year: undefined }) });
  if (query.q) chips.push({ key: 'q', label: `Search: "${query.q}"`, removeHref: partsHref(query, { ...reset, q: undefined }) });
  if (category) chips.push({ key: 'category', label: category.category, removeHref: partsHref(query, { ...reset, category: undefined }) });
  if (brand) chips.push({ key: 'brand', label: brand.brand, removeHref: partsHref(query, { ...reset, brand: undefined }) });
  if (query.inStock) chips.push({ key: 'stock', label: 'In stock only', removeHref: partsHref(query, { ...reset, inStock: false }) });
  if (query.min !== undefined) chips.push({ key: 'min', label: `Min ${formatMoney(query.min)}`, removeHref: partsHref(query, { ...reset, min: undefined }) });
  if (query.max !== undefined) chips.push({ key: 'max', label: `Max ${formatMoney(query.max)}`, removeHref: partsHref(query, { ...reset, max: undefined }) });

  const otherFilters = chips.filter((c) => c.key !== 'model').length;

  return (
    <>
      <PageIntro
        title={model ? `Parts for the ${modelLabel(model.brand, model.model)}` : 'Spare parts'}
        description="Genuine parts with live stock levels. Order online soon; for now, browse and check availability."
        crumbs={[{ href: '/', label: 'Home' }, { label: 'Parts' }]}
      />

      {garage.length > 0 && (
        <section aria-labelledby="garage-heading" className="container-page pt-6">
          <div className="card flex flex-wrap items-center gap-2 p-3">
            <h2 id="garage-heading" className="flex items-center gap-1.5 pr-1 text-sm font-semibold">
              <Warehouse aria-hidden="true" className="h-4 w-4 text-accent-strong" />
              My garage:
            </h2>
            {garage.map((chip) => {
              const active = query.model === chip.modelId && (query.year ?? null) === chip.year;
              return (
                <Link
                  key={`${chip.modelId}-${chip.year ?? ''}`}
                  href={partsHref(query, { model: chip.modelId, year: chip.year ?? undefined, page: 1 })}
                  aria-current={active ? 'true' : undefined}
                  className={`rounded-full border px-3 py-1 text-sm font-medium transition-colors ${
                    active ? 'border-ink bg-ink text-white' : 'border-line bg-card hover:border-ink'
                  }`}
                >
                  {chip.label}
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <div className="container-page grid gap-6 py-6 lg:grid-cols-[260px_1fr] lg:gap-8 lg:py-8">
        <aside aria-label="Filters">
          <FilterPanel activeCount={chips.length}>
            <CleanGetForm
              key={partsHref(query)}
              action="/parts"
              aria-label="Filter parts"
              className="card space-y-5 p-4"
            >
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
                  placeholder="Part name"
                  className="field"
                />
              </div>

              <div>
                <label htmlFor="filter-category" className="field-label">
                  Category
                </label>
                <select id="filter-category" name="category" defaultValue={query.category ?? ''} className="field">
                  <option value="">All categories</option>
                  {categories.map((c) => (
                    <option key={c.category_id} value={c.category_id}>
                      {c.category}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="filter-brand" className="field-label">
                  Brand
                </label>
                <select id="filter-brand" name="brand" defaultValue={query.brand ?? ''} className="field">
                  <option value="">All brands</option>
                  {brands.map((b) => (
                    <option key={b.brand_id} value={b.brand_id}>
                      {b.brand}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <input
                  id="filter-stock"
                  name="stock"
                  type="checkbox"
                  value="1"
                  defaultChecked={query.inStock}
                  className="h-4 w-4 accent-accent"
                />
                <label htmlFor="filter-stock" className="text-sm font-medium">
                  In stock only
                </label>
              </div>

              <PriceFields min={query.min} max={query.max} />

              {/* Keep the selected bike and sort order when filters change. */}
              {query.model && <input type="hidden" name="model" value={query.model} />}
              {query.model && query.year && <input type="hidden" name="year" value={query.year} />}
              {query.sort !== 'name' && <input type="hidden" name="sort" value={query.sort} />}

              <div className="flex flex-col gap-2">
                <button type="submit" className="btn-dark w-full">
                  Apply filters
                </button>
                {chips.length > 0 && (
                  <Link href="/parts" className="btn-outline w-full">
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
              options={PART_SORT_LABELS}
              hrefFor={(sort) => partsHref(query, { sort, page: 1 })}
            />
          </div>

          <ActiveFilters chips={chips} clearHref="/parts" />

          {result.items.length === 0 ? (
            model && otherFilters === 0 ? (
              <EmptyState
                icon={Bike}
                title="No compatible parts listed for this bike yet"
                action={
                  <Link href={partsHref(query, { ...reset, model: undefined, year: undefined })} className="btn-dark">
                    Show all parts
                  </Link>
                }
              >
                We have not linked any parts to the {modelLabel(model.brand, model.model)}
                {query.year ? ` (${query.year})` : ''} yet. Browse all parts or visit the workshop for advice.
              </EmptyState>
            ) : (
              <EmptyState
                icon={PackageSearch}
                title="No parts match your filters"
                action={
                  <Link href="/parts" className="btn-dark">
                    Clear filters
                  </Link>
                }
              >
                Try a different search term, widen the price range or remove a filter.
              </EmptyState>
            )
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {result.items.map((product) => (
                <li key={`${product.part_id}-${product.brand_id}`}>
                  <PartCard product={product} />
                </li>
              ))}
            </ul>
          )}

          <Pagination
            page={result.page}
            pageCount={result.pageCount}
            hrefFor={(page) => partsHref(query, { page })}
          />
        </section>
      </div>
    </>
  );
}
