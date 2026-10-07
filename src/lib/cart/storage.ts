// Cart storage format and pure operations. The browser keeps only stock ids, quantities
// and the price seen when the item was added; everything else is re-read from the database.
// Stored data is never trusted: it is validated, clamped and merged on every load.

import { MAX_CART_LINES, MAX_LINE_QTY } from '@/config/shop';

export const CART_STORAGE_KEY = 'motohub-cart-v1';
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
