// Unit tests for motorcycle reservations: deposit and balance arithmetic, Mauritius dates,
// expiry, status labels, error mapping, validation, the expected Stripe charge and the webhook
// router with reservation orders (mocked dependencies). Run: npm test

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { BIKE_DEPOSIT_PERCENT, RESERVATION_VALID_DAYS } from '../src/config/shop.ts';
import { RESERVATION_MESSAGES, mapReservationError } from '../src/lib/checkout/errors.ts';
import { bikeIdSchema, reservationSchema } from '../src/lib/checkout/validation.ts';
import { expectedChargeMinor, toMinorUnits } from '../src/lib/commerce/money.ts';
import {
  addDaysMauritius,
  balanceFor,
  depositFor,
  isReservationExpired,
  mauritiusDateOf,
} from '../src/lib/commerce/reservation.ts';
import { orderStatusLabel, orderTypeLabel, orderTypeOf } from '../src/lib/orders/status.ts';
import { handleStripeWebhook } from '../src/lib/stripe/webhook-router.ts';

const mur = { currency: 'mur', murPerUsd: 46 };

/* ------------------------------ Config values ----------------------------- */

describe('reservation config', () => {
  test('10% deposit, valid 7 days', () => {
    assert.equal(BIKE_DEPOSIT_PERCENT, 10);
    assert.equal(RESERVATION_VALID_DAYS, 7);
  });
});

/* ---------------------------- Deposit and balance ---------------------------- */

describe('depositFor', () => {
  test('10% of round prices', () => {
    assert.equal(depositFor(185000), 18500);
    assert.equal(depositFor(1234.5), 123.45);
    assert.equal(depositFor(0), 0);
  });
  test('rounds to 2 decimals, halves away from zero', () => {
    assert.equal(depositFor(12345.65), 1234.57); // 1234.565
    assert.equal(depositFor(12345.64), 1234.56); // 1234.564
    assert.equal(depositFor(99999.99), 10000); // 9999.999
    assert.equal(depositFor(0.05), 0.01); // 0.005
    assert.equal(depositFor(0.04), 0); // 0.004
    assert.equal(depositFor(2500000.05), 250000.01); // 250000.005
    assert.equal(depositFor(-12345.65), -1234.57);
  });
  test('no float drift on values that are inexact in binary', () => {
    // 1.15 * 10 = 11.499999999999998 in floating point; the deposit of 1.15 is 0.115 -> 0.12.
    assert.equal(depositFor(1.15), 0.12);
    assert.equal(depositFor(10.05), 1.01);
    assert.equal(depositFor(144.45), 14.45); // 14.445
  });
  test('non-finite input gives NaN', () => assert.ok(Number.isNaN(depositFor(NaN))));
});

describe('balanceFor', () => {
  test('price minus deposit in whole cents', () => {
    assert.equal(balanceFor(185000, 18500), 166500);
    assert.equal(balanceFor(12345.65, 1234.57), 11111.08);
    assert.equal(balanceFor(0.3, 0.1), 0.2); // not 0.19999999999999998
  });
  test('deposit + balance always equals the price (to the cent)', () => {
    for (let cents = 1; cents < 3_000_000; cents += 7919) {
      const price = cents / 100;
      const d = depositFor(price);
      const b = balanceFor(price, d);
      assert.equal(Math.round(d * 100) + Math.round(b * 100), cents, String(price));
    }
  });
  test('non-finite input gives NaN', () => assert.ok(Number.isNaN(balanceFor(100, NaN))));
});

/* --------------------------------- Dates --------------------------------- */

describe('addDaysMauritius', () => {
  test('uses the Mauritius calendar date (UTC+4)', () => {
    assert.equal(addDaysMauritius(new Date('2026-10-07T19:59:59Z'), 0), '2026-10-07');
    assert.equal(addDaysMauritius(new Date('2026-10-07T20:00:00Z'), 0), '2026-10-08');
  });
  test('adds calendar days across month and year ends', () => {
    assert.equal(addDaysMauritius(new Date('2026-10-07T08:00:00Z'), 7), '2026-10-14');
    assert.equal(addDaysMauritius(new Date('2026-10-07T21:00:00Z'), 7), '2026-10-15');
    assert.equal(addDaysMauritius(new Date('2026-12-28T10:00:00Z'), 7), '2027-01-04');
    assert.equal(addDaysMauritius(new Date('2028-02-25T10:00:00Z'), 7), '2028-03-03'); // leap year
  });
});

