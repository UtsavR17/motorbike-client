// Unit tests for appointments: Mauritius date helpers, cancel rule, upcoming split, status
// labels, slot labels, booking validation and error mapping. Run: npm test

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  APPOINTMENT_CANCEL_LEAD_HOURS,
  APPOINTMENT_MAX_ADVANCE_DAYS,
  APPOINTMENT_MIN_LEAD_HOURS,
  APPOINTMENT_SLOT_TIMES,
  APPOINTMENT_TYPES,
} from '../src/config/shop.ts';
import { BOOKING_MESSAGES, mapBookingError } from '../src/lib/appointments/errors.ts';
import { appointmentStatusExplanation, appointmentStatusLabel } from '../src/lib/appointments/status.ts';
import {
  addDays,
  appointmentStart,
  bookingDateRange,
  canCancelAppointment,
  dayOfWeek,
  isIsoDate,
  isSunday,
  isUpcoming,
  mauritiusToday,
  normalizeTime,
  slotLabel,
} from '../src/lib/appointments/time.ts';
import { appointmentIdSchema, bookingSchema } from '../src/lib/appointments/validation.ts';

/* --------------------------------- Config --------------------------------- */

describe('appointment config', () => {
  test('rules shown to customers', () => {
    assert.equal(APPOINTMENT_MIN_LEAD_HOURS, 2);
    assert.equal(APPOINTMENT_CANCEL_LEAD_HOURS, 2);
    assert.equal(APPOINTMENT_MAX_ADVANCE_DAYS, 30);
    assert.deepEqual([...APPOINTMENT_TYPES], ['Service', 'Repair', 'Inspection', 'Other']);
    assert.deepEqual([...APPOINTMENT_SLOT_TIMES], ['08:30', '09:30', '10:30', '11:30', '12:30', '13:30', '14:30', '15:30']);
  });
});

/* ------------------------------ Mauritius dates ------------------------------ */

describe('Mauritius date helpers', () => {
  test('today switches at 20:00 UTC (midnight in Mauritius)', () => {
    assert.equal(mauritiusToday(new Date('2026-10-08T19:59:59Z')), '2026-10-08');
    assert.equal(mauritiusToday(new Date('2026-10-08T20:00:00Z')), '2026-10-09');
    // UTC midnight is already 04:00 in Mauritius, same calendar day.
    assert.equal(mauritiusToday(new Date('2026-10-09T00:00:00Z')), '2026-10-09');
    assert.equal(mauritiusToday(new Date('2026-12-31T20:30:00Z')), '2027-01-01');
  });
  test('addDays across month, year and leap-day boundaries', () => {
    assert.equal(addDays('2026-10-31', 1), '2026-11-01');
    assert.equal(addDays('2026-12-31', 1), '2027-01-01');
    assert.equal(addDays('2028-02-28', 1), '2028-02-29');
    assert.equal(addDays('2027-02-28', 1), '2027-03-01');
    assert.equal(addDays('2026-10-08', 30), '2026-11-07');
    assert.equal(addDays('2026-03-01', -1), '2026-02-28');
  });
  test('day of week and Sundays', () => {
    assert.equal(dayOfWeek('2026-10-11'), 0);
    assert.equal(dayOfWeek('2026-10-12'), 1);
    assert.equal(isSunday('2026-10-11'), true);
    assert.equal(isSunday('2026-10-10'), false);
  });
  test('ISO date validation', () => {
    assert.equal(isIsoDate('2026-10-08'), true);
    assert.equal(isIsoDate('2028-02-29'), true);
    for (const bad of ['2027-02-29', '2026-13-01', '2026-10-32', '2026-1-8', '08/10/2026', '', 'x']) {
      assert.equal(isIsoDate(bad), false, bad);
    }
  });
  test('appointment start is the Mauritius time as a UTC instant', () => {
    assert.equal(appointmentStart('2026-10-09', '08:30').toISOString(), '2026-10-09T04:30:00.000Z');
    assert.equal(appointmentStart('2026-10-09', '15:30:00').toISOString(), '2026-10-09T11:30:00.000Z');
  });
  test('booking date range: today or tomorrow up to 30 days', () => {
    const now = new Date('2026-10-08T06:00:00Z');
    assert.deepEqual(bookingDateRange(true, now), { min: '2026-10-08', max: '2026-11-07' });
    assert.deepEqual(bookingDateRange(false, now), { min: '2026-10-09', max: '2026-11-07' });
  });
});

