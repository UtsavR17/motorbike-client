import Link from 'next/link';
import { ProductImage } from '@/components/ui/ProductImage';
import { formatPriceRange, formatRange, joinList, pluralize } from '@/lib/format';
import type { BikeModel } from '@/types/catalog';

export function BikeModelCard({ model }: { model: BikeModel }) {
  const engine = formatRange(model.min_engine_cc, model.max_engine_cc, 'cc');
  const specs = [
    engine,
    model.fuel_types.length ? joinList(model.fuel_types) : null,
    model.transmissions.length ? joinList(model.transmissions) : null,
  ].filter(Boolean) as string[];

  return (
    <article className="card group relative flex h-full flex-col overflow-hidden transition-shadow hover:shadow-md">
      <div className="relative aspect-[16/10] border-b border-line bg-card">
        <ProductImage src={model.image_url} alt={`${model.brand} ${model.model}`} kind="bike" />
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">{model.brand}</p>
        <h3 className="text-lg font-semibold leading-snug">
          <Link
            href={`/bikes/${model.model_id}`}
            className="rounded-sm after:absolute after:inset-0 group-hover:text-accent-strong"
          >
            {model.model}
          </Link>
        </h3>
        {specs.length > 0 && (
          <ul className="flex flex-wrap gap-1.5" aria-label="Key specifications">
            {specs.map((spec) => (
              <li key={spec} className="rounded-full bg-page px-2.5 py-0.5 text-xs font-medium text-ink">
                {spec}
              </li>
            ))}
          </ul>
        )}
        {model.colors.length > 0 && (
          <p className="text-sm text-ink-muted">
            <span className="font-medium text-ink">Colours: </span>
            {joinList(model.colors)}
          </p>
        )}
        <div className="mt-auto flex flex-wrap items-end justify-between gap-2 pt-2">
          <p className="text-lg font-bold">{formatPriceRange(model.min_price, model.max_price)}</p>
          <p className="text-sm font-medium text-ok">{pluralize(model.units_available, 'unit')} available</p>
        </div>
      </div>
    </article>
  );
}
