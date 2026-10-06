// Stripe webhook routing logic. Pure: every side effect (signature check, database, Stripe
// refunds, logging) is injected, so the decisions can be unit-tested with mocks (tests/).
// Safe to run more than once for the same event: finalize is idempotent in the database and
// refunds use an idempotency key per order.

export type FinalizeResult = 'paid' | 'already_paid' | 'refund_required';

export interface SessionLike {
  id: string;
  client_reference_id?: string | null;
  payment_status?: string | null;
  amount_total?: number | null;
  currency?: string | null;
  payment_intent?: string | { id: string } | null;
}

export interface EventLike {
  id: string;
  type: string;
  data: { object: unknown };
}

export interface WebhookDeps {
  /** Verifies the signature over the raw body; throws when it is invalid. */
  constructEvent(rawBody: string, signature: string): EventLike;
  /** Expected charge in minor units, recomputed from the order's items; null if the order has no items. */
  expectedAmountMinor(orderId: number): Promise<number | null>;
  finalize(orderId: number, sessionId: string, paymentIntentId: string): Promise<FinalizeResult>;
  expire(orderId: number, sessionId: string): Promise<unknown>;
  refund(paymentIntentId: string, orderId: number): Promise<void>;
  /** Charge currency in use (for example "mur"). */
  currency: string;
  /** Logs ids and types only, never bodies, keys or card data. */
  log(level: 'info' | 'error', message: string, fields: Record<string, string | number | null>): void;
}

export interface WebhookResult {
  status: 200 | 400 | 500;
  outcome:
    | 'bad_signature'
    | 'ignored'
    | 'ignored_unpaid'
    | 'ignored_no_order'
    | 'finalized'
    | 'already_paid'
    | 'refunded'
    | 'expired'
    | 'manual_review'
    | 'error';
}

/** Permanent errors from finalize_online_order: retrying will not help. */
const PERMANENT = ['ORDER_NOT_FOUND', 'SESSION_MISMATCH'];

export function orderIdFrom(session: SessionLike): number | null {
  const ref = session.client_reference_id ?? '';
  if (!/^\d{1,9}$/.test(ref)) return null;
  const id = Number(ref);
  return id > 0 ? id : null;
}

export function paymentIntentIdFrom(session: SessionLike): string | null {
  const pi = session.payment_intent;
  if (!pi) return null;
  return typeof pi === 'string' ? pi : pi.id ?? null;
}

async function finalizePaid(event: EventLike, session: SessionLike, deps: WebhookDeps): Promise<WebhookResult> {
  const orderId = orderIdFrom(session);
  const base = { event: event.id, type: event.type, order: orderId };
  if (!orderId) {
    deps.log('error', 'Paid session without a valid order id', base);
    return { status: 200, outcome: 'ignored_no_order' };
  }
  const paymentIntent = paymentIntentIdFrom(session);
  if (!paymentIntent) {
    deps.log('error', 'Paid session without a payment intent: manual review', base);
    return { status: 200, outcome: 'manual_review' };
  }

  const expected = await deps.expectedAmountMinor(orderId);
  const currencyOk = (session.currency ?? '').toLowerCase() === deps.currency.toLowerCase();
  if (expected === null || !currencyOk || expected !== session.amount_total) {
    deps.log('error', 'Amount or currency mismatch: order not finalized, manual review needed', base);
    return { status: 200, outcome: 'manual_review' };
  }

  let result: FinalizeResult;
  try {
    result = await deps.finalize(orderId, session.id, paymentIntent);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (PERMANENT.some((t) => message.includes(t))) {
      deps.log('error', `finalize_online_order refused (${PERMANENT.find((t) => message.includes(t))}): manual review`, base);
      return { status: 200, outcome: 'manual_review' };
    }
    throw err;
  }

  if (result === 'refund_required') {
    await deps.refund(paymentIntent, orderId);
    deps.log('info', 'Item sold out before payment completed: order cancelled and payment refunded', base);
    return { status: 200, outcome: 'refunded' };
  }
  deps.log('info', result === 'paid' ? 'Order paid' : 'Order already paid (duplicate event)', base);
  return { status: 200, outcome: result === 'paid' ? 'finalized' : 'already_paid' };
}

export async function handleStripeWebhook(
  rawBody: string,
  signature: string | null,
  deps: WebhookDeps,
): Promise<WebhookResult> {
  if (!signature) return { status: 400, outcome: 'bad_signature' };
  let event: EventLike;
  try {
    event = deps.constructEvent(rawBody, signature);
  } catch {
    return { status: 400, outcome: 'bad_signature' };
  }

  try {
    const session = event.data.object as SessionLike;
    switch (event.type) {
      case 'checkout.session.completed':
        // Delayed methods complete later with async_payment_succeeded.
        if (session.payment_status !== 'paid') return { status: 200, outcome: 'ignored_unpaid' };
        return await finalizePaid(event, session, deps);
      case 'checkout.session.async_payment_succeeded':
        return await finalizePaid(event, session, deps);
      case 'checkout.session.expired':
      case 'checkout.session.async_payment_failed': {
        const orderId = orderIdFrom(session);
        if (!orderId) return { status: 200, outcome: 'ignored_no_order' };
        await deps.expire(orderId, session.id);
        deps.log('info', 'Checkout ended without payment: pending order cancelled', {
          event: event.id,
          type: event.type,
          order: orderId,
        });
        return { status: 200, outcome: 'expired' };
      }
      default:
        return { status: 200, outcome: 'ignored' };
    }
  } catch (err) {
    deps.log('error', `Webhook processing failed: ${err instanceof Error ? err.name : 'error'}`, {
      event: event.id,
      type: event.type,
      order: orderIdFrom((event.data?.object ?? {}) as SessionLike),
    });
    // 500 makes Stripe retry later.
    return { status: 500, outcome: 'error' };
  }
}
