// Unit tests for cart storage, money conversion, order ids, checkout validation, order error
// mapping and the Stripe webhook router (with mocked dependencies). Run: npm test

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  CART_STORAGE_KEY,
  addLine,
  cartCount,
  clampQty,
  parseStoredCart,
  removeLine,
  serializeCart,
  setLineQty,
} from '../src/lib/cart/storage.ts';
import { mapCreateOrderError } from '../src/lib/checkout/errors.ts';
import { checkoutSchema, orderIdSchema, sessionIdSchema } from '../src/lib/checkout/validation.ts';
import { currencyConfig, expectedTotalMinor, toMinorUnits } from '../src/lib/commerce/money.ts';
import { formatOrderId } from '../src/lib/format.ts';
import { fieldErrorsFrom } from '../src/lib/auth/validation.ts';
import { handleStripeWebhook, orderIdFrom, paymentIntentIdFrom } from '../src/lib/stripe/webhook-router.ts';

/* --------------------------------- Cart ---------------------------------- */

describe('cart storage', () => {
  test('uses the versioned key', () => assert.equal(CART_STORAGE_KEY, 'motohub-cart-v1'));
  test('malformed or hostile data gives an empty cart', () => {
    for (const raw of [null, '', 'not json', '{}', '"x"', '42', 'null', '[1,2', 'x'.repeat(20000)]) {
      assert.deepEqual(parseStoredCart(raw), [], String(raw).slice(0, 20));
    }
  });
  test('drops malformed entries and keeps valid ones', () => {
    const raw = JSON.stringify([
      { stockId: 5, qty: 2, addedPrice: 100 },
      { stockId: -1, qty: 1, addedPrice: 1 },
      { stockId: 1.5, qty: 1, addedPrice: 1 },
      { stockId: '7', qty: 1, addedPrice: 1 },
      { stockId: 8, qty: 0, addedPrice: 1 },
      { stockId: 9, qty: 'x', addedPrice: 1 },
      { stockId: 10, qty: 1, addedPrice: 'free' },
      null,
      'junk',
    ]);
    assert.deepEqual(parseStoredCart(raw), [
      { stockId: 5, qty: 2, addedPrice: 100 },
      { stockId: 10, qty: 1, addedPrice: 0 },
    ]);
  });
  test('merges duplicate stock ids and caps quantity at 10', () => {
    const raw = JSON.stringify([
      { stockId: 5, qty: 7, addedPrice: 1 },
      { stockId: 5, qty: 7, addedPrice: 2 },
      { stockId: 6, qty: 99, addedPrice: 1 },
    ]);
    assert.deepEqual(parseStoredCart(raw), [
      { stockId: 5, qty: 10, addedPrice: 1 },
      { stockId: 6, qty: 10, addedPrice: 1 },
    ]);
  });
  test('keeps at most 20 lines', () => {
    const raw = JSON.stringify(Array.from({ length: 30 }, (_, i) => ({ stockId: i + 1, qty: 1, addedPrice: 1 })));
    assert.equal(parseStoredCart(raw).length, 20);
  });
  test('add merges, refuses a 21st line, and clamps', () => {
    let lines = [];
    lines = addLine(lines, { stockId: 1, qty: 3, addedPrice: 10 });
    lines = addLine(lines, { stockId: 1, qty: 9, addedPrice: 10 });
    assert.deepEqual(lines, [{ stockId: 1, qty: 10, addedPrice: 10 }]);
    const full = Array.from({ length: 20 }, (_, i) => ({ stockId: i + 1, qty: 1, addedPrice: 1 }));
    assert.equal(addLine(full, { stockId: 99, qty: 1, addedPrice: 1 }), null);
    assert.equal(addLine(full, { stockId: 3, qty: 1, addedPrice: 1 })?.length, 20);
  });
  test('set quantity, remove, count, round trip', () => {
    let lines = [{ stockId: 1, qty: 2, addedPrice: 5 }, { stockId: 2, qty: 1, addedPrice: 7 }];
    lines = setLineQty(lines, 1, 50, 4);
    assert.equal(lines[0].qty, 4);
    lines = removeLine(lines, 2);
    assert.equal(cartCount(lines), 4);
    assert.deepEqual(parseStoredCart(serializeCart(lines)), lines);
    assert.equal(clampQty(0), 1);
    assert.equal(clampQty(NaN), 1);
    assert.equal(clampQty(12.7), 10);
  });
});

/* --------------------------------- Money --------------------------------- */

