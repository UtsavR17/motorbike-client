// Motorcycle reservation arithmetic and dates. Pure (no server-only), so it is unit tested and
// usable in any component. The deposit actually charged always comes from the database
// (create_bike_reservation); these helpers only display matching figures.

import { BIKE_DEPOSIT_PERCENT } from '@/config/shop';

// Mauritius has no daylight saving time: always UTC+4.
const MAURITIUS_OFFSET_MS = 4 * 60 * 60 * 1000;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Whole cents of a MUR amount (prices are stored with at most 2 decimals). */
function toCents(amount: number): number {
  return Math.sign(amount) * Math.round(Math.abs(amount) * 100);
}

/**
 * Deposit for a motorcycle price: BIKE_DEPOSIT_PERCENT of it, rounded to 2 decimals with halves
 * away from zero (like Postgres round(x, 2)). Integer cent arithmetic, so no float drift.
 */
export function depositFor(price: number): number {
  if (!Number.isFinite(price)) return NaN;
  const scaled = Math.abs(toCents(price)) * BIKE_DEPOSIT_PERCENT;
  return (Math.sign(price) * Math.floor((scaled + 50) / 100)) / 100;
}

/** Balance payable at the dealership: price minus deposit, in whole cents. */
export function balanceFor(price: number, deposit: number): number {
  if (!Number.isFinite(price) || !Number.isFinite(deposit)) return NaN;
  return (toCents(price) - toCents(deposit)) / 100;
}

/** Calendar date ("YYYY-MM-DD") in Mauritius of `date`, plus `days` calendar days. */
export function addDaysMauritius(date: Date, days: number): string {
  const local = new Date(date.getTime() + MAURITIUS_OFFSET_MS);
  local.setUTCDate(local.getUTCDate() + days);
  return local.toISOString().slice(0, 10);
}

/** Mauritius calendar date of a DATE ("2026-10-14") or timestamp value; null when invalid. */
export function mauritiusDateOf(value: string | null | undefined): string | null {
  if (!value) return null;
  if (ISO_DATE.test(value)) return value;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : addDaysMauritius(d, 0);
}

/**
 * A paid reservation whose visit-by date has passed (the date itself still counts). Only "Paid"
 * reservations can expire; collected or cancelled ones never show as expired.
 */
export function isReservationExpired(
  order: { status: string; reservedUntil: string | null },
  now: Date = new Date(),
): boolean {
  if (order.status !== 'Paid') return false;
  const until = mauritiusDateOf(order.reservedUntil);
  return until !== null && until < addDaysMauritius(now, 0);
}
