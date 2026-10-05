import Link from 'next/link';
import { ArrowRight, Tag } from 'lucide-react';
import { BikeModelCard } from '@/components/catalog/BikeModelCard';
import { PartCard } from '@/components/catalog/PartCard';
import { ServiceCard } from '@/components/catalog/ServiceCard';
import { TrustStrip } from '@/components/catalog/TrustStrip';
import { VehicleFinder } from '@/components/catalog/VehicleFinder';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { listFeaturedBikeModels } from '@/lib/catalog/bikes';
import { getBrands, getCategories, getModels } from '@/lib/catalog/lookups';
import { listFeaturedParts } from '@/lib/catalog/parts';
import { listServices } from '@/lib/catalog/services';
import { maxFinderYear } from '@/lib/params';

export default async function HomePage() {
  const [models, categories, brands, parts, bikes, services] = await Promise.all([
    getModels(),
    getCategories(),
    getBrands(),
    listFeaturedParts(8),
    listFeaturedBikeModels(4),
    listServices(3),
  ]);

  return (
    <>
      <section aria-labelledby="hero-heading" className="bg-ink text-white">
        <div className="container-page grid gap-8 py-10 sm:py-14 lg:grid-cols-[1fr_1.1fr] lg:items-center lg:py-16">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-accent">Motorcycles, parts and servicing</p>
            <h1 id="hero-heading" className="mt-3 text-3xl font-bold leading-tight tracking-tight sm:text-4xl lg:text-5xl">
              The right part for your bike, in stock and ready to go.
            </h1>
            <p className="mt-4 max-w-lg text-white/80">
              Pick your motorcycle to see the parts that fit it, or browse new motorcycles available at the
              dealership today.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/bikes" className="btn-primary h-11 px-5">
                Browse motorcycles
                <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </Link>
              <Link href="/parts" className="btn h-11 border border-white/30 px-5 text-white hover:border-white">
                Shop all parts
              </Link>
            </div>
          </div>

          <div className="rounded-card bg-card p-5 text-ink shadow-xl sm:p-6">
            <h2 className="text-lg font-bold">Shop by your bike</h2>
            <p className="mb-4 mt-1 text-sm text-ink-muted">Find parts that are listed as compatible with your motorcycle.</p>
            <VehicleFinder models={models} maxYear={maxFinderYear()} />
          </div>
        </div>
      </section>

      <TrustStrip />

      <div className="container-page space-y-14 py-10 lg:py-14">
        {categories.length > 0 && (
          <section aria-labelledby="categories-heading">
            <SectionHeading id="categories-heading" title="Shop by category" href="/parts" linkLabel="All parts" />
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {categories.map((c) => (
                <li key={c.category_id}>
                  <Link
                    href={`/parts?category=${c.category_id}`}
                    className="card flex h-full items-center gap-2 p-4 text-sm font-semibold transition-colors hover:border-accent hover:text-accent-strong"
                  >
                    <Tag aria-hidden="true" className="h-4 w-4 shrink-0 text-accent-strong" />
                    {c.category}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {brands.length > 0 && (
          <section aria-labelledby="brands-heading">
            <SectionHeading id="brands-heading" title="Shop by brand" />
            <ul className="flex flex-wrap gap-2">
              {brands.map((b) => (
                <li key={b.brand_id}>
                  <Link
                    href={`/parts?brand=${b.brand_id}`}
                    className="inline-flex rounded-full border border-line bg-card px-4 py-2 text-sm font-semibold transition-colors hover:border-ink"
                  >
                    {b.brand}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section aria-labelledby="featured-heading">
          <SectionHeading id="featured-heading" title="Featured parts" href="/parts?stock=1" linkLabel="All in-stock parts" />
          {parts.length === 0 ? (
            <p className="text-ink-muted">No parts in stock right now. Please check back soon.</p>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {parts.map((p) => (
                <li key={`${p.part_id}-${p.brand_id}`}>
                  <PartCard product={p} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="bikes-heading">
          <SectionHeading id="bikes-heading" title="Motorcycles available" href="/bikes" linkLabel="All motorcycles" />
          {bikes.length === 0 ? (
            <p className="text-ink-muted">No motorcycles in stock right now. New stock arrives regularly.</p>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {bikes.map((m) => (
                <li key={m.model_id}>
                  <BikeModelCard model={m} />
                </li>
              ))}
            </ul>
          )}
        </section>

        {services.length > 0 && (
          <section aria-labelledby="services-heading">
            <SectionHeading id="services-heading" title="Workshop services" href="/services" linkLabel="All services" />
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {services.map((s) => (
                <li key={s.service_id}>
                  <ServiceCard service={s} />
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </>
  );
}