describe('mauritiusDateOf', () => {
  test('DATE values are kept, timestamps converted, junk rejected', () => {
    assert.equal(mauritiusDateOf('2026-10-14'), '2026-10-14');
    assert.equal(mauritiusDateOf('2026-10-14T21:00:00+00:00'), '2026-10-15');
    assert.equal(mauritiusDateOf('2026-10-14T10:00:00+04:00'), '2026-10-14');
    assert.equal(mauritiusDateOf(null), null);
    assert.equal(mauritiusDateOf(''), null);
    assert.equal(mauritiusDateOf('not a date'), null);
  });
});

describe('isReservationExpired', () => {
  const paid = { status: 'Paid', reservedUntil: '2026-10-14' };
  test('the visit-by date itself still counts', () => {
    assert.equal(isReservationExpired(paid, new Date('2026-10-14T19:59:59Z')), false); // 23:59 in Mauritius
    assert.equal(isReservationExpired(paid, new Date('2026-10-14T20:00:00Z')), true); // 15 Oct in Mauritius
    assert.equal(isReservationExpired(paid, new Date('2026-10-07T08:00:00Z')), false);
  });
  test('only paid reservations with a date can expire', () => {
    const later = new Date('2027-01-01T00:00:00Z');
    for (const status of ['Pending Payment', 'Completed', 'Cancelled']) {
      assert.equal(isReservationExpired({ ...paid, status }, later), false, status);
    }
    assert.equal(isReservationExpired({ status: 'Paid', reservedUntil: null }, later), false);
  });
});

/* -------------------------------- Labels -------------------------------- */

describe('order type and status labels', () => {
  test('order types', () => {
    assert.equal(orderTypeOf('Reservation'), 'Reservation');
    assert.equal(orderTypeOf('Parts'), 'Parts');
    assert.equal(orderTypeOf(null), 'Parts');
    assert.equal(orderTypeOf('reservation'), 'Parts');
    assert.equal(orderTypeLabel('Reservation'), 'Bike reservation');
    assert.equal(orderTypeLabel('Parts'), 'Parts order');
  });
  test('reservation statuses', () => {
    assert.equal(orderStatusLabel('Reservation', 'Pending Payment'), 'Awaiting deposit');
    assert.equal(orderStatusLabel('Reservation', 'Paid'), 'Reserved');
    assert.equal(orderStatusLabel('Reservation', 'Completed'), 'Collected');
    assert.equal(orderStatusLabel('Reservation', 'Cancelled'), 'Cancelled');
  });
  test('parts statuses unchanged; unknown values pass through', () => {
    assert.equal(orderStatusLabel('Parts', 'Pending Payment'), 'Awaiting payment');
    assert.equal(orderStatusLabel('Parts', 'Paid'), 'Paid');
    assert.equal(orderStatusLabel('Parts', 'Ready for Pickup'), 'Ready for pickup');
    assert.equal(orderStatusLabel('Parts', 'Out for Delivery'), 'Out for delivery');
    assert.equal(orderStatusLabel('Parts', 'Completed'), 'Completed');
    assert.equal(orderStatusLabel('Reservation', 'Processing'), 'Processing');
    assert.equal(orderStatusLabel('Parts', 'Something new'), 'Something new');
  });
});

/* ---------------------------- Error mapping ---------------------------- */

describe('create_bike_reservation error mapping', () => {
  const err = (message) => ({ code: 'P0001', message, details: null });
  test('every RPC error code', () => {
    assert.deepEqual(mapReservationError(err('BIKE_UNAVAILABLE')), { kind: 'unavailable', message: RESERVATION_MESSAGES.unavailable });
    assert.deepEqual(mapReservationError(err('BIKE_NOT_FOUND')), { kind: 'unavailable', message: RESERVATION_MESSAGES.unavailable });
    assert.deepEqual(mapReservationError(err('BIKE_ON_HOLD')), { kind: 'on_hold', message: RESERVATION_MESSAGES.onHold });
    assert.deepEqual(mapReservationError(err('NO_PROFILE')), { kind: 'no_profile' });
    assert.deepEqual(mapReservationError(err('INVALID_PRICE')), { kind: 'error', message: RESERVATION_MESSAGES.generic });
  });
  test('tokens inside longer messages; unknown or partial tokens are generic', () => {
    assert.equal(mapReservationError(err('error: BIKE_ON_HOLD (pending order)')).kind, 'on_hold');
    assert.equal(mapReservationError(err('BIKE_ON_HOLDING')).kind, 'error');
    assert.equal(mapReservationError({ code: '42501', message: 'permission denied' }).kind, 'error');
    assert.equal(mapReservationError({}).kind, 'error');
  });
  test('customer-facing wording', () => {
    assert.equal(RESERVATION_MESSAGES.unavailable, 'This motorcycle has just been reserved or sold.');
    assert.equal(
      RESERVATION_MESSAGES.onHold,
      'Another customer is completing a reservation for this motorcycle. Please try again in about 30 minutes.',
    );
  });
});

