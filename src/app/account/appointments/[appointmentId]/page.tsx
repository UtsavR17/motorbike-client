import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CheckCircle2, Phone, Store, UserCheck, UserRoundSearch } from 'lucide-react';
import { appointmentBikeText } from '@/components/appointments/AppointmentCard';
import { AppointmentStatusBadge } from '@/components/appointments/AppointmentStatusBadge';
import { CancelAppointmentButton } from '@/components/appointments/CancelAppointmentButton';
import { Notice } from '@/components/forms/FormMessage';
import { Breadcrumbs } from '@/components/ui/PageIntro';
import { APPOINTMENT_CANCEL_LEAD_HOURS, SHOP_PHONE, WORKSHOP_HOURS_TEXT } from '@/config/shop';
import { getAppointmentParts, getAppointmentServices, getMyAppointment } from '@/lib/account/appointments';
import { noticeText } from '@/lib/account/notices';
import { appointmentStatusExplanation } from '@/lib/appointments/status';
import { canCancelAppointment, slotLabel } from '@/lib/appointments/time';
import { appointmentIdSchema } from '@/lib/appointments/validation';
import { requireCustomer } from '@/lib/auth/session';
import { formatDate, formatMoney } from '@/lib/format';
import type { SearchParams } from '@/lib/params';

export const metadata: Metadata = { title: 'Appointment details' };

