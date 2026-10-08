import 'server-only';

import { normalizeTime } from '@/lib/appointments/time';
import { toNumber } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';

// Customers reach appointments only through the my_appointment* views and the
// get_appointment_slots / create_my_appointment / cancel_my_appointment functions, always with
// their own session. Explicit column lists; the views expose no employee or audit data.

export interface MyAppointment {
  id: number;
  date: string;
  time: string;
  type: string;
  status: string;
  bikeId: number;
  registration: string | null;
  bikeLabel: string | null;
  technicianAssigned: boolean;
  total: number;
  amountPaid: number;
}

export interface AppointmentServiceLine {
  name: string;
  quantity: number;
  unitCost: number;
}

export interface AppointmentPartLine {
  description: string;
  quantity: number;
  unitPrice: number;
}

export type SlotState = 'available' | 'full' | 'unavailable';

export interface Slot {
  time: string;
  state: SlotState;
}

const APPOINTMENT_COLUMNS =
  'appointment_id,appointment_date,appointment_time,appointment_type,status,bike_id,registration_number,bike_label,technician_assigned,total_amount,amount_paid';

interface AppointmentRow {
  appointment_id: number;
  appointment_date: string;
  appointment_time: string;
  appointment_type: string;
  status: string;
  bike_id: number;
  registration_number: string | null;
  bike_label: string | null;
  technician_assigned: boolean | null;
  total_amount: number | string | null;
  amount_paid: number | string | null;
}

function toAppointment(r: AppointmentRow): MyAppointment {
  return {
    id: r.appointment_id,
    date: r.appointment_date,
    time: normalizeTime(r.appointment_time) ?? r.appointment_time,
    type: r.appointment_type,
    status: r.status,
    bikeId: r.bike_id,
    registration: r.registration_number,
    bikeLabel: r.bike_label,
    technicianAssigned: r.technician_assigned === true,
    total: toNumber(r.total_amount) ?? 0,
    amountPaid: toNumber(r.amount_paid) ?? 0,
  };
}

function fail(what: string, code: string | undefined): never {
  console.error(`[appointments] ${what} failed: ${code ?? 'unknown'}`);
  throw new Error('Could not load your appointments.');
}

export async function listMyAppointments(): Promise<MyAppointment[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('my_appointments')
    .select(APPOINTMENT_COLUMNS)
    .order('appointment_date', { ascending: false })
    .order('appointment_time', { ascending: false })
    .order('appointment_id', { ascending: false });
  if (error) fail('list', error.code);
  return ((data ?? []) as AppointmentRow[]).map(toAppointment);
}

/** The customer's own appointment, or null (also for another customer's id). */
export async function getMyAppointment(appointmentId: number): Promise<MyAppointment | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('my_appointments')
    .select(APPOINTMENT_COLUMNS)
    .eq('appointment_id', appointmentId)
    .maybeSingle();
  if (error) fail('read', error.code);
  return data ? toAppointment(data as AppointmentRow) : null;
}

export async function getAppointmentServices(appointmentId: number): Promise<AppointmentServiceLine[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('my_appointment_services')
    .select('appointment_id,name,quantity,unit_cost')
    .eq('appointment_id', appointmentId)
    .order('name', { ascending: true });
  if (error) fail('services', error.code);
  return ((data ?? []) as { name: string; quantity: number; unit_cost: number | string }[]).map((r) => ({
    name: r.name,
    quantity: r.quantity,
    unitCost: toNumber(r.unit_cost) ?? 0,
  }));
}

export async function getAppointmentParts(appointmentId: number): Promise<AppointmentPartLine[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('my_appointment_parts')
    .select('appointment_id,description,quantity,unit_price')
    .eq('appointment_id', appointmentId)
    .order('description', { ascending: true });
  if (error) fail('parts', error.code);
  return ((data ?? []) as { description: string; quantity: number; unit_price: number | string }[]).map((r) => ({
    description: r.description,
    quantity: r.quantity,
    unitPrice: toNumber(r.unit_price) ?? 0,
  }));
}

interface SlotRow {
  slot_date: string;
  slot_time: string;
  booked_count: number;
  slot_capacity: number;
  bookable: boolean;
}

/** One day's slots; an empty list means the workshop is closed or the date is out of range. */
export async function getSlotsForDay(isoDate: string): Promise<Slot[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('get_appointment_slots', { p_from: isoDate, p_to: isoDate });
  if (error) {
    console.error(`[appointments] slots failed: ${error.code ?? 'unknown'}`);
    throw new Error('Could not load the available times.');
  }
  return ((data ?? []) as SlotRow[])
    .filter((r) => r.slot_date === isoDate)
    .map((r) => {
      const time = normalizeTime(r.slot_time) ?? r.slot_time;
      const state: SlotState = r.bookable ? 'available' : r.booked_count >= r.slot_capacity ? 'full' : 'unavailable';
      return { time, state };
    })
    .sort((a, b) => a.time.localeCompare(b.time));
}

/** Cancels the customer's own Pending or Confirmed appointment. True when it was cancelled. */
export async function cancelMyAppointment(appointmentId: number): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('cancel_my_appointment', { p_appointment_id: appointmentId });
  if (error) {
    console.error(`[appointments] cancel failed: ${error.code ?? 'unknown'}`);
    return false;
  }
  return data === true;
}
