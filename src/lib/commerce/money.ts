// Money conversion for Stripe. The shop shows Rs. and the database stores MUR; Stripe is
// charged in STRIPE_CURRENCY (mur by default, or usd converted at STRIPE_MUR_PER_USD).
// No secrets here; used only on the server.

export type ChargeCurrency = 'mur' | 'usd';

export interface CurrencyConfig {
  currency: ChargeCurrency;
  /** Rupees per US dollar, used only when currency is usd. */
  murPerUsd: number;
}

export const DEFAULT_MUR_PER_USD = 46;

export function currencyConfig(env: Record<string, string | undefined> = process.env): CurrencyConfig {
  const currency: ChargeCurrency = env.STRIPE_CURRENCY?.trim().toLowerCase() === 'usd' ? 'usd' : 'mur';
  const rate = Number(env.STRIPE_MUR_PER_USD);
  return { currency, murPerUsd: Number.isFinite(rate) && rate > 0 ? rate : DEFAULT_MUR_PER_USD };
}

/** Rounds to an integer, halves away from zero (2.5 -> 3, -2.5 -> -3). */
export function roundHalfAwayFromZero(value: number): number {
  // The tiny nudge absorbs binary floating point noise such as 0.285 * 100 = 28.499999...
  return Math.sign(value) * Math.round(Math.abs(value) + 1e-9);
}

/**
 * MUR amount (as stored in the database) to Stripe minor units for the charge currency.
 * MUR: rupees x 100. USD: round(MUR / rate, 2) expressed in cents.
 */
export function toMinorUnits(murAmount: number, config: CurrencyConfig = currencyConfig()): number {
  if (!Number.isFinite(murAmount)) throw new Error('Invalid amount');
  if (config.currency === 'usd') return roundHalfAwayFromZero((murAmount * 100) / config.murPerUsd);
  return roundHalfAwayFromZero(murAmount * 100);
}

/** Total in minor units exactly as Stripe computes it: sum of unit_amount x quantity. */
export function expectedTotalMinor(
  lines: { unitPrice: number; quantity: number }[],
  config: CurrencyConfig = currencyConfig(),
): number {
  return lines.reduce((sum, l) => sum + toMinorUnits(l.unitPrice, config) * l.quantity, 0);
}

export interface ChargeOrder {
  /** Online_Order.OrderType: "Parts" or "Reservation". */
  orderType: string | null;
  /** Online_Order.TotalAmount in MUR (for a reservation: the deposit). */
  totalAmount: number | null;
}

/**
 * Amount the Stripe session must have charged, in minor units, or null when the order cannot be
 * checked (missing, inconsistent). Parts orders: recomputed from their items, as Stripe sums the
 * line items. Reservations have no items: the session has one line equal to TotalAmount.
 */
export function expectedChargeMinor(
  order: ChargeOrder | null,
  items: { unitPrice: number; quantity: number }[],
  config: CurrencyConfig = currencyConfig(),
): number | null {
  if (!order) return null;
  if (order.orderType === 'Reservation') {
    if (items.length > 0) return null;
    if (order.totalAmount === null || !Number.isFinite(order.totalAmount) || order.totalAmount <= 0) return null;
    return toMinorUnits(order.totalAmount, config);
  }
  if (items.length === 0) return null;
  return expectedTotalMinor(items, config);
}
