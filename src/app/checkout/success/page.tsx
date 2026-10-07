import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CheckCircle2, Clock, XCircle } from 'lucide-react';
import { AwaitPaymentConfirmation, ClearCartOnce } from '@/components/checkout/PaymentWatchers';
import { FulfilmentDetails, OrderItemsTable } from '@/components/orders/OrderSummary';
import { CollectFromDealership, ReservationDetails } from '@/components/orders/ReservationSummary';
import { OrderStatusBadge } from '@/components/orders/OrderStatusBadge';
import { getMyOrder, getMyOrderItems } from '@/lib/account/orders';
import { requireCustomer } from '@/lib/auth/session';
import { sessionIdSchema } from '@/lib/checkout/validation';
import { formatOrderId } from '@/lib/format';
import type { SearchParams } from '@/lib/params';
import { retrieveCheckoutSession } from '@/lib/stripe/server';
import { orderIdFrom } from '@/lib/stripe/webhook-router';

export const metadata: Metadata = {
  title: 'Order confirmation',
  robots: { index: false, follow: false },
};

// This page only reads. Payment is confirmed exclusively by the Stripe webhook.
export default async function CheckoutSuccessPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const rawId = typeof sp.session_id === 'string' ? sp.session_id : '';
  await requireCustomer(rawId ? `/checkout/success?session_id=${encodeURIComponent(rawId)}` : '/account/orders');

  const sessionId = sessionIdSchema.safeParse(rawId);
  if (!sessionId.success) notFound();
  const session = await retrieveCheckoutSession(sessionId.data);
  const orderId = session ? orderIdFrom(session) : null;
  if (!orderId) notFound();
  // my_orders is scoped to the signed-in customer, so another customer's order is "not found".
  const order = await getMyOrder(orderId);
  if (!order) notFound();
  const reservation = order.orderType === 'Reservation';
  const items = reservation ? [] : await getMyOrderItems(order.id);

  const pending = order.status === 'Pending Payment';
  const cancelled = order.status === 'Cancelled';
  // A cancelled order was refunded only if Stripe actually took the payment.
  const refunded = cancelled && session?.payment_status === 'paid';

  return (
    <div className="container-page flex justify-center py-10">
      <div className="w-full max-w-2xl space-y-6">
        <div className="card p-6 text-center sm:p-8">
          <span
            className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full ${
              cancelled ? 'bg-bad-soft text-bad' : pending ? 'bg-warn-soft text-warn' : 'bg-ok-soft text-ok'
            }`}
          >
            {cancelled ? (
              <XCircle aria-hidden="true" className="h-7 w-7" />
            ) : pending ? (
              <Clock aria-hidden="true" className="h-7 w-7" />
            ) : (
              <CheckCircle2 aria-hidden="true" className="h-7 w-7" />
            )}
          </span>
          <h1 className="text-2xl font-bold tracking-tight">
            {refunded
              ? reservation
                ? 'Your deposit is being refunded'
                : 'Your payment is being refunded'
              : cancelled
                ? reservation
                  ? 'This reservation was cancelled'
                  : 'This order was cancelled'
                : pending
                  ? reservation
                    ? 'Confirming your deposit'
                    : 'Confirming your payment'
                  : reservation
                    ? 'Motorcycle reserved'
                    : 'Thank you, your order is confirmed'}
          </h1>
          <p className="mt-2 text-ink-muted">
            Order ID <strong className="text-ink">{formatOrderId(order.id)}</strong>
          </p>
          <div className="mt-2 flex justify-center"><OrderStatusBadge status={order.status} orderType={order.orderType} /></div>
          {reservation ? (
          <div className="mt-4">
            {/* A reservation never touches the cart. */}
            {pending && <AwaitPaymentConfirmation what="reservation" />}
            {refunded && (
              <p className="text-sm text-ink-muted">
                Another customer reserved this motorcycle before your payment completed, so this reservation was
                cancelled and your deposit is being refunded in full.
              </p>
            )}
            {cancelled && !refunded && <p className="text-sm text-ink-muted">Nothing was charged.</p>}
            {!pending && !cancelled && (
              <p className="text-sm text-ink-muted">
                We have received your deposit and the motorcycle is held for you. Visit the dealership to pay the
                balance and collect it.
              </p>
            )}
          </div>
          ) : (
          <div className="mt-4">
            {pending && <AwaitPaymentConfirmation />}
            {refunded && (
              <p className="text-sm text-ink-muted">
                One of the items sold out before your payment completed, so this order was cancelled and your payment
                is being refunded in full. Your cart has not been changed.
              </p>
            )}
            {cancelled && !refunded && (
              <p className="text-sm text-ink-muted">Nothing was charged and your cart has not been changed.</p>
            )}
            {!pending && !cancelled && (
              <>
                <ClearCartOnce orderId={order.id} />
                <p className="text-sm text-ink-muted">We have received your payment. You can follow this order in My orders.</p>
              </>
            )}
          </div>
          )}
        </div>

        {!cancelled &&
          (reservation ? (
            <>
              <ReservationDetails order={order} />
              <CollectFromDealership />
            </>
          ) : (
            <>
              <OrderItemsTable items={items} total={order.total} />
              <FulfilmentDetails order={order} />
            </>
          ))}

        <div className="flex flex-wrap justify-center gap-3">
          <Link href={`/account/orders/${order.id}`} className="btn-dark h-11">
            {reservation ? 'View reservation' : 'View order'}
          </Link>
          {reservation ? (
            <Link href="/bikes" className="btn-outline h-11">Browse motorcycles</Link>
          ) : (
            <Link href={cancelled ? '/cart' : '/parts'} className="btn-outline h-11">
              {cancelled ? 'Back to cart' : 'Continue shopping'}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
