// Mauritius time helpers for appointments. Pure (no server-only), unit tested.
// Mauritius is UTC+4 all year (no daylight saving time), so a fixed offset is exact.

import { APPOINTMENT_CANCEL_LEAD_HOURS, APPOINTMENT_MAX_ADVANCE_DAYS } from '@/config/shop';

const OFFSET_MS = 4 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME = /^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/;

/** True for a real calendar date written as YYYY-MM-DD. */
export function isIsoDate(value: string): boolean {
  const m = ISO_DATE.exec(value);
  if (!m) return false;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.toISOString().slice(0, 10) === value;
}

/** Today's date in Mauritius ("YYYY-MM-DD"). */
export function mauritiusToday(now: Date = new Date()): string {
  return new Date(now.getTime() + OFFSET_MS).toISOString().slice(0, 10);
}

/** Calendar arithmetic on a "YYYY-MM-DD" date. */
export function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d) + days * DAY_MS).toISOString().slice(0, 10);
}

/** 0 = Sunday ... 6 = Saturday, for a "YYYY-MM-DD" date. */
export function dayOfWeek(isoDate: string): number {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function isSunday(isoDate: string): boolean {
  return dayOfWeek(isoDate) === 0;
}

/** "09:30:00" or "09:30" -> "09:30"; null when it is not a time. */
export function normalizeTime(value: string | null | undefined): string | null {
  const m = TIME.exec((value ?? '').trim());
  return m ? `${m[1]}:${m[2]}` : null;
}

/** The instant an appointment starts (a Mauritius date and time). */
export function appointmentStart(isoDate: string, time: string): Date {
  const [y, mo, d] = isoDate.split('-').map(Number);
  const [h, mi] = (normalizeTime(time) ?? '00:00').split(':').map(Number);
  return new Date(Date.UTC(y, mo - 1, d, h, mi) - OFFSET_MS);
}

/** "09:30 to 10:30" for a one-hour slot. */
export function slotLabel(time: string): string {
  const start = normalizeTime(time);
  if (!start) return time;
  const [h, m] = start.split(':').map(Number);
  const end = `${String((h + 1) % 24).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  return `${start} to ${end}`;
}

/** Bookable date range for the date picker: today (or tomorrow) up to 30 days ahead. */
export function bookingDateRange(todayHasSlot: boolean, now: Date = new Date()): { min: string; max: string } {
  const today = mauritiusToday(now);
  return { min: todayHasSlot ? today : addDays(today, 1), max: addDays(today, APPOINTMENT_MAX_ADVANCE_DAYS) };
}

const CANCELLABLE = new Set(['Pending', 'Confirmed']);

/**
 * The customer may cancel online while the appointment is Pending or Confirmed and starts at
 * least APPOINTMENT_CANCEL_LEAD_HOURS from now (exactly 2 hours still counts), like
 * cancel_my_appointment does.
 */
export function canCancelAppointment(isoDate: string, time: string, status: string, now: Date = new Date()): boolean {
  if (!CANCELLABLE.has(status) || !isIsoDate(isoDate) || !normalizeTime(time)) return false;
  return appointmentStart(isoDate, time).getTime() - now.getTime() >= APPOINTMENT_CANCEL_LEAD_HOURS * HOUR_MS;
}

const ACTIVE = new Set(['Pending', 'Confirmed', 'In Progress']);

/** Upcoming: still active and not yet started (or in progress now). Everything else is past. */
export function isUpcoming(isoDate: string, time: string, status: string, now: Date = new Date()): boolean {
  if (!ACTIVE.has(status)) return false;
  if (status === 'In Progress') return true;
  return appointmentStart(isoDate, time).getTime() > now.getTime();
}
