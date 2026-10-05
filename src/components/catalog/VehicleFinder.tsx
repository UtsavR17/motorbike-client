'use client';

import { Search } from 'lucide-react';
import { useId, useMemo, useState } from 'react';
import { CleanGetForm } from '@/components/ui/CleanGetForm';
import { FINDER_MIN_YEAR } from '@/config/shop';
import type { CatalogModel } from '@/types/catalog';

interface VehicleFinderProps {
  models: CatalogModel[];
  maxYear: number;
}

/**
 * "Shop by my bike": Brand, then Model, then an optional Year.
 * Without JavaScript the model list shows every model grouped by brand and the
 * form still submits to /parts?model=<id>&year=<y>.
 */
export function VehicleFinder({ models, maxYear }: VehicleFinderProps) {
  const id = useId();
  const [brandId, setBrandId] = useState('');
  const [modelId, setModelId] = useState('');

  const brands = useMemo(() => {
    const map = new Map<number, string>();
    models.forEach((m) => map.set(m.brand_id, m.brand));
    return [...map].sort((a, b) => a[1].localeCompare(b[1]));
  }, [models]);

  const groups = useMemo(() => {
    const visible = brandId ? models.filter((m) => String(m.brand_id) === brandId) : models;
    const byBrand = new Map<string, CatalogModel[]>();
    visible.forEach((m) => byBrand.set(m.brand, [...(byBrand.get(m.brand) ?? []), m]));
    return [...byBrand];
  }, [models, brandId]);

  if (models.length === 0) {
    return <p className="text-sm text-white/80">The vehicle finder will be available once models are listed.</p>;
  }

  return (
    <CleanGetForm action="/parts" aria-label="Find parts for your motorcycle" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1.4fr_0.8fr_auto] lg:items-end">
      <div>
        <label htmlFor={`${id}-brand`} className="mb-1 block text-sm font-medium text-ink">
          Brand
        </label>
        {/* No name attribute: the brand only narrows the model list and is not submitted. */}
        <select
          id={`${id}-brand`}
          value={brandId}
          onChange={(e) => {
            setBrandId(e.target.value);
            setModelId('');
          }}
          className="field h-11"
        >
          <option value="">All brands</option>
          {brands.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor={`${id}-model`} className="mb-1 block text-sm font-medium text-ink">
          Model
        </label>
        <select
          id={`${id}-model`}
          name="model"
          required
          value={modelId}
          onChange={(e) => setModelId(e.target.value)}
          className="field h-11"
        >
          <option value="" disabled>
            Select your model
          </option>
          {groups.map(([brand, list]) => (
            <optgroup key={brand} label={brand}>
              {list.map((m) => (
                <option key={m.model_id} value={m.model_id}>
                  {m.model}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor={`${id}-year`} className="mb-1 block text-sm font-medium text-ink">
          Year <span className="font-normal text-ink-muted">(optional)</span>
        </label>
        <input
          id={`${id}-year`}
          name="year"
          type="number"
          inputMode="numeric"
          min={FINDER_MIN_YEAR}
          max={maxYear}
          step={1}
          placeholder={`e.g. ${maxYear - 1}`}
          className="field h-11"
        />
      </div>

      <button type="submit" className="btn-primary h-11 sm:col-span-2 lg:col-span-1">
        <Search aria-hidden="true" className="h-4 w-4" />
        Find parts
      </button>
    </CleanGetForm>
  );
}
