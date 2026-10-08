// Customer-facing appointment status labels and explanations. The single place they are
// defined: the badge, list, detail page and tests all use these.

export const APPOINTMENT_STATUSES = ['Pending', 'Confirmed', 'In Progress', 'Completed', 'Cancelled', 'No Show'] as const;
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

const LABELS: Record<string, string> = {
  Pending: 'Awaiting confirmation',
  Confirmed: 'Confirmed',
  'In Progress': 'In progress',
  Completed: 'Completed',
  Cancelled: 'Cancelled',
  'No Show': 'Missed',
};

const EXPLANATIONS: Record<string, string> = {
  Pending: 'Awaiting confirmation: the dealership will confirm your time.',
  Confirmed: 'Confirmed: we look forward to seeing you and your motorcycle.',
  'In Progress': 'In progress: the workshop is working on your motorcycle.',
  Completed: 'Completed: the work on your motorcycle is done.',
  Cancelled: 'Cancelled: this appointment will not take place.',
  'No Show': 'Missed: the motorcycle was not brought in at the booked time.',
};

export function appointmentStatusLabel(status: string): string {
  return LABELS[status] ?? status;
}

export function appointmentStatusExplanation(status: string): string {
  return EXPLANATIONS[status] ?? appointmentStatusLabel(status);
}
