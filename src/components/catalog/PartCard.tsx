import Link from 'next/link';
import { ProductImage } from '@/components/ui/ProductImage';
import { StockBadge } from '@/components/ui/StockBadge';
import { formatPriceRange } from '@/lib/format';
import type { PartProduct } from '@/types/catalog';

export function partHref(partId: number, brandId: number): string {
  return `/parts/${partId}?brand=${brandId}`;
}

export function PartCard({ product }: { product: PartProduct }) {
  return (
    <article className="card group relative flex h-full flex-col overflow-hidden transition-shadow hover:shadow-md">
      <div className="relative aspect-[4/3] border-b border-line bg-card">
        <ProductImage src={product.image_url} alt={product.part_name} />
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex flex-wrap items-center gap-x-2 text-xs font-medium uppercase tracking-wide text-ink-muted">
          <span>{product.brand}</span>
          {product.category && (
            <>
              <span aria-hidden="true">/</span>
              <span>{product.category}</span>
            </>
          )}
        </div>
        <h3 className="text-base font-semibold leading-snug">
          <Link
            href={partHref(product.part_id, product.brand_id)}
            className="rounded-sm after:absolute after:inset-0 group-hover:text-accent-strong"
          >
            {product.part_name}
          </Link>
        </h3>
        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-2">
          <p className="text-lg font-bold">{formatPriceRange(product.min_price, product.max_price)}</p>
          <StockBadge status={product.stock_status} />
        </div>
        {product.variant_count > 1 && (
          <p className="text-xs text-ink-muted">{product.variant_count} options available</p>
        )}
      </div>
    </article>
  );
}
