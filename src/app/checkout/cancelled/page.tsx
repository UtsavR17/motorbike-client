import type { Metadata } from 'next';
import Link from 'next/link';
import { CircleSlash } from 'lucide-react';
import { cancelMyPendingOrder } from '@/lib/account/orders';
import { requireCustomer } from '@/lib/auth/session';
import { orderIdSchema } from '@/lib/checkout/validation';
import type { SearchParams } from '@/lib/params';

export const metadata: Metadata = {
  title: 'Payment cancelled',
  robots: { index: false, follow: false },
};

export default async function CheckoutCancelledPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  await requireCustomer('/cart');
  // Cancels only the signed-in customer's own order, and only while it awaits payment.
  // Invalid or foreign ids are ignored (the database function returns false).
  const parsed = orderIdSchema.safeParse(typeof sp.order === 'string' ? sp.order : '');
  if (parsed.success) await cancelMyPendingOrder(parsed.data);

  return (
    <div className="container-page flex justify-center py-16">
      <div className="card w-full max-w-lg p-8 text-center">
        <span className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-accent-soft text-accent-strong">
          <CircleSlash aria-hidden="true" className="h-7 w-7" />
        </span>
        <h1 className="text-2xl font-bold tracking-tight">Payment cancelled</h1>
        <p className="mt-3 text-ink-muted">Nothing was charged and your cart is unchanged.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href="/cart" className="btn-primary h-11">Back to cart</Link>
          <Link href="/parts" className="btn-outline h-11">Continue shopping</Link>
        </div>
      </div>
    </div>
  );
}