/* ------------------------------ Validation ------------------------------ */

describe('reservation validation', () => {
  test('bike id: positive integers only', () => {
    assert.equal(bikeIdSchema.parse('12'), 12);
    assert.equal(bikeIdSchema.parse('2147483647'), 2147483647);
    for (const bad of ['', '0', '-1', '1.5', 'abc', ' 12', '12 ', '2147483648', '99999999999', '1e3']) {
      assert.equal(bikeIdSchema.safeParse(bad).success, false, bad);
    }
  });
  test('the confirmation tick is required', () => {
    assert.deepEqual(reservationSchema.parse({ bikeId: '7', terms: 'yes' }), { bikeId: 7, terms: 'yes' });
    for (const terms of ['', 'on', 'no', undefined]) {
      const r = reservationSchema.safeParse({ bikeId: '7', terms });
      assert.equal(r.success, false, String(terms));
      assert.deepEqual(r.error.issues[0].path, ['terms']);
    }
  });
  test('no price field is accepted from the browser', () => {
    const r = reservationSchema.parse({ bikeId: '7', terms: 'yes', price: '1', deposit: '1' });
    assert.deepEqual(Object.keys(r).sort(), ['bikeId', 'terms']);
  });
});

/* ---------------------------- Expected charge ---------------------------- */

describe('expectedChargeMinor', () => {
  const items = [
    { unitPrice: 250.5, quantity: 2 },
    { unitPrice: 101.5, quantity: 1 },
  ];
  test('parts orders: sum of their items (unchanged)', () => {
    assert.equal(expectedChargeMinor({ orderType: 'Parts', totalAmount: 602.5 }, items, mur), 60250);
    assert.equal(expectedChargeMinor({ orderType: null, totalAmount: 602.5 }, items, mur), 60250);
    assert.equal(expectedChargeMinor({ orderType: 'Parts', totalAmount: 602.5 }, [], mur), null);
  });
  test('reservations: the deposit in TotalAmount, no items', () => {
    assert.equal(expectedChargeMinor({ orderType: 'Reservation', totalAmount: 18500 }, [], mur), 1850000);
    assert.equal(expectedChargeMinor({ orderType: 'Reservation', totalAmount: 1234.57 }, [], mur), 123457);
    assert.equal(
      expectedChargeMinor({ orderType: 'Reservation', totalAmount: 18500 }, [], { currency: 'usd', murPerUsd: 46 }),
      toMinorUnits(18500, { currency: 'usd', murPerUsd: 46 }),
    );
  });
  test('inconsistent orders cannot be checked (null = manual review)', () => {
    assert.equal(expectedChargeMinor(null, [], mur), null);
    assert.equal(expectedChargeMinor({ orderType: 'Reservation', totalAmount: 18500 }, items, mur), null);
    for (const totalAmount of [null, 0, -5, NaN]) {
      assert.equal(expectedChargeMinor({ orderType: 'Reservation', totalAmount }, [], mur), null, String(totalAmount));
    }
  });
});

/* ------------------------ Webhook with reservations ------------------------ */

// In-memory stand-in for the webhook route's database reads: the route loads OrderType and
// TotalAmount from Online_Order and the order's items, then calls expectedChargeMinor.
const DB = {
  orders: {
    42: { orderType: 'Reservation', totalAmount: 18500 },
    43: { orderType: 'Reservation', totalAmount: 18500 },
    50: { orderType: 'Parts', totalAmount: 602.5 },
  },
  items: {
    43: [{ unitPrice: 185000, quantity: 1 }], // a reservation must never have items
    50: [
      { unitPrice: 250.5, quantity: 2 },
      { unitPrice: 101.5, quantity: 1 },
    ],
  },
};