describe('toMinorUnits', () => {
  const mur = { currency: 'mur', murPerUsd: 46 };
  const usd = { currency: 'usd', murPerUsd: 46 };
  test('MUR: rupees to cents', () => {
    assert.equal(toMinorUnits(85, mur), 8500);
    assert.equal(toMinorUnits(258.75, mur), 25875);
    assert.equal(toMinorUnits(0.285, mur), 29); // float 28.4999... rounds up correctly
    assert.equal(toMinorUnits(1212, mur), 121200);
  });
  test('USD: round(MUR / rate, 2) in cents, half away from zero', () => {
    assert.equal(toMinorUnits(46, usd), 100);
    assert.equal(toMinorUnits(100, usd), 217); // 2.1739 -> 2.17
    assert.equal(toMinorUnits(0.23, usd), 1); // 0.005 -> 0.01
    assert.equal(toMinorUnits(-0.23, usd), -1);
  });
  test('rejects non-finite amounts', () => assert.throws(() => toMinorUnits(NaN, mur)));
  test('expected total = sum of unit minor x qty', () => {
    assert.equal(expectedTotalMinor([{ unitPrice: 258.75, quantity: 2 }, { unitPrice: 85, quantity: 1 }], mur), 60250);
  });
  test('config defaults and env parsing', () => {
    assert.deepEqual(currencyConfig({}), { currency: 'mur', murPerUsd: 46 });
    assert.deepEqual(currencyConfig({ STRIPE_CURRENCY: 'USD', STRIPE_MUR_PER_USD: '45.5' }), { currency: 'usd', murPerUsd: 45.5 });
    assert.deepEqual(currencyConfig({ STRIPE_CURRENCY: 'eur', STRIPE_MUR_PER_USD: '-3' }), { currency: 'mur', murPerUsd: 46 });
  });
});

describe('formatOrderId', () => {
  test('pads to 6 digits with the prefix', () => {
    assert.equal(formatOrderId(1), 'ORD-000001');
    assert.equal(formatOrderId(123456), 'ORD-123456');
    assert.equal(formatOrderId(1234567), 'ORD-1234567');
  });
});

/* ------------------------------- Checkout -------------------------------- */

describe('checkout validation', () => {
  const lines = (arr) => JSON.stringify(arr);
  const delivery = { fulfilment: 'Delivery', street: 'Royal Road', town: 'Curepipe', postCode: '', phone: '+230 5123 4567' };
  const errors = (input) => {
    const r = checkoutSchema.safeParse(input);
    return r.success ? {} : fieldErrorsFrom(r.error);
  };

  test('valid delivery; duplicate stock ids merged', () => {
    const r = checkoutSchema.parse({ ...delivery, lines: lines([{ stockId: 4, qty: 2 }, { stockId: 4, qty: 3 }, { stockId: 9, qty: 1 }]) });
    assert.deepEqual(r.lines, [{ stockId: 4, qty: 5 }, { stockId: 9, qty: 1 }]);
    assert.equal(r.postCode, null);
  });
  test('pickup drops address fields', () => {
    const r = checkoutSchema.parse({ fulfilment: 'Pickup', street: 'x', town: 'y', postCode: '', phone: 'bad', lines: lines([{ stockId: 1, qty: 1 }]) });
    assert.equal(r.street, null);
    assert.equal(r.phone, null);
  });
  test('lines: empty, malformed, qty 0/11, merged over 10, more than 20, price fields ignored', () => {
    assert.ok(errors({ ...delivery, lines: '[]' }).lines);
    assert.ok(errors({ ...delivery, lines: 'nope' }).lines);
    assert.ok(errors({ ...delivery, lines: lines([{ stockId: 1, qty: 0 }]) }).lines);
    assert.ok(errors({ ...delivery, lines: lines([{ stockId: 1, qty: 11 }]) }).lines);
    assert.ok(errors({ ...delivery, lines: lines([{ stockId: 1, qty: 6 }, { stockId: 1, qty: 6 }]) }).lines);
    assert.ok(errors({ ...delivery, lines: lines(Array.from({ length: 21 }, (_, i) => ({ stockId: i + 1, qty: 1 }))) }).lines);
    assert.ok(errors({ ...delivery, lines: lines([{ stockId: -2, qty: 1 }]) }).lines);
    const r = checkoutSchema.parse({ ...delivery, lines: lines([{ stockId: 1, qty: 1, price: 0.01 }]) });
    assert.deepEqual(r.lines, [{ stockId: 1, qty: 1 }]);
  });
  test('delivery requires street, town and a valid phone; lengths enforced', () => {
    const base = { ...delivery, lines: lines([{ stockId: 1, qty: 1 }]) };
    assert.ok(errors({ ...base, street: '' }).street);
    assert.ok(errors({ ...base, town: '' }).town);
    assert.ok(errors({ ...base, phone: '' }).phone);
    assert.ok(errors({ ...base, phone: '12ab' }).phone);
    assert.ok(errors({ ...base, street: 's'.repeat(51) }).street);
    assert.ok(errors({ ...base, town: 't'.repeat(61) }).town);
    assert.ok(errors({ ...base, postCode: 'p'.repeat(11) }).postCode);
    assert.ok(errors({ ...base, fulfilment: 'Drone' }).fulfilment);
  });
  test('order and session ids', () => {
    assert.equal(orderIdSchema.parse('42'), 42);
    for (const bad of ['0', '-1', 'abc', '1e3', '', '12345678901']) assert.equal(orderIdSchema.safeParse(bad).success, false, bad);
    assert.ok(sessionIdSchema.safeParse('cs_test_a1B2c3D4e5F6g7').success);
    assert.equal(sessionIdSchema.safeParse('cs_test_<script>').success, false);
  });
});

