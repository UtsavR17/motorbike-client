'use client';

import Link from 'next/link';
import { CheckCircle2, ShoppingCart } from 'lucide-react';
import { useState } from 'react';
import { MAX_CART_LINES } from '@/config/shop';
import { useCart } from './CartProvider';
import { QuantityStepper } from './QuantityStepper';

interface AddToCartProps {
  stockId: number;
  name: string;
  price: number;
  /** min(qty_available, MAX_LINE_QTY); 0 when the selected variant is out of stock. */
  maxQty: number;
}

/** Quantity stepper + "Add to cart" for the selected variant, with a confirmation message. */
export function AddToCart({ stockId, name, price, maxQty }: AddToCartProps) {
  const { add, lines, ready } = useCart();
  const [qty, setQty] = useState(1);
  const [message, setMessage] = useState<{ tone: 'ok' | 'warn'; text: string } | null>(null);
  const inCart = ready ? (lines.find((l) => l.stockId === stockId)?.qty ?? 0) : 0;
  const outOfStock = maxQty <= 0;

  function onAdd() {
    const amount = Math.min(qty, maxQty);
    const result = add(stockId, amount, price, maxQty);
    if (result === 'added') {
      const added = Math.min(amount, maxQty - inCart);
      setMessage({ tone: 'ok', text: `Added ${added} x ${name} to your cart.` });
      setQty(1);
    } else if (result === 'at_max') {
      setMessage({ tone: 'warn', text: `Your cart already has the most we can sell of this item (${maxQty}).` });
    } else {
      setMessage({ tone: 'warn', text: `Your cart is full (${MAX_CART_LINES} different items). Remove something first.` });
    }
  }

  if (outOfStock) {
    return (
      <div>
        <button type="button" disabled className="btn-primary h-11 w-full sm:w-auto">
          <ShoppingCart aria-hidden="true" className="h-4 w-4" />
          Out of stock
        </button>
        <p className="mt-2 text-sm text-ink-muted">This option is out of stock. Choose another option or check back soon.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="add-qty" className="field-label">Quantity</label>
          <QuantityStepper id="add-qty" value={Math.min(qty, maxQty)} max={maxQty} onChange={setQty} label="quantity" />
        </div>
        <button type="button" onClick={onAdd} className="btn-primary h-11 flex-1 sm:flex-none">
          <ShoppingCart aria-hidden="true" className="h-4 w-4" />
          Add to cart
        </button>
      </div>
      {inCart > 0 && <p className="text-sm text-ink-muted">{inCart} already in your cart.</p>}
      <div role="status" aria-live="polite">
        {message && (
          <div
            className={`flex flex-wrap items-center gap-x-3 gap-y-1 rounded-control px-3 py-2.5 text-sm font-medium ${
              message.tone === 'ok' ? 'bg-ok-soft text-ok' : 'bg-warn-soft text-warn'
            }`}
          >
            {message.tone === 'ok' && <CheckCircle2 aria-hidden="true" className="h-4 w-4" />}
            <span>{message.text}</span>
            <Link href="/cart" className="font-semibold underline underline-offset-4">View cart</Link>
          </div>
        )}
      </div>
    </div>
  );
}
