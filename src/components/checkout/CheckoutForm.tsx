'use client';

import Link from 'next/link';
import { CreditCard, Info, ShoppingCart, Store, Truck } from 'lucide-react';
import { useActionState, useState } from 'react';
import { useCartItems } from '@/components/cart/CartView';
import { Field } from '@/components/forms/Field';
import { FormMessage } from '@/components/forms/FormMessage';
import { SubmitButton } from '@/components/forms/SubmitButton';
import { useFormFeedback } from '@/components/forms/useFormFeedback';
import { EmptyState } from '@/components/ui/EmptyState';
import { DELIVERY_ESTIMATE, PICKUP_ESTIMATE } from '@/config/shop';
import { startCheckoutAction } from '@/lib/actions/checkout';
import { formatMoney } from '@/lib/format';
import { initialFormState } from '@/lib/forms';

export interface DeliveryDefaults {
  street: string;
  town: string;
  postCode: string;
  phone: string;
}

export function CheckoutForm({ defaults }: { defaults: DeliveryDefaults }) {
  const { ready, loading, rows, subtotal, blocked } = useCartItems();
  const [state, action] = useActionState(startCheckoutAction, initialFormState);
  const { formRef, messageRef } = useFormFeedback(state);
  const [fulfilment, setFulfilment] = useState<'Delivery' | 'Pickup'>(
    state.values?.fulfilment === 'Pickup' ? 'Pickup' : 'Delivery',
  );
  const e = state.fieldErrors ?? {};
  const v = (k: keyof DeliveryDefaults) => state.values?.[k] ?? defaults[k];

  if (!ready || (loading && rows.length > 0)) {
    return (
      <div role="status" aria-label="Loading checkout" className="card h-64 animate-pulse">
        <span className="sr-only">Loading checkout</span>
      </div>
    );
  }
  if (rows.length === 0) {
    return (
      <EmptyState icon={ShoppingCart} title="Your cart is empty"
        action={<Link href="/parts" className="btn-primary h-11">Browse parts</Link>}>
        Add some parts before checking out.
      </EmptyState>
    );
  }
  if (blocked) {
    return (
      <EmptyState icon={ShoppingCart} title="Some items need your attention"
        action={<Link href="/cart" className="btn-primary h-11">Review your cart</Link>}>
        One or more items are out of stock, no longer sold, or above the available quantity.
      </EmptyState>
    );
  }

  // Only stock ids and quantities are sent; prices are computed by the database.
  const linesJson = JSON.stringify(rows.map((r) => ({ stockId: r.line.stockId, qty: r.line.qty })));

  return (
    <form ref={formRef} action={action} noValidate className="grid gap-6 lg:grid-cols-[1fr_340px] lg:items-start">
      <input type="hidden" name="lines" value={linesJson} />
      <div className="space-y-6">
        <FormMessage state={state} ref={messageRef} />

        <fieldset className="card space-y-3 p-5">
          <legend className="sr-only">How would you like to receive your order?</legend>
          <h2 className="text-lg font-semibold" aria-hidden="true">Delivery or pickup</h2>
          {([
            { value: 'Delivery', title: 'Home delivery', text: `Free. Estimated ${DELIVERY_ESTIMATE}.`, Icon: Truck },
            { value: 'Pickup', title: 'Store pickup', text: `Free. ${PICKUP_ESTIMATE}.`, Icon: Store },
          ] as const).map(({ value, title, text, Icon }) => (
            <label key={value}
              className={`flex cursor-pointer gap-3 rounded-control border-2 p-4 transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-accent ${
                fulfilment === value ? 'border-accent bg-accent-soft' : 'border-line hover:border-ink'
              }`}>
              <input type="radio" name="fulfilment" value={value} checked={fulfilment === value}
                onChange={() => setFulfilment(value)} className="mt-1 h-4 w-4 accent-accent" />
              <Icon aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-accent-strong" />
              <span>
                <span className="block font-semibold">{title}</span>
                <span className="block text-sm text-ink-muted">{text}</span>
              </span>
            </label>
          ))}
        </fieldset>

        {fulfilment === 'Delivery' ? (
          <fieldset className="card grid gap-4 p-5 sm:grid-cols-2">
            <legend className="sr-only">Delivery address</legend>
            <div className="sm:col-span-2">
              <h2 className="text-lg font-semibold" aria-hidden="true">Delivery address</h2>
              <p className="text-sm text-ink-muted">Pre-filled from your profile. Changes here apply to this order only.</p>
            </div>
            <Field name="street" label="Street" autoComplete="shipping address-line1" maxLength={50} required
              defaultValue={v('street')} error={e.street} className="sm:col-span-2" />
            <Field name="town" label="Town" autoComplete="shipping address-level2" maxLength={60} required
              defaultValue={v('town')} error={e.town} />
            <Field name="postCode" label="Post code" autoComplete="shipping postal-code" maxLength={10} optional
              defaultValue={v('postCode')} error={e.postCode} />
            <Field name="phone" label="Phone for the courier" type="tel" autoComplete="tel" maxLength={20} required
              defaultValue={v('phone')} error={e.phone} hint="Digits, spaces, + or -." className="sm:col-span-2" />
          </fieldset>
        ) : (
          <div className="card flex gap-3 p-5 text-sm">
            <Store aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-accent-strong" />
            <p>Collect your order at the dealership. We will have it ready the next working day; bring your Order ID.</p>
          </div>
        )}
      </div>

      <aside aria-labelledby="order-summary-heading" className="card space-y-4 p-5 lg:sticky lg:top-32">
        <h2 id="order-summary-heading" className="text-lg font-semibold">Order summary</h2>
        <ul className="divide-y divide-line text-sm">
          {rows.map(({ line, info }) => (
            <li key={line.stockId} className="flex justify-between gap-3 py-2">
              <span className="min-w-0">
                <span className="block font-medium">{info?.name}</span>
                <span className="text-ink-muted">{line.qty} x {formatMoney(info?.price ?? 0)}</span>
              </span>
              <span className="shrink-0 font-semibold">{formatMoney((info?.price ?? 0) * line.qty)}</span>
            </li>
          ))}
        </ul>
        <div className="flex justify-between text-sm"><span className="text-ink-muted">Delivery</span><span className="font-semibold">Free</span></div>
        <div className="flex justify-between border-t border-line pt-3 text-base">
          <span className="font-semibold">Total</span><span className="font-bold">{formatMoney(subtotal)}</span>
        </div>
        <p className="flex gap-2 rounded-control bg-accent-soft px-3 py-2.5 text-xs text-ink">
          <Info aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-accent-strong" />
          <span>
            <strong>Stripe test mode:</strong> use card 4242 4242 4242 4242, any future date, any CVC. No real money is taken.
          </span>
        </p>
        <SubmitButton pendingLabel="Opening secure payment..." className="w-full">
          <CreditCard aria-hidden="true" className="h-4 w-4" />
          Pay with card
        </SubmitButton>
        <p className="text-xs text-ink-muted">
          You will pay on Stripe&apos;s secure page. The final price is confirmed from our stock records.
        </p>
        <Link href="/cart" className="link block text-center text-sm">Back to cart</Link>
      </aside>
    </form>
  );
}
