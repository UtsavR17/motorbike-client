import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, PackageSearch, Search } from 'lucide-react';
import type { ReactNode } from 'react';
import { BikeModelCard } from '@/components/catalog/BikeModelCard';
import { PartCard } from '@/components/catalog/PartCard';
import { EAGER_CARD_COUNT, HOME_CARD_SIZES } from '@/components/catalog/image-sizes';
import { CleanGetForm } from '@/components/ui/CleanGetForm';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageIntro } from '@/components/ui/PageIntro';
import { listBikeModels } from '@/lib/catalog/bikes';
import { listPartProducts } from '@/lib/catalog/parts';
import {
  SEARCH_SECTION_LIMIT,
  bikesSearchQuery,
  partsSearchQuery,
  searchSections,
  type SearchSection,
} from '@/lib/catalog/search-page';
import { MAX_SEARCH_LENGTH, parseSearch, type SearchParams } from '@/lib/params';

// Search result pages are not indexed (Fix Phase 6).
export const metadata: Metadata = {
  title: 'Search',
  robots: { index: false, follow: true },
};

function SearchBox({ q }: { q?: string }) {
  return (
    <CleanGetForm action="/search" role="search" aria-label="Search the shop" className="flex max-w-xl gap-2">
      <label htmlFor="search-page-q" className="sr-only">
        Search motorcycles and spare parts
      </label>
      <input
        id="search-page-q"
        name="q"
        type="search"
        maxLength={MAX_SEARCH_LENGTH}
        defaultValue={q ?? ''}
        placeholder="Brand, model, part or colour"
        className="field"
      />
      <button type="submit" className="btn-dark shrink-0">
        <Search aria-hidden="true" className="h-4 w-4" />
        Search
      </button>
    </CleanGetForm>
  );
}

function Section<T>({
  id,
  section,
  render,
}: {
  id: string;
  section: SearchSection<T>;
  render: (item: T, index: number) => ReactNode;
}) {
  return (
    <section aria-labelledby={`${id}-heading`} className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id={`${id}-heading`} className="text-xl font-bold tracking-tight">
          {section.title}{' '}
          <span className="text-base font-medium text-ink-muted">({section.total})</span>
        </h2>
        {section.total > 0 && (
          <Link href={section.viewAllHref} className="link inline-flex items-center gap-1 text-sm font-medium">
            {section.viewAllLabel}
            <ArrowRight aria-hidden="true" className="h-4 w-4" />
          </Link>
        )}
      </div>
      {section.total === 0 ? (
        <p className="card px-4 py-6 text-sm text-ink-muted">{section.emptyText}.</p>
      ) : (
        // Same grid and image sizes as the home page sections (2 columns from sm, 4 from lg).
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{section.items.map(render)}</ul>
      )}
    </section>
  );
}

export default async function SearchPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const q = parseSearch((await searchParams).q);
  const crumbs = [{ href: '/', label: 'Home' }, { label: 'Search' }];

  if (!q) {
    return (
      <>
        <PageIntro title="Search" description="Find motorcycles and spare parts by brand, model, part name or colour." crumbs={crumbs} />
        <div className="container-page py-8">
          <SearchBox />
        </div>
      </>
    );
  }

  // Two queries in parallel, with the same term and escaping rules as the listings.
  const [bikes, parts] = await Promise.all([
    listBikeModels(bikesSearchQuery(q), SEARCH_SECTION_LIMIT),
    listPartProducts(partsSearchQuery(q), SEARCH_SECTION_LIMIT),
  ]);
  const view = searchSections(q, bikes, parts);

  return (
    <>
      <PageIntro
        title={`Results for "${q}"`}
        description={`${bikes.total + parts.total} result${bikes.total + parts.total === 1 ? '' : 's'}: ${bikes.total} motorcycle${bikes.total === 1 ? '' : 's'} and ${parts.total} spare part${parts.total === 1 ? '' : 's'}.`}
        crumbs={crumbs}
      />
      <div className="container-page space-y-10 py-8">
        <SearchBox q={q} />

        {view.bothEmpty ? (
          <EmptyState icon={PackageSearch} title={`Nothing matches "${q}"`}>
            Check the spelling or try fewer words, for example a brand or a part name. You can also browse{' '}
            <Link href="/bikes" className="link">
              all motorcycles
            </Link>{' '}
            or{' '}
            <Link href="/parts" className="link">
              all spare parts
            </Link>
            .
          </EmptyState>
        ) : (
          <>
            <Section
              id="search-bikes"
              section={view.bikes}
              render={(model, index) => (
                <li key={model.model_id}>
                  <BikeModelCard model={model} imageSizes={HOME_CARD_SIZES} eager={index < EAGER_CARD_COUNT} />
                </li>
              )}
            />
            <Section
              id="search-parts"
              section={view.parts}
              render={(product, index) => (
                <li key={`${product.part_id}-${product.brand_id}`}>
                  <PartCard
                    product={product}
                    imageSizes={HOME_CARD_SIZES}
                    eager={view.bikes.total === 0 && index < EAGER_CARD_COUNT}
                  />
                </li>
              )}
            />
          </>
        )}
      </div>
    </>
  );
}
