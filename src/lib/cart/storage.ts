// Cart storage format and pure operations. The browser keeps only stock ids, quantities
// and the price seen when the item was added; everything else is re-read from the database.
// Stored data is never trusted: it is validated, clamped and merged on every load.

import { MAX_CART_LINES, MAX_LINE_QTY } from '@/config/shop';

// Carts are stored on the device, one per account (DEC-10): "motohub-cart-v2:<userId>" for a
// signed-in customer and "motohub-cart-v2:guest" for guests. They do not roam between devices.
export const CART_KEY_PREFIX = 'motohub-cart-v2:';
export const GUEST_OWNER = 'guest';
/** Pre-v2 single cart (owner unknown): deleted on first load, never imported. */
export const LEGACY_CART_KEY = 'motohub-cart-v1';
/** The account whose cart was last shown on this device; used to clear it after sign-out. */
export const LAST_OWNER_KEY = 'motohub-cart-owner';
/** Ignore stored carts larger than this many characters (corrupt or tampered data). */
const MAX_STORED_LENGTH = 10_000;

export interface CartLine {
  stockId: number;
  qty: number;
  /** Price (Rs.) when the item was added; only used to show "price changed" notices. */
  addedPrice: number;
}

function isStockId(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v > 0 && v <= 2_147_483_647;
}

export function clampQty(qty: number, max: number = MAX_LINE_QTY): number {
  if (!Number.isFinite(qty)) return 1;
  return Math.min(Math.max(Math.trunc(qty), 1), Math.max(1, Math.min(max, MAX_LINE_QTY)));
}

/** Merges duplicate stock ids (quantities add up, capped) and keeps at most MAX_CART_LINES. */
export function normaliseCart(lines: CartLine[]): CartLine[] {
  const out: CartLine[] = [];
  for (const line of lines) {
    const existing = out.find((l) => l.stockId === line.stockId);
    if (existing) {
      existing.qty = clampQty(existing.qty + line.qty);
    } else if (out.length < MAX_CART_LINES) {
      out.push({ stockId: line.stockId, qty: clampQty(line.qty), addedPrice: line.addedPrice });
    }
  }
  return out;
}

/** Parses the stored JSON. Malformed entries are dropped; malformed or oversized data gives []. */
export function parseStoredCart(raw: string | null | undefined): CartLine[] {
  if (!raw || raw.length > MAX_STORED_LENGTH) return [];
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(data)) return [];
  const lines: CartLine[] = [];
  for (const item of data.slice(0, MAX_CART_LINES * 2)) {
    if (!item || typeof item !== 'object') continue;
    const { stockId, qty, addedPrice } = item as Record<string, unknown>;
    if (!isStockId(stockId)) continue;
    if (typeof qty !== 'number' || !Number.isFinite(qty) || qty < 1) continue;
    const price = typeof addedPrice === 'number' && Number.isFinite(addedPrice) && addedPrice >= 0 ? addedPrice : 0;
    lines.push({ stockId, qty, addedPrice: price });
  }
  return normaliseCart(lines);
}

export function serializeCart(lines: CartLine[]): string {
  return JSON.stringify(lines.map(({ stockId, qty, addedPrice }) => ({ stockId, qty, addedPrice })));
}

/** Adds qty of a stock item (merging with an existing line). Returns null when the cart is full. */
export function addLine(lines: CartLine[], line: CartLine): CartLine[] | null {
  if (!isStockId(line.stockId)) return lines;
  const exists = lines.some((l) => l.stockId === line.stockId);
  if (!exists && lines.length >= MAX_CART_LINES) return null;
  return normaliseCart([...lines, { ...line, qty: clampQty(line.qty) }]);
}

export function setLineQty(lines: CartLine[], stockId: number, qty: number, max?: number): CartLine[] {
  return lines.map((l) => (l.stockId === stockId ? { ...l, qty: clampQty(qty, max) } : l));
}

