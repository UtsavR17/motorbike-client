'use server';

import { redirect } from 'next/navigation';
import { cancelMyAppointment, getSlotsForDay, type Slot } from '@/lib/account/appointments';
import { mapBookingError } from '@/lib/appointments/errors';
import { isSunday } from '@/lib/appointments/time';
import { appointmentDateSchema, appointmentIdSchema, bookingSchema } from '@/lib/appointments/validation';
import { requireCustomer } from '@/lib/auth/session';
import { fieldErrorsFrom, readForm } from '@/lib/auth/validation';
import { errorState, type FormState } from '@/lib/forms';
import { createClient } from '@/lib/supabase/server';

export type SlotsResult =
  | { status: 'ok'; date: string; slots: Slot[] }
  | { status: 'closed'; date: string }
  | { status: 'error'; date: string; message: string };

/** One day's time slots for the booking page (counts and availability only). */
export async function getSlotsAction(date: string): Promise<SlotsResult> {
  await requireCustomer('/book');
  const parsed = appointmentDateSchema.safeParse(date);
  if (!parsed.success) return { status: 'error', date: '', message: 'Choose a valid date.' };
  if (isSunday(parsed.data)) return { status: 'closed', date: parsed.data };
  try {
    return { status: 'ok', date: parsed.data, slots: await getSlotsForDay(parsed.data) };
  } catch {
    return { status: 'error', date: parsed.data, message: 'We could not load the available times. Please try again.' };
  }
}

/** Books an appointment for one of the customer's bikes. Prices and status are set by the database. */
export async function bookAppointmentAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireCustomer('/book');
  const raw = readForm(formData, ['bikeId', 'type', 'date', 'time']);
  const serviceIds = formData.getAll('serviceIds').filter((v): v is string => typeof v === 'string');
  const values = { ...raw, serviceIds: serviceIds.join(',') };

  const parsed = bookingSchema.safeParse({ ...raw, serviceIds });
  if (!parsed.success) return errorState(values, { fieldErrors: fieldErrorsFrom(parsed.error) });
  const d = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('create_my_appointment', {
    p_bike_id: d.bikeId,
    p_date: d.date,
    p_time: d.time,
    p_type: d.type,
    p_service_ids: d.serviceIds,
  });
  if (error) {
    const outcome = mapBookingError(error);
    if (outcome.kind === 'no_profile') redirect('/account/profile/complete');
    console.error(`[appointments] booking failed: ${error.code ?? 'unknown'}`);
    return errorState(values, {
      message: outcome.message,
      fieldErrors: outcome.field ? { [outcome.field]: outcome.message } : undefined,
    });
  }

  const id = typeof data === 'number' ? data : Number(data);
  if (!Number.isInteger(id) || id <= 0) {
    console.error('[appointments] booking returned no id');
    redirect('/account/appointments');
  }
  redirect(`/account/appointments/${id}?booked=1`);
}

/** Cancels a Pending or Confirmed appointment that starts at least 2 hours from now. */
export async function cancelAppointmentAction(formData: FormData): Promise<void> {
  await requireCustomer('/account/appointments');
  const parsed = appointmentIdSchema.safeParse(formData.get('appointmentId'));
  if (!parsed.success) redirect('/account/appointments');
  const cancelled = await cancelMyAppointment(parsed.data);
  const notice = cancelled ? 'appointment-cancelled' : 'appointment-not-cancelled';
  const back = formData.get('from') === 'list' ? '/account/appointments' : `/account/appointments/${parsed.data}`;
  redirect(`${back}?notice=${notice}`);
}
