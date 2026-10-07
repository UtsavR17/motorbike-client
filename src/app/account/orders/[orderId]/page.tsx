import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Check, XCircle } from 'lucide-react';
import { Notice } from '@/components/forms/FormMessage';
import { CancelOrderButton } from '@/components/orders/CancelOrderButton';
import { OrderStatusBadge } from '@/components/orders/OrderStatusBadge';
import { FulfilmentDetails, OrderItemsTable } from '@/components/orders/OrderSummary';
import {
  CollectFromDealership,
  ReservationDetails,
  ReservationExpiredNotice,
} from '@/components/orders/ReservationSummary';
import { Breadcrumbs } from '@/components/ui/PageIntro';
import { noticeText } from '@/lib/account/notices';
import { getMyOrder, getMyOrderItems, type MyOrder } from '@/lib/account/orders';
import { requireCustomer } from '@/lib/auth/session';
import { orderIdSchema } from '@/lib/checkout/validation';
import { isReservationExpired } from '@/lib/commerce/reservation';
import { formatDate, formatOrderId } from '@/lib/format';
import { orderTypeLabel } from '@/lib/orders/status';
import type { SearchParams } from '@/lib/params';

export const metadata: Metadata = { title: 'Order details' };

/** Steps of the order timeline for this order type and fulfilment method. */
function timeline(order: MyOrder): { label: string; done: boolean }[] {
  if (order.orderType === 'Reservation') {
    const reached = order.status === 'Completed' ? 3 : order.status === 'Paid' ? 2 : 0;
    return ['Deposit paid', 'Reserved', 'Collected'].map((label, i) => ({ label, done: reached > i }));
  }
  const middle = order.fulfilment === 'Pickup' ? 'Ready for Pickup' : 'Out for Delivery';
  const steps = ['Paid', 'Processing', middle, 'Completed'];
  const reached = steps.indexOf(order.status);
  return steps.map((s, i) => ({
    label: s === 'Ready for Pickup' ? 'Ready for pickup' : s === 'Out for Delivery' ? 'Out for delivery' : s,
    done: reached >= i,
  }));
}

export default async function OrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ orderId: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { orderId: raw } = await params;
  await requireCustomer('/account/orders');
  const parsed = orderIdSchema.safeParse(raw);
  if (!parsed.success) notFound();
  // my_orders only returns the signed-in customer's orders: anyone else's id is a 404.
  const order = await getMyOrder(parsed.data);
  if (!order) notFound();
  const reservation = order.orderType === 'Reservation';
  // Reservations have no items: the motorcycle is described on the order itself.
  const items = reservation ? [] : await getMyOrderItems(order.id);
  const notice = noticeText((await searchParams).notice);
  const steps = timeline(order);

  return (
    <div className="space-y-6">
      <div>
        <Breadcrumbs items={[{ href: '/account/orders', label: 'My orders' }, { label: formatOrderId(order.id) }]} />
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {reservation ? 'Reservation' : 'Order'} {formatOrderId(order.id)}
          </h1>
          <OrderStatusBadge status={order.status} orderType={order.orderType} />
        </div>
        <p className="mt-1 text-ink-muted">
          Placed {formatDate(order.date) ?? 'recently'}
          {order.paidAt ? `, ${reservation ? 'deposit paid' : 'paid'} ${formatDate(order.paidAt)}` : ''}
        </p>
        {reservation && <p className="text-sm font-medium text-ink-muted">{orderTypeLabel(order.orderType)}</p>}
      </div>

      {notice && <Notice tone={notice.includes('no longer') ? 'warn' : 'success'}>{notice}</Notice>}

      {order.status === 'Pending Payment' && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-control bg-warn-soft px-4 py-3 text-sm text-warn">
          <span>
            {reservation
              ? 'This reservation is awaiting the deposit payment. It is cancelled automatically if the payment is not completed.'
              : 'This order is awaiting payment. It is cancelled automatically if the payment is not completed.'}
          </span>
          <CancelOrderButton orderId={order.id} />
        </div>
      )}

      {reservation && isReservationExpired(order) && <ReservationExpiredNotice />}

      {order.status === 'Cancelled' ? (
        <div className="flex gap-3 rounded-control bg-bad-soft px-4 py-3 text-sm text-bad" role="status">
          <XCircle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
          <span>
            {reservation
              ? 'This reservation was cancelled and the motorcycle is no longer held for you. If a deposit was taken, the refund appears on your card within a few working days. For questions, please contact the dealership.'
              : `This order was cancelled. ${order.paidAt ? 'Your payment has been refunded.' : 'Nothing was charged.'} If a payment was taken, the refund appears on your card within a few working days.`}
          </span>
        </div>
      ) : (
        order.status !== 'Pending Payment' && (
          <section aria-labelledby="timeline-heading" className="card p-5">
            <h2 id="timeline-heading" className="mb-4 font-semibold">Progress</h2>
            <ol className={`grid gap-3 ${steps.length === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-4'}`}>
              {steps.map((step, i) => (
                <li key={step.label} className="flex items-center gap-2 sm:flex-col sm:items-start" aria-current={step.done && !steps[i + 1]?.done ? 'step' : undefined}>
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold ${
                      step.done ? 'border-ok bg-ok text-white' : 'border-line bg-card text-ink-muted'
                    }`}
                  >
                    {step.done ? <Check aria-hidden="true" className="h-4 w-4" /> : i + 1}
                  </span>
                  <span className={`text-sm ${step.done ? 'font-semibold' : 'text-ink-muted'}`}>
                    {step.label}
                    <span className="sr-only">{step.done ? ' (done)' : ' (not yet)'}</span>
                  </span>
                </li>
              ))}
            </ol>
          </section>
        )
      )}

      {reservation ? (
        <>
          <ReservationDetails order={order} />
          <CollectFromDealership />
        </>
      ) : (
        <>
          <section aria-labelledby="items-heading" className="space-y-3">
            <h2 id="items-heading" className="font-semibold">Items</h2>
            <OrderItemsTable items={items} total={order.total} />
          </section>
          <FulfilmentDetails order={order} />
        </>
      )}

      <Link href="/account/orders" className="link inline-block text-sm">Back to My orders</Link>
    </div>
  );
}
