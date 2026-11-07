// Unit tests for per-owner cart storage (DEC-10, ISS-09). Fake key-value store; no browser.
// Run: npm test

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { MAX_CART_LINES, MAX_LINE_QTY } from '../src/config/shop.ts';
import {
  LAST_OWNER_KEY,
  LEGACY_CART_KEY,
  cartKey,
  clearCartOncePerOrder,
  clearOwnerCart,
  clearedOrdersKey,
  mergeCarts,
  readCart,
  serializeCart,
  syncCartOwner,
  writeCart,
} from '../src/lib/cart/storage.ts';

function fakeStore(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    map,
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
}

const line = (stockId, qty, addedPrice = 100) => ({ stockId, qty, addedPrice });
const A = 'user-a';
const B = 'user-b';

describe('cart keys', () => {
  test('one key per owner, guest for null or empty', () => {
    assert.equal(cartKey(A), 'motohub-cart-v2:user-a');
    assert.equal(cartKey(null), 'motohub-cart-v2:guest');
    assert.equal(cartKey(''), 'motohub-cart-v2:guest');
    assert.equal(clearedOrdersKey(A), 'motohub-cart-cleared-orders:user-a');
  });

  test('load and save per owner; owners never see each other', () => {
    const store = fakeStore();
    writeCart(store, A, [line(1, 2)]);
    writeCart(store, B, [line(9, 1)]);
    assert.deepEqual(readCart(store, A), [line(1, 2)]);
    assert.deepEqual(readCart(store, B), [line(9, 1)]);
    assert.deepEqual(readCart(store, null), []);
    writeCart(store, A, []);
    assert.equal(store.getItem(cartKey(A)), null);
  });

  test('stored data is still validated', () => {
    const store = fakeStore({ [cartKey(A)]: '[{"stockId":-1,"qty":2},{"stockId":3,"qty":99},"x"]' });
    assert.deepEqual(readCart(store, A), [{ stockId: 3, qty: MAX_LINE_QTY, addedPrice: 0 }]);
    store.setItem(cartKey(B), 'not json');
    assert.deepEqual(readCart(store, B), []);
  });
});

describe('syncCartOwner', () => {
  test('legacy v1 cart is deleted, never imported', () => {
    const store = fakeStore({ [LEGACY_CART_KEY]: serializeCart([line(5, 3)]) });
    assert.equal(syncCartOwner(store, A), true);
    assert.equal(store.getItem(LEGACY_CART_KEY), null);
    assert.deepEqual(readCart(store, A), []);
    assert.deepEqual(readCart(store, null), []);
  });

  test('login merges the guest cart into the user cart and clears the guest key', () => {
    const store = fakeStore({
      [cartKey(null)]: serializeCart([line(1, 2), line(2, 1)]),
      [cartKey(A)]: serializeCart([line(1, 3), line(7, 1)]),
    });
    assert.equal(syncCartOwner(store, A), true);
    assert.deepEqual(readCart(store, A), [line(1, 5), line(7, 1), line(2, 1)]);
    assert.equal(store.getItem(cartKey(null)), null);
    assert.equal(store.getItem(LAST_OWNER_KEY), A);
  });

  test('merge respects the per-line and per-cart caps', () => {
    const user = Array.from({ length: MAX_CART_LINES - 1 }, (_, i) => line(i + 1, 1));
    const guest = [line(1, MAX_LINE_QTY), line(500, 1), line(501, 1)];
    const merged = mergeCarts(user, guest);
    assert.equal(merged.length, MAX_CART_LINES);
    assert.equal(merged.find((l) => l.stockId === 1).qty, MAX_LINE_QTY);
    assert.ok(merged.some((l) => l.stockId === 500));
    assert.ok(!merged.some((l) => l.stockId === 501));
  });

  test('logout (owner becomes guest) removes the previous account cart', () => {
    const store = fakeStore({ [cartKey(A)]: serializeCart([line(1, 2)]), [LAST_OWNER_KEY]: A });
    assert.equal(syncCartOwner(store, null), true);
    assert.equal(store.getItem(cartKey(A)), null);
    assert.equal(store.getItem(LAST_OWNER_KEY), null);
    assert.deepEqual(readCart(store, null), []);
  });

  test('customer B signing in after A on the same device never sees A items', () => {
    const store = fakeStore({ [cartKey(A)]: serializeCart([line(1, 2)]), [LAST_OWNER_KEY]: A });
    syncCartOwner(store, B);
    assert.deepEqual(readCart(store, B), []);
    assert.equal(store.getItem(cartKey(A)), null);
    assert.equal(store.getItem(LAST_OWNER_KEY), B);
  });

  test('same owner again changes nothing', () => {
    const store = fakeStore({ [cartKey(A)]: serializeCart([line(1, 2)]), [LAST_OWNER_KEY]: A });
    assert.equal(syncCartOwner(store, A), false);
    assert.deepEqual(readCart(store, A), [line(1, 2)]);
  });

  test('guest with no previous owner keeps the guest cart', () => {
    const store = fakeStore({ [cartKey(null)]: serializeCart([line(4, 1)]) });
    assert.equal(syncCartOwner(store, null), false);
    assert.deepEqual(readCart(store, null), [line(4, 1)]);
  });
});

describe('clearing', () => {
  test('clearOwnerCart on sign-out removes only that account', () => {
    const store = fakeStore({
      [cartKey(A)]: serializeCart([line(1, 2)]),
      [cartKey(null)]: serializeCart([line(2, 1)]),
      [clearedOrdersKey(A)]: '[1]',
      [LAST_OWNER_KEY]: A,
    });
    clearOwnerCart(store, A);
    assert.equal(store.getItem(cartKey(A)), null);
    assert.equal(store.getItem(clearedOrdersKey(A)), null);
    assert.equal(store.getItem(LAST_OWNER_KEY), null);
    assert.deepEqual(readCart(store, null), [line(2, 1)]);
  });

  test('after payment only the current owner cart is cleared, once per order', () => {
    const store = fakeStore({
      [cartKey(A)]: serializeCart([line(1, 2)]),
      [cartKey(B)]: serializeCart([line(9, 1)]),
    });
    assert.equal(clearCartOncePerOrder(store, A, 12), true);
    assert.deepEqual(readCart(store, A), []);
    assert.deepEqual(readCart(store, B), [line(9, 1)]);
    writeCart(store, A, [line(3, 1)]);                    // new cart after paying
    assert.equal(clearCartOncePerOrder(store, A, 12), false);
    assert.deepEqual(readCart(store, A), [line(3, 1)]);
    assert.equal(clearCartOncePerOrder(store, B, 12), true); // tracking is per owner
  });

  test('corrupt tracking data does not block clearing', () => {
    const store = fakeStore({ [cartKey(A)]: serializeCart([line(1, 2)]), [clearedOrdersKey(A)]: '{bad' });
    assert.equal(clearCartOncePerOrder(store, A, 5), true);
    assert.deepEqual(readCart(store, A), []);
  });
});
