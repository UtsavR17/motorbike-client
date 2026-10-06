'use client';

import Link from 'next/link';
import { ArrowRight, ShoppingCart, Trash2, TriangleAlert } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { EmptyState } from '@/components/ui/EmptyState';
import { ProductImage } from '@/components/ui/ProductImage';
import { StockBadge } from '@/components/ui/StockBadge';
import { getCartItemsAction, type CartItemInfo } from '@/lib/actions/cart';
import { formatMoney } from '@/lib/format';
import { useCart } from './CartProvider';
import { QuantityStepper } from './QuantityStepper';

export interface CartIssue {
  stockId: number | null;
}

/** Cart lines joined with fresh catalogue data. Shared by /cart and /checkout. */
export function useCartItems() {
  const { lines, ready } = useCart();
  const ids = useMemo(() => lines.map((l) => l.stockId).sort((a, b) => a - b).join(','), [lines]);
  const [state, setState] = useState<{ ids: string; items: CartItemInfo[] | null; failed: boolean }>({
    ids: '',
    items: null,
    failed: false,
  });

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    const stockIds = ids ? ids.split(',').map(Number) : [];
    getCartItemsAction(stockIds)
      .then((items) => !cancelled && setState({ ids, items, failed: false }))
      .catch(() => !cancelled && setState({ ids, items: [], failed: true }));
    return () => {
      cancelled = true;
    };
  }, [ids, ready]);

  const loading = !ready || state.ids !== ids || state.items === null;
  const byId = new Map((state.items ?? []).map((i) => [i.stockId, i]));
  const rows = lines.map((line) => {
    const info = byId.get(line.stockId) ?? null;
    const problem: 'missing' | 'out_of_stock' | 'too_many' | null = !info
      ? state.failed
        ? null // Lookup failed: we cannot tell, so do not claim the item is gone.
        : 'missing'
      : info.maxQty <= 0
        ? 'out_of_stock'
        : line.qty > info.maxQty
          ? 'too_many'
          : null;
    return { line, info, problem };
  });
  const subtotal = rows.reduce((sum, r) => (r.info && !r.problem ? sum + r.info.price * r.line.qty : sum), 0);
  const blocked = state.failed || rows.some((r) => r.problem !== null || !r.info);
  return { ready, loading, failed: state.failed, rows, subtotal, blocked };
}

