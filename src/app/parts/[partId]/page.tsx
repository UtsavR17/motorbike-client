import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Check, ShieldCheck, Store, Truck } from 'lucide-react';
import { AddToCart } from '@/components/cart/AddToCart';
import { Breadcrumbs } from '@/components/ui/PageIntro';
import { ProductImage } from '@/components/ui/ProductImage';
import { StockBadge } from '@/components/ui/StockBadge';
import {
  DELIVERY_ESTIMATE,
  LOW_STOCK_THRESHOLD,
  MAX_LINE_QTY,
  PICKUP_ESTIMATE,
  STOCK_QTY_CAP,
} from '@/config/shop';
import { getPartVariants } from '@/lib/catalog/parts';
import { cleanText, formatMoney, formatWarranty } from '@/lib/format';
import { sizeLabel } from '@/lib/labels';
import { parseId, type SearchParams } from '@/lib/params';
import type { PartVariant } from '@/types/catalog';

interface PartPageProps {
  params: Promise<{ partId: string }>;
  searchParams: Promise<SearchParams>;
}

interface BrandOption {
  brand_id: number;
  brand: string;
  available: boolean;
}

function availabilityText(v: PartVariant): string {
  if (v.stock_status === 'out_of_stock') return 'Out of stock';
  if (v.stock_status === 'low_stock') return `Low stock: only ${v.qty_available} left`;
  return v.qty_available >= STOCK_QTY_CAP
    ? `In stock: ${STOCK_QTY_CAP}+ available`
    : `In stock: ${v.qty_available} available`;
}

const isAvailable = (v: PartVariant) => v.stock_status !== 'out_of_stock';

/**
 * Works out which brand and variant to show. Returns null when the part does not
 * exist or the requested brand does not stock it (both become a 404).
 */
async function resolveSelection(partIdParam: string, sp: SearchParams) {
  const partId = parseId(partIdParam);
  if (!partId) return null;
  const variants = await getPartVariants(partId);
  if (variants.length === 0) return null;

  const brandMap = new Map<number, BrandOption>();
  for (const v of variants) {
    const current = brandMap.get(v.brand_id);
    brandMap.set(v.brand_id, {
      brand_id: v.brand_id,
      brand: v.brand,
      available: (current?.available ?? false) || isAvailable(v),
    });
  }
  const brands = [...brandMap.values()].sort((a, b) => a.brand.localeCompare(b.brand));

  let brand: BrandOption | undefined;
  if (sp.brand !== undefined) {
    const requested = parseId(sp.brand);
    brand = brands.find((b) => b.brand_id === requested);
    if (!brand) return null;
  } else {
    brand = brands.find((b) => b.available) ?? brands[0];
  }

  const options = variants.filter((v) => v.brand_id === brand.brand_id);
  const requestedVariant = parseId(sp.variant);
  const selected =
    options.find((v) => v.stock_id === requestedVariant) ?? options.find(isAvailable) ?? options[0];

  return { partId, brands, brand, options, selected };
}

export async function generateMetadata({ params, searchParams }: PartPageProps): Promise<Metadata> {
  const selection = await resolveSelection((await params).partId, await searchParams);
  if (!selection) return { title: 'Part not found' };
  const { selected } = selection;
  return {
    title: `${selected.part_name} (${selected.brand})`,
    description:
      cleanText(selected.part_description).slice(0, 155) ||
      `${selected.part_name} by ${selected.brand}. Check price and stock.`,
  };
}

