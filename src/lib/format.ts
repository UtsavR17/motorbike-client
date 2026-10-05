import { BIKE_DEPOSIT_PERCENT, CURRENCY_LABEL } from '@/config/shop';

/** Converts a NUMERIC value (number or numeric string) to a finite number, else null. */
export function toNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

const moneyWhole = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const moneyCents = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** "Rs. 1,250" or "Rs. 258.75". Returns a dash-free fallback when the value is missing. */
export function formatMoney(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return 'Price on request';
  const fmt = Number.isInteger(value) ? moneyWhole : moneyCents;
  return `${CURRENCY_LABEL} ${fmt.format(value)}`;
}

/** A single price, or "from Rs. X" when the variants differ. */
export function formatPriceRange(min: number, max: number): string {
  if (min === max) return formatMoney(min);
  return `from ${formatMoney(min)}`;
}

/** "150 to 250 cc", "124 cc" or null when unknown. */
export function formatRange(min: number | null, max: number | null, unit = ''): string | null {
  const suffix = unit ? ` ${unit}` : '';
  if (min === null && max === null) return null;
  if (min === null || max === null || min === max) return `${min ?? max}${suffix}`;
  return `${min} to ${max}${suffix}`;
}

export function formatWarranty(months: number | null | undefined): string {
  if (!months || months <= 0) return 'No warranty';
  return months === 1 ? '1 month' : `${months} months`;
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

/** Collapses repeated whitespace that sometimes appears in admin-entered text. */
export function cleanText(value: string | null | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim();
}

/** Deposit for reserving a motorcycle, rounded to cents. */
export function depositFor(price: number): number {
  return Math.round(price * BIKE_DEPOSIT_PERCENT) / 100;
}

/** Joins a list as "A, B and C". */
export function joinList(values: string[]): string {
  if (values.length <= 1) return values.join('');
  return `${values.slice(0, -1).join(', ')} and ${values[values.length - 1]}`;
}
