'use client';

import Link from 'next/link';
import { ShoppingCart } from 'lucide-react';
import { useCart } from './CartProvider';

/** Header cart link with an item count (rendered only after mount to avoid hydration mismatch). */
export function CartBadge() {
  const { count, ready } = useCart();
  const shown = ready && count > 0;
  return (
    <Link
      href="/cart"
      className="relative inline-flex h-10 w-10 items-center justify-center rounded-control text-white/90 hover:bg-white/10 hover:text-white"
    >
      <ShoppingCart aria-hidden="true" className="h-5 w-5" />
      <span className="sr-only">{shown ? `Cart, ${count} ${count === 1 ? 'item' : 'items'}` : 'Cart'}</span>
      {shown && (
        <span
          aria-hidden="true"
          className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-xs font-bold text-ink"
        >
          {count > 99 ? '99+' : count}
        </span>
      )}
    </Link>
  );
}
