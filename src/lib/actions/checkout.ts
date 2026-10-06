'use server';

import { redirect } from 'next/navigation';
import { cancelMyPendingOrder } from '@/lib/account/orders';
import { requireCustomer } from '@/lib/auth/session';
import { fieldErrorsFrom, readForm } from '@/lib/auth/validation';
import { mapCreateOrderError } from '@/lib/checkout/errors';
import { checkoutSchema, orderIdSchema } from '@/lib/checkout/validation';
import { toNumber } from '@/lib/format';
import { errorState, type FormState } from '@/lib/forms';
import { createCheckoutSession, type OrderLine } from '@/lib/stripe/server';
import { createClient } from '@/lib/supabase/server';

interface CreatedOrder {
  order_id: number;
  total: number | string;
  estimated_date: string | null;
  lines: { name: string; unit_price: number | string; qty: number }[];
}

/**
 * Creates the order in the database (prices and total computed there), opens a hosted
 * Stripe Checkout Session for it and redirects the customer to Stripe.
 */
export async function startCheckoutAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { user } = await requireCustomer('/checkout');
  const raw = readForm(formData, ['lines', 'fulfilment', 'street', 'town', 'postCode', 'phone']);
  const values = { fulfilment: raw.fulfilment, street: raw.street, town: raw.town, postCode: raw.postCode, phone: raw.phone };

  const parsed = checkoutSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors = fieldErrorsFrom(parsed.error);
    const linesError = fieldErrors.lines;
    delete fieldErrors.lines;
    return errorState(values, { message: linesError ? `${linesError}. Please review your cart.` : undefined, fieldErrors });
  }
  const d = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('create_online_order', {
    p_items: d.lines.map((l) => ({ stock_id: l.stockId, qty: l.qty })),
    p_fulfilment: d.fulfilment,
    p_street: d.street,
    p_town: d.town,
    p_post_code: d.postCode,
    p_phone: d.phone,
  });
  if (error) {
    const outcome = mapCreateOrderError(error);
    if (outcome.kind === 'insufficient_stock') {
      redirect(`/cart?issue=stock${outcome.stockId ? `&item=${outcome.stockId}` : ''}`);
    }
    if (outcome.kind === 'no_profile') redirect('/account/profile/complete');
    return errorState(values, { message: outcome.message });
  }

  const order = (typeof data === 'string' ? JSON.parse(data) : data) as CreatedOrder;
  const lines: OrderLine[] = (order.lines ?? []).map((l) => ({
    name: l.name,
    unitPrice: toNumber(l.unit_price) ?? NaN,
    qty: l.qty,
  }));

  let sessionUrl: string | null = null;
  try {
    if (lines.length === 0 || lines.some((l) => !Number.isFinite(l.unitPrice))) throw new Error('bad order lines');
    const session = await createCheckoutSession({ orderId: order.order_id, lines, email: user.email });
    const { error: attachError } = await supabase.rpc('attach_checkout_session', {
      p_order_id: order.order_id,
      p_session_id: session.id,
    });
    if (attachError) throw new Error(`attach failed: ${attachError.code ?? 'unknown'}`);
    sessionUrl = session.url;
  } catch (err) {
    console.error(`[checkout] could not open payment for order ${order.order_id}: ${err instanceof Error ? err.message.slice(0, 80) : 'error'}`);
  }

  if (!sessionUrl) {
    await cancelMyPendingOrder(order.order_id);
    return errorState(values, {
      message: 'We could not open the payment page right now. Nothing was charged; please try again in a moment.',
    });
  }
  redirect(sessionUrl);
}

/** Cancels an order that is still awaiting payment (from My orders). */
export async function cancelOrderAction(formData: FormData): Promise<void> {
  await requireCustomer('/account/orders');
  const parsed = orderIdSchema.safeParse(formData.get('orderId'));
  if (!parsed.success) redirect('/account/orders');
  const cancelled = await cancelMyPendingOrder(parsed.data);
  redirect(`/account/orders/${parsed.data}?notice=${cancelled ? 'order-cancelled' : 'order-not-cancelled'}`);
}