export default async function AppointmentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ appointmentId: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { appointmentId: raw } = await params;
  await requireCustomer('/account/appointments');
  const parsed = appointmentIdSchema.safeParse(raw);
  if (!parsed.success) notFound();
  // my_appointments only returns the signed-in customer's appointments: anyone else's id is a 404.
  const a = await getMyAppointment(parsed.data);
  if (!a) notFound();
  const [services, parts] = await Promise.all([getAppointmentServices(a.id), getAppointmentParts(a.id)]);
  const sp = await searchParams;
  const notice = noticeText(sp.notice);
  const booked = sp.booked === '1';

  const when = `${formatDate(a.date) ?? a.date}, ${slotLabel(a.time)}`;
  const servicesTotal = services.reduce((sum, s) => sum + s.unitCost * s.quantity, 0);
  const balance = Math.round((a.total - a.amountPaid) * 100) / 100;
  const cancellable = canCancelAppointment(a.date, a.time, a.status);
  const active = a.status === 'Pending' || a.status === 'Confirmed';

  return (
    <div className="space-y-6">
      <div>
        <Breadcrumbs items={[{ href: '/account/appointments', label: 'My appointments' }, { label: when }]} />
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Appointment</h1>
          <AppointmentStatusBadge status={a.status} />
        </div>
        <p className="mt-1 text-ink-muted">{appointmentStatusExplanation(a.status)}</p>
      </div>

      {booked && (
        <div role="status" className="flex gap-3 rounded-control bg-ok-soft px-4 py-3 text-sm text-ok">
          <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
          <span>
            <strong>Your appointment is booked.</strong> The dealership will confirm your time; you can follow the
            status here.
          </span>
        </div>
      )}
      {notice && <Notice tone={notice.includes('no longer') ? 'warn' : 'success'}>{notice}</Notice>}

      <section aria-labelledby="when-heading" className="card p-5">
        <h2 id="when-heading" className="sr-only">Appointment details</h2>
        <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-ink-muted">Date and time</dt>
            <dd className="font-semibold">{when}</dd>
          </div>
          <div>
            <dt className="text-ink-muted">Motorcycle</dt>
            <dd className="font-semibold">{appointmentBikeText(a)}</dd>
          </div>
          <div>
            <dt className="text-ink-muted">Type</dt>
            <dd className="font-semibold">{a.type}</dd>
          </div>
          <div>
            <dt className="text-ink-muted">Technician</dt>
            <dd className="flex items-center gap-1.5 font-semibold">
              {a.technicianAssigned ? (
                <>
                  <UserCheck aria-hidden="true" className="h-4 w-4 text-ok" />
                  A technician has been assigned
                </>
              ) : (
                <>
                  <UserRoundSearch aria-hidden="true" className="h-4 w-4 text-ink-muted" />
                  Not assigned yet
                </>
              )}
            </dd>
          </div>
        </dl>
        {active && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
            <p className="text-sm text-ink-muted">
              {cancellable
                ? `You can cancel online up to ${APPOINTMENT_CANCEL_LEAD_HOURS} hours before the appointment.`
                : 'This appointment can no longer be cancelled online. Please contact the dealership.'}
            </p>
            {cancellable && <CancelAppointmentButton appointmentId={a.id} label={when} from="detail" />}
          </div>
        )}
      </section>

      <section aria-labelledby="services-heading" className="card overflow-hidden">
        <h2 id="services-heading" className="px-5 pt-5 font-semibold">Services</h2>
        <table className="mt-3 w-full text-left text-sm">
          <caption className="sr-only">Services booked for this appointment</caption>
          <thead className="bg-page text-ink-muted">
            <tr>
              <th scope="col" className="px-5 py-3 font-medium">Service</th>
              <th scope="col" className="px-5 py-3 text-right font-medium">Qty</th>
              <th scope="col" className="px-5 py-3 text-right font-medium">Cost</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {services.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-5 py-3 text-ink-muted">No services recorded.</td>
              </tr>
            ) : (
              services.map((s, i) => (
                <tr key={`${s.name}-${i}`}>
                  <td className="px-5 py-3 font-medium">{s.name}</td>
                  <td className="px-5 py-3 text-right">{s.quantity}</td>
                  <td className="px-5 py-3 text-right font-semibold">{formatMoney(s.unitCost * s.quantity)}</td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot>
            <tr className="border-t border-line">
              <th scope="row" colSpan={2} className="px-5 py-3 text-right font-semibold">Services total</th>
              <td className="px-5 py-3 text-right font-bold">{formatMoney(servicesTotal)}</td>
            </tr>
          </tfoot>
        </table>
      </section>

      {parts.length > 0 && (
        <section aria-labelledby="parts-heading" className="card overflow-hidden">
          <h2 id="parts-heading" className="px-5 pt-5 font-semibold">Parts used</h2>
          <table className="mt-3 w-full text-left text-sm">
            <caption className="sr-only">Parts the workshop used</caption>
            <thead className="bg-page text-ink-muted">
              <tr>
                <th scope="col" className="px-5 py-3 font-medium">Part</th>
                <th scope="col" className="px-5 py-3 text-right font-medium">Qty</th>
                <th scope="col" className="px-5 py-3 text-right font-medium">Price</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {parts.map((p, i) => (
                <tr key={`${p.description}-${i}`}>
                  <td className="px-5 py-3 font-medium">{p.description}</td>
                  <td className="px-5 py-3 text-right">{p.quantity}</td>
                  <td className="px-5 py-3 text-right font-semibold">{formatMoney(p.unitPrice * p.quantity)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section aria-labelledby="payment-heading" className="card p-5">
        <h2 id="payment-heading" className="font-semibold">Payment</h2>
        <dl className="mt-3 space-y-2 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-ink-muted">Total (services and parts)</dt>
            <dd className="font-semibold">{formatMoney(a.total)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-ink-muted">Amount paid</dt>
            <dd className="font-semibold">{formatMoney(a.amountPaid)}</dd>
          </div>
          <div className="flex justify-between gap-3 border-t border-line pt-2 text-base">
            <dt className="font-semibold">Balance due</dt>
            <dd className="font-bold">{formatMoney(Math.max(balance, 0))}</dd>
          </div>
        </dl>
        <p className="mt-3 text-sm text-ink-muted">Payment is made at the dealership.</p>
      </section>

      <section aria-labelledby="contact-heading" className="card flex gap-3 p-5 text-sm">
        <Store aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-accent-strong" />
        <div>
          <h2 id="contact-heading" className="font-semibold">Questions about your appointment?</h2>
          <p className="mt-1 text-ink-muted">Workshop hours: {WORKSHOP_HOURS_TEXT}.</p>
          {SHOP_PHONE ? (
            <p className="mt-1 flex items-center gap-1.5">
              <Phone aria-hidden="true" className="h-4 w-4 text-accent-strong" />
              <a href={`tel:${SHOP_PHONE.replace(/[^\d+]/g, '')}`} className="link">{SHOP_PHONE}</a>
            </p>
          ) : (
            <p className="mt-1 text-ink-muted">Please visit or call the dealership.</p>
          )}
        </div>
      </section>

      <Link href="/account/appointments" className="link inline-block text-sm">Back to My appointments</Link>
    </div>
  );
}
