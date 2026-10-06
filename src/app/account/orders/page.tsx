import type { Metadata } from 'next';
import Link from 'next/link';
import { Package } from 'lucide-react';
import { CancelOrderButton } from '@/components/orders/CancelOrderButton';
import { OrderStatusBadge } from '@/components/orders/OrderStatusBadge';
import { estimateText } from '@/components/orders/OrderSummary';
import { EmptyState } from '@/components/ui/EmptyState';
import { listMyOrders } from '@/lib/account/orders';
import { requireCustomer } from '@/lib/auth/session';
import { formatDate, formatMoney, formatOrderId } from '@/lib/format';

export const metadata: Metadata = { title: 'My orders' };

export default async function OrdersPage() {
  await requireCustomer('/account/orders');
  const orders = await listMyOrders();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">My orders</h1>
        <p className="mt-1 text-ink-muted">Your spare part orders, newest first.</p>
      </div>

      {orders.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No orders yet"
          action={<Link href="/parts" className="btn-primary h-11">Browse parts</Link>}
        >
          When you order parts online they will appear here.
        </EmptyState>
      ) : (
        <ul className="space-y-3">
          {orders.map((o) => (
            <li key={o.id} className="card p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold">
                    <Link href={`/account/orders/${o.id}`} className="hover:text-accent-strong hover:underline">
                      {formatOrderId(o.id)}
                    </Link>
                  </h2>
                  <p className="text-sm text-ink-muted">Placed {formatDate(o.date) ?? 'recently'}</p>
                </div>
                <OrderStatusBadge status={o.status} />
              </div>
              <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
                <div>
                  <dt className="text-ink-muted">Total</dt>
                  <dd className="font-semibold">{formatMoney(o.total)}</dd>
                </div>
                <div>
                  <dt className="text-ink-muted">Fulfilment</dt>
                  <dd className="font-semibold">{o.fulfilment === 'Pickup' ? 'Store pickup' : 'Home delivery'}</dd>
                </div>
                {o.status !== 'Cancelled' && estimateText(o) && (
                  <div>
                    <dt className="text-ink-muted">Estimate</dt>
                    <dd className="font-semibold">{estimateText(o)}</dd>
                  </div>
                )}
              </dl>
              {o.status === 'Pending Payment' && (
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-control bg-warn-soft px-3 py-2 text-sm text-warn">
                  <span>Awaiting payment. If you left the payment page, this order will be cancelled automatically.</span>
                  <CancelOrderButton orderId={o.id} />
                </div>
              )}
              <Link href={`/account/orders/${o.id}`} className="link mt-3 inline-block text-sm">
                View details<span className="sr-only"> of {formatOrderId(o.id)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
