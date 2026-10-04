import { CURRENCY_LABEL } from '@/config/shop';

/** Min and max price inputs shared by the parts and motorcycle filters. */
export function PriceFields({ min, max }: { min?: number; max?: number }) {
  return (
    <fieldset>
      <legend className="field-label">Price ({CURRENCY_LABEL})</legend>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label htmlFor="filter-min" className="sr-only">
            Minimum price
          </label>
          <input
            id="filter-min"
            name="min"
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            placeholder="Min"
            defaultValue={min ?? ''}
            className="field"
          />
        </div>
        <div>
          <label htmlFor="filter-max" className="sr-only">
            Maximum price
          </label>
          <input
            id="filter-max"
            name="max"
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            placeholder="Max"
            defaultValue={max ?? ''}
            className="field"
          />
        </div>
      </div>
    </fieldset>
  );
}
