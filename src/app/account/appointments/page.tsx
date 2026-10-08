import type { Metadata } from 'next';
import Link from 'next/link';
import { CalendarCheck, CalendarClock, History } from 'lucide-react';
import { AppointmentCard } from '@/components/appointments/AppointmentCard';
import { Notice } from '@/components/forms/FormMessage';
import { EmptyState } from '@/components/ui/EmptyState';
import { listMyAppointments } from '@/lib/account/appointments';
import { noticeText } from '@/lib/account/notices';
import { appointmentStart, canCancelAppointment, isUpcoming } from '@/lib/appointments/time';
import { requireCustomer } from '@/lib/auth/session';
import type { SearchParams } from '@/lib/params';

export const metadata: Metadata = { title: 'My appointments' };

const BookButton = () => (
  <Link href="/book" className="btn-primary h-11">
    <CalendarCheck aria-hidden="true" className="h-4 w-4" />
    Book a service
  </Link>
);

export default async function AppointmentsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireCustomer('/account/appointments');
  const appointments = await listMyAppointments();
  const notice = noticeText((await searchParams).notice);
  const now = new Date();

  const start = (a: (typeof appointments)[number]) => appointmentStart(a.date, a.time).getTime();
  const upcoming = appointments
    .filter((a) => isUpcoming(a.date, a.time, a.status, now))
    .sort((a, b) => start(a) - start(b));
  const past = appointments
    .filter((a) => !isUpcoming(a.date, a.time, a.status, now))
    .sort((a, b) => start(b) - start(a));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">My appointments</h1>
          <p className="mt-1 text-ink-muted">Workshop bookings for your motorcycles.</p>
        </div>
        <BookButton />
      </div>

      {notice && <Notice tone={notice.includes('no longer') ? 'warn' : 'success'}>{notice}</Notice>}

      <section aria-labelledby="upcoming-heading" className="space-y-3">
        <h2 id="upcoming-heading" className="text-lg font-semibold">Upcoming</h2>
        {upcoming.length === 0 ? (
          <EmptyState icon={CalendarClock} title="No upcoming appointments" action={<BookButton />}>
            Book a service for one of your motorcycles and it will appear here.
          </EmptyState>
        ) : (
          <ul className="space-y-3">
            {upcoming.map((a) => (
              <AppointmentCard key={a.id} appointment={a} canCancel={canCancelAppointment(a.date, a.time, a.status, now)} />
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="past-heading" className="space-y-3">
        <h2 id="past-heading" className="text-lg font-semibold">Past</h2>
        {past.length === 0 ? (
          <EmptyState icon={History} title="No past appointments">
            Completed, cancelled and missed appointments are listed here.
          </EmptyState>
        ) : (
          <ul className="space-y-3">
            {past.map((a) => (
              <AppointmentCard key={a.id} appointment={a} canCancel={false} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