export default async function PartDetailPage({ params, searchParams }: PartPageProps) {
  const selection = await resolveSelection((await params).partId, await searchParams);
  if (!selection) notFound();
  const { partId, brands, brand, options, selected } = selection;

  const hrefFor = (brandId: number, stockId?: number) =>
    `/parts/${partId}?brand=${brandId}${stockId ? `&variant=${stockId}` : ''}`;
  const description = (selected.part_description ?? '').trim();

  return (
    <div className="container-page py-6 lg:py-8">
      <Breadcrumbs
        items={[
          { href: '/', label: 'Home' },
          { href: '/parts', label: 'Parts' },
          ...(selected.category_id && selected.category
            ? [{ href: `/parts?category=${selected.category_id}`, label: selected.category }]
            : []),
          { label: selected.part_name },
        ]}
      />

      <div className="mt-4 grid gap-6 lg:grid-cols-2 lg:gap-10">
        <div className="card relative aspect-[4/3] overflow-hidden lg:sticky lg:top-32 lg:aspect-square lg:self-start">
          <ProductImage
            src={selected.image_url}
            alt={`${selected.part_name} by ${selected.brand}`}
            sizes="(min-width: 1024px) 50vw, 100vw"
            preload
          />
        </div>

        <div className="space-y-6">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-ink-muted">
              {selected.brand}
              {selected.category ? ` / ${selected.category}` : ''}
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">{selected.part_name}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <p className="text-3xl font-bold">{formatMoney(selected.price)}</p>
              <StockBadge status={selected.stock_status} />
            </div>
          </div>

          {brands.length > 1 && (
            <section aria-labelledby="brand-heading">
              <h2 id="brand-heading" className="field-label">
                Brand
              </h2>
              <ul className="flex flex-wrap gap-2">
                {brands.map((b) => {
                  const active = b.brand_id === brand.brand_id;
                  return (
                    <li key={b.brand_id}>
                      <Link
                        href={hrefFor(b.brand_id)}
                        scroll={false}
                        aria-current={active ? 'true' : undefined}
                        className={`inline-flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
                          active ? 'border-ink bg-ink text-white' : 'border-line bg-card hover:border-ink'
                        }`}
                      >
                        {active && <Check aria-hidden="true" className="h-4 w-4" />}
                        {b.brand}
                        {!b.available && <span className="text-xs opacity-80">(out of stock)</span>}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          <section aria-labelledby="size-heading">
            <h2 id="size-heading" className="field-label">
              {options.length > 1 ? 'Choose an option' : 'Option'}
            </h2>
            <ul className="grid gap-2 sm:grid-cols-2">
              {options.map((v, i) => {
                const active = v.stock_id === selected.stock_id;
                const label = sizeLabel(v.size);
                const duplicate = options.filter((o) => sizeLabel(o.size) === label).length > 1;
                return (
                  <li key={v.stock_id}>
                    <Link
                      href={hrefFor(brand.brand_id, v.stock_id)}
                      scroll={false}
                      aria-current={active ? 'true' : undefined}
                      className={`flex h-full flex-col rounded-control border-2 px-4 py-3 text-sm transition-colors ${
                        active ? 'border-accent bg-accent-soft' : 'border-line bg-card hover:border-ink'
                      }`}
                    >
                      <span className="font-semibold">
                        {label}
                        {duplicate ? ` (option ${i + 1})` : ''}
                      </span>
                      <span className="mt-0.5 text-ink-muted">
                        {formatMoney(v.price)}
                        {isAvailable(v) ? '' : ', out of stock'}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>

          <dl className="card grid grid-cols-1 divide-y divide-line text-sm sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            <div className="p-4">
              <dt className="text-ink-muted">Availability</dt>
              <dd className="mt-1 font-semibold">{availabilityText(selected)}</dd>
            </div>
            <div className="p-4">
              <dt className="text-ink-muted">Warranty</dt>
              <dd className="mt-1 flex items-center gap-1.5 font-semibold">
                <ShieldCheck aria-hidden="true" className="h-4 w-4 text-ok" />
                {formatWarranty(selected.warranty_months)}
              </dd>
            </div>
            <div className="p-4">
              <dt className="text-ink-muted">Size</dt>
              <dd className="mt-1 font-semibold">{sizeLabel(selected.size)}</dd>
            </div>
          </dl>

          <AddToCart
            key={selected.stock_id}
            stockId={selected.stock_id}
            name={selected.part_name}
            price={selected.price}
            maxQty={isAvailable(selected) ? Math.min(selected.qty_available, MAX_LINE_QTY) : 0}
          />

          <section aria-labelledby="delivery-heading" className="card p-4">
            <h2 id="delivery-heading" className="text-base font-semibold">
              Delivery and pickup
            </h2>
            <ul className="mt-3 space-y-3 text-sm">
              <li className="flex gap-3">
                <Truck aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-accent-strong" />
                <span>
                  <span className="font-medium">Home delivery:</span> {DELIVERY_ESTIMATE}.
                </span>
              </li>
              <li className="flex gap-3">
                <Store aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-accent-strong" />
                <span>
                  <span className="font-medium">Store pickup:</span> {PICKUP_ESTIMATE}.
                </span>
              </li>
            </ul>
            <p className="mt-3 text-xs text-ink-muted">
              Low stock means {LOW_STOCK_THRESHOLD} or fewer left. Stock levels update as orders come in.
            </p>
          </section>

          {description && (
            <section aria-labelledby="description-heading">
              <h2 id="description-heading" className="text-base font-semibold">
                Description
              </h2>
              {/* Rendered as plain text, never as HTML. */}
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-ink-muted">{description}</p>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