export function removeLine(lines: CartLine[], stockId: number): CartLine[] {
  return lines.filter((l) => l.stockId !== stockId);
}

export function cartCount(lines: CartLine[]): number {
  return lines.reduce((n, l) => n + l.qty, 0);
}

/* --------------------------- Per-owner storage --------------------------- */

/** Minimal Storage interface (window.localStorage, or a fake in tests). */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** Storage key of an owner's cart; null or '' is the guest. */
export function cartKey(ownerId: string | null | undefined): string {
  return CART_KEY_PREFIX + (ownerId ? ownerId : GUEST_OWNER);
}

export function readCart(store: KeyValueStore, ownerId: string | null): CartLine[] {
  return parseStoredCart(store.getItem(cartKey(ownerId)));
}

export function writeCart(store: KeyValueStore, ownerId: string | null, lines: CartLine[]): void {
  if (lines.length === 0) store.removeItem(cartKey(ownerId));
  else store.setItem(cartKey(ownerId), serializeCart(lines));
}

/** Guest lines added to the user's cart: quantities add up per stock id, line and cart limits apply. */
export function mergeCarts(user: CartLine[], guest: CartLine[]): CartLine[] {
  return normaliseCart([...user, ...guest]);
}

/**
 * Brings the device in line with the current owner (call on load and whenever it changes):
 * - deletes the legacy single cart (owner unknown, never imported);
 * - deletes the cart of a previous signed-in owner that is no longer the current one
 *   (sign-out, session expiry or another account signing in on this device);
 * - for a signed-in owner, merges the guest cart into theirs and deletes the guest cart.
 * Returns true when anything changed.
 */
export function syncCartOwner(store: KeyValueStore, ownerId: string | null): boolean {
  let changed = false;
  if (store.getItem(LEGACY_CART_KEY) !== null) {
    store.removeItem(LEGACY_CART_KEY);
    changed = true;
  }
  const previous = store.getItem(LAST_OWNER_KEY) || null;
  if (previous && previous !== ownerId) {
    if (store.getItem(cartKey(previous)) !== null) changed = true;
    store.removeItem(cartKey(previous));
    // Payment tracking belongs to that account too.
    store.removeItem(clearedOrdersKey(previous));
  }
  if (ownerId) {
    const guest = readCart(store, null);
    if (guest.length > 0) {
      writeCart(store, ownerId, mergeCarts(readCart(store, ownerId), guest));
      store.removeItem(cartKey(null));
      changed = true;
    }
    store.setItem(LAST_OWNER_KEY, ownerId);
  } else if (previous) {
    store.removeItem(LAST_OWNER_KEY);
  }
  return changed;
}

/** Clears the signed-in owner's cart on sign-out (before the page reloads). */
export function clearOwnerCart(store: KeyValueStore, ownerId: string | null): void {
  store.removeItem(cartKey(ownerId));
  if (ownerId) {
    store.removeItem(clearedOrdersKey(ownerId));
    store.removeItem(LAST_OWNER_KEY);
  }
}

/* ------------------- Cleared-once tracking after payment ------------------ */

export function clearedOrdersKey(ownerId: string | null): string {
  return `motohub-cart-cleared-orders:${ownerId ? ownerId : GUEST_OWNER}`;
}

/**
 * Clears the owner's cart once per paid order. Returns true when it cleared now; a later visit
 * to the same success page does not wipe a newer cart.
 */
export function clearCartOncePerOrder(store: KeyValueStore, ownerId: string | null, orderId: number): boolean {
  let done: number[] = [];
  try {
    const parsed = JSON.parse(store.getItem(clearedOrdersKey(ownerId)) ?? '[]') as unknown;
    done = Array.isArray(parsed) ? parsed.filter((n): n is number => typeof n === 'number') : [];
  } catch {
    done = [];
  }
  if (done.includes(orderId)) return false;
  store.removeItem(cartKey(ownerId));
  store.setItem(clearedOrdersKey(ownerId), JSON.stringify([...done, orderId].slice(-20)));
  return true;
}
