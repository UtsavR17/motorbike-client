// Single place for shop-wide constants. Change values here, not in components.

export const SHOP_NAME = 'Moto Hub';
export const SHOP_TAGLINE = 'Motorcycles, genuine parts and servicing';

export const CURRENCY_LABEL = 'Rs.';
export const PAGE_SIZE = 12;

// Display text only: the database marks a variant low-stock at this quantity or fewer.
export const LOW_STOCK_THRESHOLD = 5;

export const DELIVERY_ESTIMATE = '2 to 3 working days';
export const PICKUP_ESTIMATE = 'Ready the next working day';

// Used for display text only (motorcycle reservations are a later task).
export const BIKE_DEPOSIT_PERCENT = 10;

// The finder accepts model years from this year up to next year.
export const FINDER_MIN_YEAR = 1990;

// catalog_part_variants caps qty_available at this value (it means "this many or more").
export const STOCK_QTY_CAP = 10;

// Oldest model year accepted for a garage bike (keep in sync with src/lib/auth/validation.ts).
export const BIKE_MIN_YEAR = 1950;

/* ------------------------------ Cart and orders ----------------------------- */

// Largest quantity of one stock item per order (matches create_online_order).
export const MAX_LINE_QTY = 10;
// Most distinct stock items in one cart or order (matches create_online_order).
export const MAX_CART_LINES = 20;
// How long a Stripe Checkout Session stays open (Stripe allows 30 minutes to 24 hours).
export const CHECKOUT_SESSION_MINUTES = 30;
// Order ids are shown as ORD-000123.
export const ORDER_ID_PREFIX = 'ORD-';
