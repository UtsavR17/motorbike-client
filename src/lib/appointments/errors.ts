// Maps create_my_appointment and get_appointment_slots errors to what the customer should see.

interface ErrorLike {
  code?: string | null;
  message?: string | null;
}

const TOKENS = [
  'NO_PROFILE',
  'BIKE_NOT_FOUND',
  'INVALID_TYPE',
  'INVALID_SERVICES',
  'SLOT_INVALID',
  'SLOT_OUT_OF_RANGE',
  'SLOT_FULL',
  'ALREADY_BOOKED',
  'INVALID_RANGE',
] as const;

export type BookingOutcome =
  | { kind: 'no_profile' }
  | { kind: 'error'; message: string; field?: 'bikeId' | 'type' | 'serviceIds' | 'time'; refreshSlots: boolean };

export const BOOKING_MESSAGES = {
  slotFull: 'That time was just taken. Please choose another.',
  alreadyBooked: 'You already have an appointment for this motorcycle on that day.',
  slotUnavailable: 'That time is not available.',
  bikeNotFound: 'That motorcycle is not in your garage. Please choose another one.',
  invalidType: 'Choose a valid appointment type.',
  invalidServices: 'One of the selected services is no longer offered. Please review your choice.',
  generic: 'We could not book your appointment right now. Please try again.',
} as const;

function tokenOf(message: string | null | undefined): (typeof TOKENS)[number] | null {
  const m = message ?? '';
  for (const t of TOKENS) if (new RegExp(`(^|[^A-Z_])${t}($|[^A-Z_])`).test(m)) return t;
  return null;
}

export function mapBookingError(e: ErrorLike): BookingOutcome {
  switch (tokenOf(e.message)) {
    case 'NO_PROFILE':
      return { kind: 'no_profile' };
    case 'SLOT_FULL':
      return { kind: 'error', message: BOOKING_MESSAGES.slotFull, field: 'time', refreshSlots: true };
    case 'ALREADY_BOOKED':
      return { kind: 'error', message: BOOKING_MESSAGES.alreadyBooked, refreshSlots: true };
    case 'SLOT_INVALID':
    case 'SLOT_OUT_OF_RANGE':
    case 'INVALID_RANGE':
      return { kind: 'error', message: BOOKING_MESSAGES.slotUnavailable, field: 'time', refreshSlots: true };
    case 'BIKE_NOT_FOUND':
      return { kind: 'error', message: BOOKING_MESSAGES.bikeNotFound, field: 'bikeId', refreshSlots: false };
    case 'INVALID_TYPE':
      return { kind: 'error', message: BOOKING_MESSAGES.invalidType, field: 'type', refreshSlots: false };
    case 'INVALID_SERVICES':
      return { kind: 'error', message: BOOKING_MESSAGES.invalidServices, field: 'serviceIds', refreshSlots: false };
    default:
      return { kind: 'error', message: BOOKING_MESSAGES.generic, refreshSlots: true };
  }
}
