'use client';

import { createContext, useCallback, useContext, useMemo, useSyncExternalStore, type ReactNode } from 'react';
import {
  CART_STORAGE_KEY,
  addLine,
  cartCount,
  parseStoredCart,
  removeLine,
  serializeCart,
  setLineQty,
  type CartLine,
} from '@/lib/cart/storage';

/* ------------------------- localStorage-backed store ------------------------ */

const listeners = new Set<() => void>();

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(CART_STORAGE_KEY);
  } catch {
    return null; // Storage blocked (private mode, policies): behave as an empty cart.
  }
}

function writeLines(lines: CartLine[]) {
  try {
    if (lines.length === 0) window.localStorage.removeItem(CART_STORAGE_KEY);
    else window.localStorage.setItem(CART_STORAGE_KEY, serializeCart(lines));
  } catch {
    // Ignore: the cart simply will not persist.
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Keep tabs in sync.
  const onStorage = (e: StorageEvent) => {
    if (e.key === null || e.key === CART_STORAGE_KEY) listener();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

const noopSubscribe = () => () => {};

/* -------------------------------- Context -------------------------------- */

interface CartApi {
  lines: CartLine[];
  count: number;
  /** False during server rendering and hydration; render counts only when true. */
  ready: boolean;
  /** Adds qty, capped at maxQty for that line. Returns "full" when the cart has no room. */
  add(stockId: number, qty: number, price: number, maxQty: number): 'added' | 'at_max' | 'full';
  setQty(stockId: number, qty: number, maxQty?: number): void;
  remove(stockId: number): void;
  clear(): void;
}

const CartContext = createContext<CartApi | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const raw = useSyncExternalStore(subscribe, readRaw, () => null);
  const ready = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const lines = useMemo(() => parseStoredCart(raw), [raw]);

  const add = useCallback<CartApi['add']>((stockId, qty, price, maxQty) => {
    const current = parseStoredCart(readRaw());
    const existing = current.find((l) => l.stockId === stockId)?.qty ?? 0;
    if (existing >= maxQty) return 'at_max';
    const next = addLine(current, { stockId, qty: Math.min(qty, maxQty - existing), addedPrice: price });
    if (!next) return 'full';
    writeLines(next);
    return 'added';
  }, []);

  const setQty = useCallback<CartApi['setQty']>((stockId, qty, maxQty) => {
    writeLines(setLineQty(parseStoredCart(readRaw()), stockId, qty, maxQty));
  }, []);

  const remove = useCallback((stockId: number) => {
    writeLines(removeLine(parseStoredCart(readRaw()), stockId));
  }, []);

  const clear = useCallback(() => writeLines([]), []);

  const value = useMemo<CartApi>(
    () => ({ lines, count: cartCount(lines), ready, add, setQty, remove, clear }),
    [lines, ready, add, setQty, remove, clear],
  );
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartApi {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside CartProvider');
  return ctx;
}