describe('create_online_order error mapping', () => {
  const m = (message, details = null, code = 'P0001') => mapCreateOrderError({ code, message, details });
  test('every RPC error code', () => {
    assert.deepEqual(m('INSUFFICIENT_STOCK', 'stock_id 12'), { kind: 'insufficient_stock', stockId: 12 });
    assert.deepEqual(m('INSUFFICIENT_STOCK', null), { kind: 'insufficient_stock', stockId: null });
    assert.deepEqual(m('NO_PROFILE'), { kind: 'no_profile' });
    for (const token of ['INVALID_FULFILMENT', 'MISSING_DELIVERY_DETAILS', 'INVALID_ITEMS', 'INVALID_QUANTITY', 'ITEM_NOT_FOUND']) {
      const r = m(token);
      assert.equal(r.kind, 'error', token);
      assert.ok(r.message.length > 10, token);
    }
    assert.match(m('duplicate key', null, '23505').message, /twice/);
    assert.match(m('value too long', null, '22001').message, /too long/);
    assert.match(m('boom', null, 'XX000').message, /could not start/);
  });
});

/* ------------------------------- Webhook --------------------------------- */

function session(over = {}) {
  return {
    id: 'cs_test_1',
    client_reference_id: '42',
    payment_status: 'paid',
    amount_total: 60250,
    currency: 'mur',
    payment_intent: 'pi_1',
    ...over,
  };
}

function mockDeps(over = {}) {
  const calls = { finalize: [], expire: [], refund: [], logs: [] };
  const deps = {
    currency: 'mur',
    constructEvent: (raw, sig) => {
      if (sig !== 'good') throw new Error('bad signature');
      return JSON.parse(raw);
    },
    expectedAmountMinor: async () => 60250,
    finalize: async (...a) => {
      calls.finalize.push(a);
      return 'paid';
    },
    expire: async (...a) => {
      calls.expire.push(a);
      return true;
    },
    refund: async (...a) => {
      calls.refund.push(a);
    },
    log: (level, message, fields) => calls.logs.push({ level, message, fields }),
    ...over,
  };
  return { deps, calls };
}

const event = (type, obj) => JSON.stringify({ id: 'evt_1', type, data: { object: obj } });