/* --------------------------------- Times --------------------------------- */

describe('slot times', () => {
  test('normalize and label', () => {
    assert.equal(normalizeTime('09:30:00'), '09:30');
    assert.equal(normalizeTime(' 15:30 '), '15:30');
    assert.equal(normalizeTime('9:30'), null);
    assert.equal(normalizeTime('24:00'), null);
    assert.equal(normalizeTime(null), null);
    assert.equal(slotLabel('09:30'), '09:30 to 10:30');
    assert.equal(slotLabel('15:30:00'), '15:30 to 16:30');
    assert.equal(slotLabel('23:30'), '23:30 to 00:30');
    assert.equal(slotLabel('noon'), 'noon');
  });
});

/* ------------------------------- Cancel rule ------------------------------- */

describe('canCancelAppointment', () => {
  // 2026-10-09 10:30 in Mauritius = 06:30 UTC.
  const at = (iso) => new Date(iso);
  test('boundary at exactly 2 hours', () => {
    assert.equal(canCancelAppointment('2026-10-09', '10:30', 'Pending', at('2026-10-09T04:30:00Z')), true);
    assert.equal(canCancelAppointment('2026-10-09', '10:30', 'Pending', at('2026-10-09T04:30:00.001Z')), false);
    assert.equal(canCancelAppointment('2026-10-09', '10:30:00', 'Confirmed', at('2026-10-08T20:00:00Z')), true);
    assert.equal(canCancelAppointment('2026-10-09', '10:30', 'Confirmed', at('2026-10-09T07:00:00Z')), false);
  });
  test('only Pending and Confirmed', () => {
    const early = at('2026-10-01T00:00:00Z');
    for (const status of ['In Progress', 'Completed', 'Cancelled', 'No Show', 'Unknown']) {
      assert.equal(canCancelAppointment('2026-10-09', '10:30', status, early), false, status);
    }
  });
  test('bad dates or times are never cancellable', () => {
    const early = at('2026-10-01T00:00:00Z');
    assert.equal(canCancelAppointment('2026-02-30', '10:30', 'Pending', early), false);
    assert.equal(canCancelAppointment('2026-10-09', 'ten', 'Pending', early), false);
  });
});

describe('isUpcoming', () => {
  const now = new Date('2026-10-09T06:00:00Z'); // 10:00 in Mauritius
  test('active and not started yet', () => {
    assert.equal(isUpcoming('2026-10-09', '10:30', 'Pending', now), true);
    assert.equal(isUpcoming('2026-10-09', '09:30', 'Confirmed', now), false);
    assert.equal(isUpcoming('2026-10-01', '09:30', 'In Progress', now), true);
    for (const status of ['Completed', 'Cancelled', 'No Show']) {
      assert.equal(isUpcoming('2026-10-20', '10:30', status, now), false, status);
    }
  });
});

/* -------------------------------- Labels -------------------------------- */

describe('status labels', () => {
  test('customer-facing labels', () => {
    assert.equal(appointmentStatusLabel('Pending'), 'Awaiting confirmation');
    assert.equal(appointmentStatusLabel('Confirmed'), 'Confirmed');
    assert.equal(appointmentStatusLabel('In Progress'), 'In progress');
    assert.equal(appointmentStatusLabel('Completed'), 'Completed');
    assert.equal(appointmentStatusLabel('Cancelled'), 'Cancelled');
    assert.equal(appointmentStatusLabel('No Show'), 'Missed');
    assert.equal(appointmentStatusLabel('Other'), 'Other');
  });
  test('explanations', () => {
    assert.equal(appointmentStatusExplanation('Pending'), 'Awaiting confirmation: the dealership will confirm your time.');
    assert.match(appointmentStatusExplanation('No Show'), /^Missed:/);
    assert.equal(appointmentStatusExplanation('Other'), 'Other');
  });
});

/* ------------------------------ Validation ------------------------------ */

