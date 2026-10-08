// Single place for shop-wide constants. Change values here, not in components.

export const SHOP_NAME = 'Moto Hub';
export const SHOP_TAGLINE = 'Motorcycles, genuine parts and servicing';

export const CURRENCY_LABEL = 'Rs.';
export const PAGE_SIZE = 12;

// Display text only: the database marks a variant low-stock at this quantity or fewer.
export const LOW_STOCK_THRESHOLD = 5;

export const DELIVERY_ESTIMATE = '2 to 3 working days';
export const PICKUP_ESTIMATE = 'Ready the next working day';

// Motorcycle reservations. The database (create_bike_reservation) computes the deposit that is
// charged; these values are for display and must match it.
export const BIKE_DEPOSIT_PERCENT = 10;
// A paid reservation holds the motorcycle for this many days (visit the dealership by then).
export const RESERVATION_VALID_DAYS = 7;

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

/* ---------------------------- Workshop appointments ---------------------------- */
// Display only: get_appointment_slots and create_my_appointment enforce the real rules.

export const APPOINTMENT_OPEN_DAYS_TEXT = 'Monday to Saturday';
export const APPOINTMENT_HOURS_TEXT = '08:30 to 16:30';
export const APPOINTMENT_SLOT_TEXT = '1 hour';
export const APPOINTMENT_MIN_LEAD_HOURS = 2;
export const APPOINTMENT_MAX_ADVANCE_DAYS = 30;
export const APPOINTMENT_CANCEL_LEAD_HOURS = 2;
export const APPOINTMENT_TYPES = ['Service', 'Repair', 'Inspection', 'Other'] as const;
// Start times of the 8 one-hour slots (keep in sync with get_appointment_slots).
export const APPOINTMENT_SLOT_TIMES = ['08:30', '09:30', '10:30', '11:30', '12:30', '13:30', '14:30', '15:30'] as const;
// Services per booking (matches create_my_appointment).
export const APPOINTMENT_MAX_SERVICES = 5;

// Dealership contact shown on appointment pages. Leave SHOP_PHONE empty to hide the number.
export const SHOP_PHONE: string = '';
export const WORKSHOP_HOURS_TEXT = `${APPOINTMENT_OPEN_DAYS_TEXT}, ${APPOINTMENT_HOURS_TEXT}`;

/* ---------------------------- Supplier applications ---------------------------- */
// Display and pre-checks only: submit_supplier_application and the storage bucket enforce these.

export const SUPPLIER_APPLICATION_MAX_FILE_MB = 5;
export const SUPPLIER_APPLICATION_MAX_ATTEMPTS = 3;
// Supplier Portal login (the Flask app). Set NEXT_PUBLIC_SUPPLIER_PORTAL_URL to the real URL.
export const SUPPLIER_PORTAL_URL =
  process.env.NEXT_PUBLIC_SUPPLIER_PORTAL_URL || 'http://localhost:5000/supplier-portal/login';
