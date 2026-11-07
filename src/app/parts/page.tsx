import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Bike, PackageSearch, Warehouse } from 'lucide-react';
import { ActiveFilters, type FilterChip } from '@/components/catalog/ActiveFilters';
import { FilterPanel } from '@/components/catalog/FilterPanel';
import { PartCard } from '@/components/catalog/PartCard';
import { EAGER_CARD_COUNT, LIST_CARD_SIZES } from '@/components/catalog/image-sizes';
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
import { emptyListing, resultsHeadline } from '@/lib/catalog/search-page';
import { formatMoney } from '@/lib/format';
import { modelLabel } from '@/lib/labels';
import {
  MAX_SEARCH_LENGTH,
  PARTS_FORM_FIELDS,
  PART_SORT_LABELS,
  parsePartsQuery,
  partsLinks,
  partsWithoutFilters,
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

  // Every link and the form's hidden fields come from one helper (Fix Phase 6).
  const links = partsLinks(query);
  const result = await listPartProducts(query);
  if (result.outOfRange) redirect(links.page(result.pageCount));
  // Only for an empty filtered page: would the same search find parts without the filters?
  const unfilteredTotal =
    result.total === 0 && links.hasFilters ? (await listPartProducts(partsWithoutFilters(query), 1)).total : 0;
  const empty = emptyListing('parts', query.q, links.hasFilters, unfilteredTotal);
  const headline = resultsHeadline(result.total, query.q);

  const fitsLabel = model
    ? `Fits: ${modelLabel(model.brand, model.model)}${query.year ? ` (${query.year})` : ''}`
    : null;
  const chips: FilterChip[] = [];
  if (fitsLabel)
    chips.push({ key: 'model', label: fitsLabel, removeHref: links.remove('model') });
  if (query.q) chips.push({ key: 'q', label: `Search: "${query.q}"`, removeHref: links.remove('q') });
  if (category) chips.push({ key: 'category', label: category.category, removeHref: links.remove('category') });
  if (brand) chips.push({ key: 'brand', label: brand.brand, removeHref: links.remove('brand') });
  if (query.inStock) chips.push({ key: 'stock', label: 'In stock only', removeHref: links.remove('stock') });
  if (query.min !== undefined) chips.push({ key: 'min', label: `Min ${formatMoney(query.min)}`, removeHref: links.remove('min') });
  if (query.max !== undefined) chips.push({ key: 'max', label: `Max ${formatMoney(query.max)}`, removeHref: links.remove('max') });

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
                  href={links.withBike(chip.modelId, chip.year ?? undefined)}
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
              key={links.self}
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

              {/* Every other parameter (bike, year, sort) travels along; the page resets to 1. */}
              {links.hiddenFields(PARTS_FORM_FIELDS).map(([name, value]) => (
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
              options={PART_SORT_LABELS}
              hrefFor={links.sort}
            />
          </div>

          <ActiveFilters
            chips={chips}
            clearFiltersHref={links.hasFilters ? links.clearFilters : null}
            clearSearchHref={query.q ? links.clearSearch : null}
          />

          {result.items.length === 0 ? (
            model && otherFilters === 0 ? (
              <EmptyState
                icon={Bike}
                title="No compatible parts listed for this bike yet"
                action={
                  <Link href={links.remove('model')} className="btn-dark">
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
              {result.items.map((product, index) => (
                <li key={`${product.part_id}-${product.brand_id}`}>
                  <PartCard product={product} imageSizes={LIST_CARD_SIZES} eager={index < EAGER_CARD_COUNT} />
                </li>
              ))}
            </ul>
          )}

          <Pagination
            page={result.page}
            pageCount={result.pageCount}
            hrefFor={links.page}
          />
        </section>
      </div>
    </>
  );
}
