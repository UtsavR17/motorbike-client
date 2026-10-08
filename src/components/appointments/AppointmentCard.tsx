import Link from 'next/link';
import { CalendarClock } from 'lucide-react';
import { AppointmentStatusBadge } from '@/components/appointments/AppointmentStatusBadge';
import { CancelAppointmentButton } from '@/components/appointments/CancelAppointmentButton';
import type { MyAppointment } from '@/lib/account/appointments';
import { slotLabel } from '@/lib/appointments/time';
import { formatDate, formatMoney } from '@/lib/format';

export function appointmentBikeText(a: Pick<MyAppointment, 'bikeLabel' | 'registration'>): string {
  const label = a.bikeLabel ?? 'Motorcycle';
  return a.registration ? `${label} (${a.registration})` : label;
}

/** One appointment in the list. `canCancel` is decided by the page (canCancelAppointment). */
export function AppointmentCard({ appointment: a, canCancel }: { appointment: MyAppointment; canCancel: boolean }) {
  const when = `${formatDate(a.date) ?? a.date}, ${slotLabel(a.time)}`;
  return (
    <li className="card p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex gap-3">
          <CalendarClock aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-accent-strong" />
          <div>
            <h3 className="font-semibold">
              <Link href={`/account/appointments/${a.id}`} className="hover:text-accent-strong hover:underline">
                {when}
              </Link>
            </h3>
            <p className="text-sm text-ink-muted">
              {a.type} for {appointmentBikeText(a)}
            </p>
          </div>
        </div>
        <AppointmentStatusBadge status={a.status} />
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          {a.total > 0 && (
            <span>
              Total <strong>{formatMoney(a.total)}</strong>
            </span>
          )}
          <Link href={`/account/appointments/${a.id}`} className="link">
            View details<span className="sr-only"> of the appointment on {when}</span>
          </Link>
        </div>
        {canCancel && <CancelAppointmentButton appointmentId={a.id} label={when} from="list" />}
      </div>
    </li>
  );
}
