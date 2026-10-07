import 'server-only';

import Stripe from 'stripe';
import { CHECKOUT_SESSION_MINUTES } from '@/config/shop';
import { SITE_URL } from '@/lib/auth/config';
import { currencyConfig, toMinorUnits } from '@/lib/commerce/money';

// Test mode only. The SDK's default API version is used (not pinned here).

let client: Stripe | null = null;

/** Throws for live keys, so this project can never charge real cards. */
export function assertTestKey(key: string | undefined): string {
  if (!key) throw new Error('STRIPE_SECRET_KEY is not set.');
  if (key.startsWith('sk_live_') || key.startsWith('rk_live_')) {
    throw new Error('Live Stripe keys are not allowed: this project runs in Stripe test mode only.');
  }
  return key;
}

export function getStripe(): Stripe {
  if (!client) client = new Stripe(assertTestKey(process.env.STRIPE_SECRET_KEY));
  return client;
}

export interface OrderLine {
  name: string;
  unitPrice: number;
  qty: number;
}

/**
 * Hosted Checkout Session for an order created by create_online_order (parts) or
 * create_bike_reservation (one deposit line; orderType 'reservation' is added to the metadata).
 */
export async function createCheckoutSession(input: {
  orderId: number;
  lines: OrderLine[];
  email: string | null;
  orderType?: 'reservation';
}): Promise<Stripe.Checkout.Session> {
  const config = currencyConfig();
  const orderId = String(input.orderId);
  const metadata: Record<string, string> = input.orderType
    ? { order_id: orderId, order_type: input.orderType }
    : { order_id: orderId };
  return getStripe().checkout.sessions.create({
    mode: 'payment',
    line_items: input.lines.map((l) => ({
      quantity: l.qty,
      price_data: {
        currency: config.currency,
        unit_amount: toMinorUnits(l.unitPrice, config),
        product_data: { name: l.name.slice(0, 250) || (input.orderType ? 'Motorcycle deposit' : 'Spare part') },
      },
    })),
    client_reference_id: orderId,
    metadata,
    payment_intent_data: { metadata },
    ...(input.email ? { customer_email: input.email } : {}),
    success_url: `${SITE_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${SITE_URL}/checkout/cancelled?order=${orderId}`,
    expires_at: Math.floor(Date.now() / 1000) + CHECKOUT_SESSION_MINUTES * 60,
  });
}

/** Reads a Checkout Session (success page). Returns null for unknown or invalid ids. */
export async function retrieveCheckoutSession(sessionId: string): Promise<Stripe.Checkout.Session | null> {
  try {
    return await getStripe().checkout.sessions.retrieve(sessionId);
  } catch {
    return null;
  }
}