describe('booking validation', () => {
  const ok = { bikeId: '4', type: 'Service', serviceIds: ['1', '2'], date: '2026-10-09', time: '09:30' };
  const issueField = (input) => {
    const r = bookingSchema.safeParse(input);
    assert.equal(r.success, false, JSON.stringify(input));
    return r.error.issues[0].path[0];
  };
  test('a valid booking', () => {
    assert.deepEqual(bookingSchema.parse(ok), { bikeId: 4, type: 'Service', serviceIds: [1, 2], date: '2026-10-09', time: '09:30' });
  });
  test('bike id', () => {
    for (const bikeId of ['', '0', '-1', '1.5', 'abc', '99999999999', '2147483648']) {
      assert.equal(issueField({ ...ok, bikeId }), 'bikeId', bikeId);
    }
  });
  test('type', () => {
    for (const type of ['', 'service', 'Wash', 'Other ']) assert.equal(issueField({ ...ok, type }), 'type', type);
    for (const type of APPOINTMENT_TYPES) assert.equal(bookingSchema.safeParse({ ...ok, type }).success, true);
  });
  test('services: 1 to 5 distinct positive ids', () => {
    assert.equal(issueField({ ...ok, serviceIds: [] }), 'serviceIds');
    assert.equal(issueField({ ...ok, serviceIds: ['1', '2', '3', '4', '5', '6'] }), 'serviceIds');
    assert.equal(issueField({ ...ok, serviceIds: ['1', '1'] }), 'serviceIds');
    assert.equal(issueField({ ...ok, serviceIds: ['0'] }), 'serviceIds');
    assert.equal(issueField({ ...ok, serviceIds: ['x'] }), 'serviceIds');
    assert.equal(bookingSchema.safeParse({ ...ok, serviceIds: ['1', '2', '3', '4', '5'] }).success, true);
  });
  test('date and time', () => {
    for (const date of ['', '2026-02-30', '09/10/2026', '2026-10-9']) assert.equal(issueField({ ...ok, date }), 'date', date);
    for (const time of ['', '08:00', '16:30', '9:30', '09:30:00']) assert.equal(issueField({ ...ok, time }), 'time', time);
  });
  test('price and status from the browser are ignored', () => {
    const r = bookingSchema.parse({ ...ok, price: '1', status: 'Confirmed', total: 0 });
    assert.deepEqual(Object.keys(r).sort(), ['bikeId', 'date', 'serviceIds', 'time', 'type']);
  });
  test('appointment id', () => {
    assert.equal(appointmentIdSchema.parse('12'), 12);
    for (const bad of ['0', '-3', 'abc', '1e3', '']) assert.equal(appointmentIdSchema.safeParse(bad).success, false, bad);
  });
});

/* ---------------------------- Error mapping ---------------------------- */

describe('create_my_appointment error mapping', () => {
  const err = (message) => ({ code: 'P0001', message });
  test('every function error', () => {
    assert.deepEqual(mapBookingError(err('NO_PROFILE')), { kind: 'no_profile' });
    assert.deepEqual(mapBookingError(err('SLOT_FULL')), { kind: 'error', message: BOOKING_MESSAGES.slotFull, field: 'time', refreshSlots: true });
    assert.deepEqual(mapBookingError(err('ALREADY_BOOKED')), { kind: 'error', message: BOOKING_MESSAGES.alreadyBooked, refreshSlots: true });
    for (const t of ['SLOT_INVALID', 'SLOT_OUT_OF_RANGE', 'INVALID_RANGE']) {
      assert.deepEqual(mapBookingError(err(t)), { kind: 'error', message: BOOKING_MESSAGES.slotUnavailable, field: 'time', refreshSlots: true }, t);
    }
    assert.equal(mapBookingError(err('BIKE_NOT_FOUND')).field, 'bikeId');
    assert.equal(mapBookingError(err('INVALID_TYPE')).field, 'type');
    assert.equal(mapBookingError(err('INVALID_SERVICES')).field, 'serviceIds');
  });
  test('wording from the spec', () => {
    assert.equal(BOOKING_MESSAGES.slotFull, 'That time was just taken. Please choose another.');
    assert.equal(BOOKING_MESSAGES.alreadyBooked, 'You already have an appointment for this motorcycle on that day.');
    assert.equal(BOOKING_MESSAGES.slotUnavailable, 'That time is not available.');
  });
  test('unknown, partial or permission errors are generic', () => {
    for (const e of [err('SLOT_FULLY'), { code: '42501', message: 'permission denied' }, {}]) {
      assert.deepEqual(mapBookingError(e), { kind: 'error', message: BOOKING_MESSAGES.generic, refreshSlots: true });
    }
    assert.equal(mapBookingError(err('error: ALREADY_BOOKED for bike 4')).message, BOOKING_MESSAGES.alreadyBooked);
  });
});
