import { NextResponse, type NextRequest } from 'next/server';
import { currencyConfig, expectedChargeMinor } from '@/lib/commerce/money';
import { toNumber } from '@/lib/format';
import { getStripe } from '@/lib/stripe/server';
import { handleStripeWebhook, type FinalizeResult, type WebhookDeps } from '@/lib/stripe/webhook-router';
import { createAdminClient } from '@/lib/supabase/admin';

// Stripe webhook: the only place that confirms payment. Node runtime for the Stripe SDK.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function deps(): WebhookDeps {
  const stripe = getStripe();
  const admin = createAdminClient();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error('STRIPE_WEBHOOK_SECRET is not set.');
  const config = currencyConfig();

  return {
    currency: config.currency,
    constructEvent: (raw, signature) => stripe.webhooks.constructEvent(raw, signature, secret),

    async expectedAmountMinor(orderId) {
      // Parts orders: sum of their items. Reservations: no items, the deposit is TotalAmount.
      const order = await admin
        .from('Online_Order')
        .select('OrderType,TotalAmount')
        .eq('OrderID', orderId)
        .maybeSingle();
      if (order.error) throw new Error(`order read failed: ${order.error.code ?? 'unknown'}`);
      const { data, error } = await admin
        .from('Online_Order_Item')
        .select('Quantity,UnitPrice')
        .eq('Online_Order_OrderID', orderId);
      if (error) throw new Error(`order items read failed: ${error.code ?? 'unknown'}`);
      const row = order.data as { OrderType: string | null; TotalAmount: number | string | null } | null;
      const items = ((data ?? []) as { Quantity: number; UnitPrice: number | string }[]).map((r) => ({
        unitPrice: toNumber(r.UnitPrice) ?? NaN,
        quantity: r.Quantity,
      }));
      return expectedChargeMinor(
        row ? { orderType: row.OrderType, totalAmount: toNumber(row.TotalAmount) } : null,
        items,
        config,
      );
    },

    async finalize(orderId, sessionId, paymentIntentId) {
      const { data, error } = await admin.rpc('finalize_online_order', {
        p_order_id: orderId,
        p_session_id: sessionId,
        p_payment_intent: paymentIntentId,
      });
      if (error) throw new Error(`finalize_online_order: ${error.message ?? error.code ?? 'unknown'}`);
      return data as FinalizeResult;
    },

    async expire(orderId, sessionId) {
      const { error } = await admin.rpc('expire_online_order', { p_order_id: orderId, p_session_id: sessionId });
      if (error) throw new Error(`expire_online_order: ${error.code ?? 'unknown'}`);
    },

    async refund(paymentIntentId, orderId) {
      await stripe.refunds.create(
        { payment_intent: paymentIntentId, metadata: { order_id: String(orderId) } },
        { idempotencyKey: `refund-order-${orderId}` },
      );
    },

    log(level, message, fields) {
      const line = `[stripe-webhook] ${message} ${JSON.stringify(fields)}`;
      if (level === 'error') console.error(line);
      else console.info(line);
    },
  };
}

export async function POST(request: NextRequest) {
  // Raw body: the signature is computed over the exact bytes Stripe sent.
  const raw = await request.text();
  let result;
  try {
    result = await handleStripeWebhook(raw, request.headers.get('stripe-signature'), deps());
  } catch {
    console.error('[stripe-webhook] configuration error');
    result = { status: 500 as const, outcome: 'error' as const };
  }
  return NextResponse.json({ received: result.status === 200, outcome: result.outcome }, { status: result.status });
}