export function CartView({ signedIn, issue }: { signedIn: boolean; issue: CartIssue | null }) {
  const { setQty, remove } = useCart();
  const { ready, loading, failed, rows, subtotal, blocked } = useCartItems();

  if (!ready || (loading && rows.length > 0)) {
    return (
      <div role="status" aria-label="Loading your cart" className="card h-48 animate-pulse">
        <span className="sr-only">Loading your cart</span>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={ShoppingCart}
        title="Your cart is empty"
        action={<Link href="/parts" className="btn-primary h-11">Browse parts</Link>}
      >
        Find parts for your bike and add them here.
      </EmptyState>
    );
  }

  const issueItem = issue ? rows.find((r) => r.line.stockId === issue.stockId) : undefined;
  const checkoutHref = signedIn ? '/checkout' : `/login?next=${encodeURIComponent('/checkout')}`;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px] lg:items-start">
      <section aria-labelledby="cart-lines-heading" className="space-y-4">
        <h2 id="cart-lines-heading" className="sr-only">Items</h2>
        {issue && (
          <div role="alert" className="flex gap-2 rounded-control bg-warn-soft px-4 py-3 text-sm font-medium text-warn">
            <TriangleAlert aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              {issueItem?.info
                ? `There is not enough stock of ${issueItem.info.name} (${issueItem.info.brand}) for your order. Please reduce the quantity or remove it.`
                : 'One of the items in your cart no longer has enough stock. Please review your cart.'}
            </span>
          </div>
        )}
        {failed && (
          <p role="alert" className="rounded-control bg-bad-soft px-4 py-3 text-sm font-medium text-bad">
            We could not check prices and stock right now. Please refresh the page.
          </p>
        )}

        <ul className="space-y-3">
          {rows.map(({ line, info, problem }) => {
            const name = info ? info.name : 'Item no longer available';
            const href = info ? `/parts/${info.partId}?brand=${info.brandId}&variant=${info.stockId}` : null;
            const priceChanged = info && line.addedPrice > 0 && Math.abs(line.addedPrice - info.price) >= 0.005;
            return (
              <li key={line.stockId} className={`card flex gap-4 p-4 ${problem ? 'border-warn' : ''}`}>
                <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-control border border-line sm:h-24 sm:w-24">
                  <ProductImage src={info?.imageUrl} alt={name} sizes="96px" />
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-semibold leading-snug">
                        {href ? <Link href={href} className="hover:text-accent-strong hover:underline">{name}</Link> : name}
                      </h3>
                      {info && (
                        <p className="text-sm text-ink-muted">
                          {info.brand}
                          {info.size !== 'Standard' ? `, size ${info.size}` : ''}
                        </p>
                      )}
                    </div>
                    {info && <p className="font-bold">{formatMoney(info.price)}</p>}
                  </div>

                  {priceChanged && (
                    <p className="text-sm font-medium text-warn">
                      Price changed from {formatMoney(line.addedPrice)} to {formatMoney(info.price)}.
                    </p>
                  )}
                  {info && <div><StockBadge status={info.stockStatus} /></div>}
                  {problem === 'missing' && <p className="text-sm font-medium text-bad">This item is no longer sold. Please remove it.</p>}
                  {problem === 'out_of_stock' && <p className="text-sm font-medium text-bad">Out of stock. Remove it to continue to checkout.</p>}
                  {problem === 'too_many' && info && (
                    <p className="text-sm font-medium text-warn">Only {info.maxQty} available. Reduce the quantity to continue.</p>
                  )}

                  <div className="mt-auto flex flex-wrap items-center justify-between gap-3">
                    {info && info.maxQty > 0 ? (
                      <QuantityStepper
                        value={line.qty}
                        max={Math.max(info.maxQty, line.qty)}
                        onChange={(q) => setQty(line.stockId, Math.min(q, info.maxQty))}
                        label={`quantity of ${name}`}
                      />
                    ) : (
                      <span className="text-sm text-ink-muted">Quantity: {line.qty}</span>
                    )}
                    <div className="flex items-center gap-3">
                      {info && !problem && <span className="text-sm text-ink-muted">Line total {formatMoney(info.price * line.qty)}</span>}
                      <button type="button" onClick={() => remove(line.stockId)}
                        className="btn h-10 border border-line bg-card px-3 text-bad hover:border-bad">
                        <Trash2 aria-hidden="true" className="h-4 w-4" />
                        Remove<span className="sr-only"> {name}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
        <Link href="/parts" className="link inline-block text-sm">Continue shopping</Link>
      </section>

      <aside aria-labelledby="summary-heading" className="card space-y-4 p-5 lg:sticky lg:top-32">
        <h2 id="summary-heading" className="text-lg font-semibold">Summary</h2>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between"><dt className="text-ink-muted">Subtotal</dt><dd className="font-semibold">{formatMoney(subtotal)}</dd></div>
          <div className="flex justify-between"><dt className="text-ink-muted">Delivery</dt><dd className="font-semibold">Free</dd></div>
        </dl>
        <div className="flex justify-between border-t border-line pt-3 text-base">
          <span className="font-semibold">Total</span>
          <span className="font-bold">{formatMoney(subtotal)}</span>
        </div>
        {blocked ? (
          <>
            <button type="button" disabled className="btn-primary h-11 w-full">Proceed to checkout</button>
            <p className="text-sm text-warn">Fix the highlighted items to continue.</p>
          </>
        ) : (
          <Link href={checkoutHref} className="btn-primary h-11 w-full">
            Proceed to checkout
            <ArrowRight aria-hidden="true" className="h-4 w-4" />
          </Link>
        )}
        {!signedIn && <p className="text-xs text-ink-muted">You will be asked to sign in before paying.</p>}
        <p className="text-xs text-ink-muted">Prices are checked again when you pay.</p>
      </aside>
    </div>
  );
}
