'use server';

import { redirect } from 'next/navigation';
import { BIKE_DEPOSIT_PERCENT } from '@/config/shop';
import { cancelMyPendingOrder } from '@/lib/account/orders';
import { requireCustomer } from '@/lib/auth/session';
import { fieldErrorsFrom, readForm } from '@/lib/auth/validation';
import { mapReservationError } from '@/lib/checkout/errors';
import { bikeIdSchema, reservationSchema } from '@/lib/checkout/validation';
import { toNumber } from '@/lib/format';
import { errorState, type FormState } from '@/lib/forms';
import { createCheckoutSession } from '@/lib/stripe/server';
import { createClient } from '@/lib/supabase/server';

interface CreatedReservation {
  order_id: number;
  deposit: number | string;
  bike_price: number | string;
  reserved_until: string | null;
  description: string;
}

const BROWSE_LINK = { href: '/bikes', label: 'Browse motorcycles' };

/**
 * Creates a reservation in the database (deposit and price computed there from the unit's
 * record), opens a hosted Stripe Checkout Session for the deposit and redirects to Stripe.
 * The cart is not involved.
 */
export async function startReservationAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const raw = readForm(formData, ['bikeId', 'terms']);
  const knownId = bikeIdSchema.safeParse(raw.bikeId);
  const { user } = await requireCustomer(knownId.success ? `/reserve/${knownId.data}` : '/bikes');

  const parsed = reservationSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors = fieldErrorsFrom(parsed.error);
    if (fieldErrors.bikeId) {
      return errorState(undefined, { message: 'This motorcycle could not be found.', link: BROWSE_LINK });
    }
    return errorState(undefined, { fieldErrors });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('create_bike_reservation', { p_bike_id: parsed.data.bikeId });
  if (error) {
    const outcome = mapReservationError(error);
    if (outcome.kind === 'no_profile') redirect('/account/profile/complete');
    console.error(`[reservation] create failed: ${error.code ?? 'unknown'}`);
    return errorState(undefined, {
      message: outcome.message,
      link: outcome.kind === 'unavailable' ? BROWSE_LINK : undefined,
    });
  }

  const created = (typeof data === 'string' ? JSON.parse(data) : data) as CreatedReservation;
  const deposit = toNumber(created.deposit);

  let sessionUrl: string | null = null;
  try {
    if (deposit === null || deposit <= 0) throw new Error('bad deposit');
    const session = await createCheckoutSession({
      orderId: created.order_id,
      lines: [{ name: `Deposit (${BIKE_DEPOSIT_PERCENT}%): ${created.description}`, unitPrice: deposit, qty: 1 }],
      email: user.email,
      orderType: 'reservation',
    });
    const { error: attachError } = await supabase.rpc('attach_checkout_session', {
      p_order_id: created.order_id,
      p_session_id: session.id,
    });
    if (attachError) throw new Error(`attach failed: ${attachError.code ?? 'unknown'}`);
    sessionUrl = session.url;
  } catch (err) {
    console.error(
      `[reservation] could not open payment for order ${created.order_id}: ${err instanceof Error ? err.message.slice(0, 80) : 'error'}`,
    );
  }

  if (!sessionUrl) {
    // Releases the hold on the motorcycle straight away.
    await cancelMyPendingOrder(created.order_id);
    return errorState(undefined, {
      message: 'We could not open the payment page right now. Nothing was charged; please try again in a moment.',
    });
  }
  redirect(sessionUrl);
}