function mockDeps(over = {}) {
  const calls = { finalize: [], expire: [], refund: [], logs: [] };
  const deps = {
    currency: 'mur',
    constructEvent: (raw, sig) => {
      if (sig !== 'good') throw new Error('bad signature');
      return JSON.parse(raw);
    },
    expectedAmountMinor: async (id) => expectedChargeMinor(DB.orders[id] ?? null, DB.items[id] ?? [], mur),
    finalize: async (...a) => {
      calls.finalize.push(a);
      return 'paid';
    },
    expire: async (...a) => calls.expire.push(a),
    refund: async (...a) => {
      calls.refund.push(a);
    },
    log: (level, message, fields) => calls.logs.push({ level, message, fields }),
    ...over,
  };
  return { deps, calls };
}

const reservationSession = (over = {}) => ({
  id: 'cs_test_r1',
  client_reference_id: '42',
  payment_status: 'paid',
  amount_total: 1850000,
  currency: 'mur',
  payment_intent: 'pi_r1',
  metadata: { order_id: '42', order_type: 'reservation' },
  ...over,
});
const event = (type, obj) => JSON.stringify({ id: 'evt_r', type, data: { object: obj } });
const completed = (over) => event('checkout.session.completed', reservationSession(over));

describe('webhook router with reservations', () => {
  test('paid deposit finalizes the reservation', async () => {
    const { deps, calls } = mockDeps();
    assert.deepEqual(await handleStripeWebhook(completed(), 'good', deps), { status: 200, outcome: 'finalized' });
    assert.deepEqual(calls.finalize, [[42, 'cs_test_r1', 'pi_r1']]);
    assert.equal(calls.refund.length, 0);
  });
  test('duplicate event: already_paid, nothing more', async () => {
    const { deps, calls } = mockDeps({ finalize: async () => 'already_paid' });
    assert.deepEqual(await handleStripeWebhook(completed(), 'good', deps), { status: 200, outcome: 'already_paid' });
    assert.equal(calls.refund.length, 0);
  });
  test('amount mismatch (full price, wrong deposit or currency): manual review, not finalized', async () => {
    for (const over of [{ amount_total: 18500000 }, { amount_total: 1849999 }, { currency: 'usd' }]) {
      const { deps, calls } = mockDeps();
      assert.deepEqual(await handleStripeWebhook(completed(over), 'good', deps), { status: 200, outcome: 'manual_review' });
      assert.equal(calls.finalize.length, 0);
      assert.equal(calls.logs[0].level, 'error');
    }
  });
  test('a reservation with items, or an unknown order, is never finalized', async () => {
    for (const ref of ['43', '999']) {
      const { deps, calls } = mockDeps();
      const r = await handleStripeWebhook(completed({ client_reference_id: ref }), 'good', deps);
      assert.deepEqual(r, { status: 200, outcome: 'manual_review' }, ref);
      assert.equal(calls.finalize.length, 0);
    }
  });
  test('motorcycle no longer available: refund_required refunds the deposit', async () => {
    const { deps, calls } = mockDeps({ finalize: async () => 'refund_required' });
    assert.deepEqual(await handleStripeWebhook(completed(), 'good', deps), { status: 200, outcome: 'refunded' });
    assert.deepEqual(calls.refund, [['pi_r1', 42]]);
  });
  test('expired session cancels the pending reservation', async () => {
    const { deps, calls } = mockDeps();
    const r = await handleStripeWebhook(event('checkout.session.expired', reservationSession({ payment_status: 'unpaid' })), 'good', deps);
    assert.deepEqual(r, { status: 200, outcome: 'expired' });
    assert.deepEqual(calls.expire, [[42, 'cs_test_r1']]);
  });
  test('parts orders still use their items', async () => {
    const { deps, calls } = mockDeps();
    const r = await handleStripeWebhook(
      completed({ client_reference_id: '50', amount_total: 60250, metadata: { order_id: '50' } }),
      'good',
      deps,
    );
    assert.deepEqual(r, { status: 200, outcome: 'finalized' });
    assert.equal(calls.finalize[0][0], 50);
  });
});
