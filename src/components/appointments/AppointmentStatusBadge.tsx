import { CalendarCheck, CalendarX, CheckCircle2, Clock, Cog, UserX } from 'lucide-react';
import { appointmentStatusLabel } from '@/lib/appointments/status';

const STYLES: Record<string, { className: string; Icon: typeof Clock }> = {
  Pending: { className: 'bg-warn-soft text-warn', Icon: Clock },
  Confirmed: { className: 'bg-ok-soft text-ok', Icon: CalendarCheck },
  'In Progress': { className: 'bg-accent-soft text-ink', Icon: Cog },
  Completed: { className: 'bg-ink text-white', Icon: CheckCircle2 },
  Cancelled: { className: 'bg-bad-soft text-bad', Icon: CalendarX },
  'No Show': { className: 'bg-page text-ink-muted', Icon: UserX },
};

/** The single appointment status badge used on the list, detail and account pages. */
export function AppointmentStatusBadge({ status }: { status: string }) {
  const style = STYLES[status] ?? { className: 'bg-page text-ink', Icon: Clock };
  const { Icon } = style;
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${style.className}`}
    >
      <Icon aria-hidden="true" className="h-3.5 w-3.5" />
      {appointmentStatusLabel(status)}
    </span>
  );
}
