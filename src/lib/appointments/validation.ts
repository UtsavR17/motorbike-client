// Server-side validation for appointments. Only ids, the type, the date and the time come from
// the browser; never prices or status. The database checks everything again.

import { z } from 'zod';
import { APPOINTMENT_MAX_SERVICES, APPOINTMENT_SLOT_TIMES, APPOINTMENT_TYPES } from '@/config/shop';
import { isIsoDate } from './time';

const positiveId = (message: string) =>
  z
    .string()
    .regex(/^\d{1,10}$/, message)
    .transform(Number)
    .refine((n) => n > 0 && n <= 2_147_483_647, message);

export const appointmentDateSchema = z.string().refine(isIsoDate, 'Choose a valid date');

export const bookingSchema = z.object({
  bikeId: positiveId('Choose one of your motorcycles'),
  type: z.enum(APPOINTMENT_TYPES, 'Choose an appointment type'),
  serviceIds: z
    .array(positiveId('Choose services from the list'))
    .min(1, 'Choose at least one service')
    .max(APPOINTMENT_MAX_SERVICES, `Choose at most ${APPOINTMENT_MAX_SERVICES} services`)
    .refine((ids) => new Set(ids).size === ids.length, 'Each service can be chosen only once'),
  date: appointmentDateSchema,
  time: z.enum(APPOINTMENT_SLOT_TIMES, 'Choose a time'),
});

export type BookingInput = z.output<typeof bookingSchema>;

/** Appointment id from a URL or form value. */
export const appointmentIdSchema = z
  .string()
  .regex(/^\d{1,9}$/)
  .transform(Number)
  .refine((n) => n > 0);
