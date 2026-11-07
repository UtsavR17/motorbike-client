'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import {
  addLine,
  cartCount,
  cartKey,
  clearCartOncePerOrder,
  clearOwnerCart,
  parseStoredCart,
  removeLine,
  setLineQty,
  syncCartOwner,
  writeCart,
  type CartLine,
  type KeyValueStore,
} from '@/lib/cart/storage';
import { createClient } from '@/lib/supabase/client';

/* ------------------------- localStorage-backed store ------------------------ */
// One cart per owner on this device (DEC-10): the signed-in user's id, or the guest.

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

/** window.localStorage, or null when storage is blocked (private mode, policies). */
function storage(): KeyValueStore | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function readRaw(ownerId: string | null): string | null {
  try {
    return storage()?.getItem(cartKey(ownerId)) ?? null;
  } catch {
    return null; // Behave as an empty cart.
  }
}

function writeLines(ownerId: string | null, lines: CartLine[]) {
  try {
    const store = storage();
    if (store) writeCart(store, ownerId, lines);
  } catch {
    // Ignore: the cart simply will not persist.
  }
  notify();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Keep tabs in sync (an owner's cart cleared in one tab empties the badge in the others).
  const onStorage = () => listener();
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
  /** Clears this owner's cart once per paid order (owner-scoped tracking). */
  clearForOrder(orderId: number): void;
  /** Called just before signing out: removes this account's cart from the device. */
  clearOnSignOut(): void;
}

const CartContext = createContext<CartApi | null>(null);

/**
 * ownerId comes from the server layout (the signed-in user's id, or null for guests), so the
 * browser makes no extra request to know whose cart to show.
 */
export function CartProvider({ ownerId, children }: { ownerId: string | null; children: ReactNode }) {
  const getSnapshot = useCallback(() => readRaw(ownerId), [ownerId]);
  const raw = useSyncExternalStore(subscribe, getSnapshot, () => null);
  const ready = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const lines = useMemo(() => parseStoredCart(raw), [raw]);

  // On load and whenever the owner changes: drop the legacy cart and a previous account's
  // cart, and merge the guest cart into a signed-in user's cart.
  useEffect(() => {
    try {
      const store = storage();
      if (store && syncCartOwner(store, ownerId)) notify();
    } catch {
      // Storage unavailable: nothing to sync.
    }
  }, [ownerId]);

  // Second path for sign-out: the browser client reports SIGNED_OUT (for example after the
  // session ends in another tab). The server path is clearOnSignOut + the owner change above.
  useEffect(() => {
    if (!ownerId) return;
    let unsubscribe: (() => void) | undefined;
    try {
      const { data } = createClient().auth.onAuthStateChange((event) => {
        if (event === 'SIGNED_OUT') {
          const store = storage();
          if (store) clearOwnerCart(store, ownerId);
          notify();
        }
      });
      unsubscribe = () => data.subscription.unsubscribe();
    } catch {
      // Supabase env missing in the browser: the owner-change path still applies.
    }
    return () => unsubscribe?.();
  }, [ownerId]);

  const add = useCallback<CartApi['add']>(
    (stockId, qty, price, maxQty) => {
      const current = parseStoredCart(readRaw(ownerId));
      const existing = current.find((l) => l.stockId === stockId)?.qty ?? 0;
      if (existing >= maxQty) return 'at_max';
      const next = addLine(current, { stockId, qty: Math.min(qty, maxQty - existing), addedPrice: price });
      if (!next) return 'full';
      writeLines(ownerId, next);
      return 'added';
    },
    [ownerId],
  );

  const setQty = useCallback<CartApi['setQty']>(
    (stockId, qty, maxQty) => writeLines(ownerId, setLineQty(parseStoredCart(readRaw(ownerId)), stockId, qty, maxQty)),
    [ownerId],
  );

  const remove = useCallback(
    (stockId: number) => writeLines(ownerId, removeLine(parseStoredCart(readRaw(ownerId)), stockId)),
    [ownerId],
  );

  const clear = useCallback(() => writeLines(ownerId, []), [ownerId]);

  const clearForOrder = useCallback(
    (orderId: number) => {
      try {
        const store = storage();
        if (store && clearCartOncePerOrder(store, ownerId, orderId)) notify();
      } catch {
        writeLines(ownerId, []);
      }
    },
    [ownerId],
  );

  const clearOnSignOut = useCallback(() => {
    try {
      const store = storage();
      if (store) clearOwnerCart(store, ownerId);
    } catch {
      // Ignore: the owner change after sign-out clears it as well.
    }
    notify();
  }, [ownerId]);

  const value = useMemo<CartApi>(
    () => ({ lines, count: cartCount(lines), ready, add, setQty, remove, clear, clearForOrder, clearOnSignOut }),
    [lines, ready, add, setQty, remove, clear, clearForOrder, clearOnSignOut],
  );
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartApi {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside CartProvider');
  return ctx;
}