describe('webhook router', () => {
  test('bad or missing signature: 400 and nothing happens', async () => {
    const { deps, calls } = mockDeps();
    assert.equal((await handleStripeWebhook(event('checkout.session.completed', session()), 'bad', deps)).status, 400);
    assert.equal((await handleStripeWebhook(event('checkout.session.completed', session()), null, deps)).status, 400);
    assert.equal(calls.finalize.length + calls.expire.length + calls.refund.length, 0);
  });
  test('completed + paid finalizes with the session and payment intent', async () => {
    const { deps, calls } = mockDeps();
    const r = await handleStripeWebhook(event('checkout.session.completed', session()), 'good', deps);
    assert.deepEqual(r, { status: 200, outcome: 'finalized' });
    assert.deepEqual(calls.finalize, [[42, 'cs_test_1', 'pi_1']]);
  });
  test('payment intent may be an expanded object', () => {
    assert.equal(paymentIntentIdFrom(session({ payment_intent: { id: 'pi_9' } })), 'pi_9');
    assert.equal(orderIdFrom(session({ client_reference_id: '12abc' })), null);
  });
  test('completed but unpaid is ignored (async method finishes later)', async () => {
    const { deps, calls } = mockDeps();
    const r = await handleStripeWebhook(event('checkout.session.completed', session({ payment_status: 'unpaid' })), 'good', deps);
    assert.equal(r.outcome, 'ignored_unpaid');
    assert.equal(calls.finalize.length, 0);
  });
  test('async_payment_succeeded finalizes', async () => {
    const { deps, calls } = mockDeps();
    const r = await handleStripeWebhook(event('checkout.session.async_payment_succeeded', session()), 'good', deps);
    assert.equal(r.outcome, 'finalized');
    assert.equal(calls.finalize.length, 1);
  });
  test('duplicate event: already_paid does nothing more', async () => {
    const { deps, calls } = mockDeps({ finalize: async () => 'already_paid' });
    const r = await handleStripeWebhook(event('checkout.session.completed', session()), 'good', deps);
    assert.deepEqual(r, { status: 200, outcome: 'already_paid' });
    assert.equal(calls.refund.length, 0);
  });
  test('amount or currency mismatch: not finalized, 200 for manual review', async () => {
    for (const over of [{ amount_total: 60249 }, { currency: 'usd' }]) {
      const { deps, calls } = mockDeps();
      const r = await handleStripeWebhook(event('checkout.session.completed', session(over)), 'good', deps);
      assert.deepEqual(r, { status: 200, outcome: 'manual_review' });
      assert.equal(calls.finalize.length, 0);
      assert.equal(calls.logs[0].level, 'error');
      assert.equal(calls.logs[0].fields.order, 42);
    }
  });
  test('refund_required triggers a refund for the payment intent', async () => {
    const { deps, calls } = mockDeps({ finalize: async () => 'refund_required' });
    const r = await handleStripeWebhook(event('checkout.session.completed', session()), 'good', deps);
    assert.deepEqual(r, { status: 200, outcome: 'refunded' });
    assert.deepEqual(calls.refund, [['pi_1', 42]]);
  });
  test('expired and async_payment_failed cancel the order', async () => {
    for (const type of ['checkout.session.expired', 'checkout.session.async_payment_failed']) {
      const { deps, calls } = mockDeps();
      const r = await handleStripeWebhook(event(type, session({ payment_status: 'unpaid' })), 'good', deps);
      assert.deepEqual(r, { status: 200, outcome: 'expired' });
      assert.deepEqual(calls.expire, [[42, 'cs_test_1']]);
    }
  });
  test('other events are ignored with 200', async () => {
    const { deps } = mockDeps();
    assert.deepEqual(await handleStripeWebhook(event('payment_intent.created', {}), 'good', deps), { status: 200, outcome: 'ignored' });
  });
  test('missing order id: 200 and nothing happens', async () => {
    const { deps, calls } = mockDeps();
    const r = await handleStripeWebhook(event('checkout.session.completed', session({ client_reference_id: null })), 'good', deps);
    assert.equal(r.outcome, 'ignored_no_order');
    assert.equal(calls.finalize.length, 0);
  });
  test('database or Stripe failure: 500 so Stripe retries', async () => {
    const boom = async () => {
      throw new Error('network down');
    };
    for (const over of [{ expectedAmountMinor: boom }, { finalize: boom }, { expire: boom }]) {
      const { deps } = mockDeps(over);
      const type = over.expire ? 'checkout.session.expired' : 'checkout.session.completed';
      const r = await handleStripeWebhook(event(type, session()), 'good', deps);
      assert.deepEqual(r, { status: 500, outcome: 'error' });
    }
    const { deps } = mockDeps({ finalize: async () => 'refund_required', refund: boom });
    assert.equal((await handleStripeWebhook(event('checkout.session.completed', session()), 'good', deps)).status, 500);
  });
  test('permanent finalize errors are not retried', async () => {
    for (const msg of ['finalize_online_order: ORDER_NOT_FOUND', 'finalize_online_order: SESSION_MISMATCH']) {
      const { deps } = mockDeps({ finalize: async () => { throw new Error(msg); } });
      const r = await handleStripeWebhook(event('checkout.session.completed', session()), 'good', deps);
      assert.deepEqual(r, { status: 200, outcome: 'manual_review' });
    }
  });
  test('logs never include the raw body', async () => {
    const { deps, calls } = mockDeps();
    await handleStripeWebhook(event('checkout.session.completed', session({ customer_email: 'x@y.z' })), 'good', deps);
    assert.ok(!JSON.stringify(calls.logs).includes('x@y.z'));
  });
});
