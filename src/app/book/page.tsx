import type { Metadata } from 'next';
import Link from 'next/link';
import { Bike, Clock, Plus, Wrench } from 'lucide-react';
import { BookingForm } from '@/components/appointments/BookingForm';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageIntro } from '@/components/ui/PageIntro';
import {
  APPOINTMENT_CANCEL_LEAD_HOURS,
  APPOINTMENT_MAX_SERVICES,
  APPOINTMENT_MIN_LEAD_HOURS,
  APPOINTMENT_SLOT_TEXT,
  WORKSHOP_HOURS_TEXT,
} from '@/config/shop';
import { getSlotsForDay } from '@/lib/account/appointments';
import { bikeName, listMyBikes } from '@/lib/account/garage';
import { bookingDateRange, mauritiusToday } from '@/lib/appointments/time';
import { requireCustomer } from '@/lib/auth/session';
import { listServices } from '@/lib/catalog/services';
import type { SearchParams } from '@/lib/params';

export const metadata: Metadata = {
  title: 'Book a service',
  robots: { index: false, follow: false },
};

const CRUMBS = [{ href: '/', label: 'Home' }, { href: '/services', label: 'Services' }, { label: 'Book a service' }];

/** Positive integer ids from one or more query values ("?service=1&service=2"). */
function idsFrom(value: string | string[] | undefined): number[] {
  const list = Array.isArray(value) ? value : value ? [value] : [];
  return list.filter((v) => /^\d{1,9}$/.test(v)).map(Number).filter((n) => n > 0);
}

async function todayHasBookableSlot(): Promise<boolean> {
  try {
    return (await getSlotsForDay(mauritiusToday())).some((s) => s.state === 'available');
  } catch {
    return false;
  }
}

export default async function BookPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const wantedBikes = idsFrom(sp.bike);
  const wantedServices = idsFrom(sp.service);

  // Signed-out visitors return here (with the same pre-selection) after signing in.
  const next = new URLSearchParams();
  if (wantedBikes[0]) next.set('bike', String(wantedBikes[0]));
  wantedServices.slice(0, APPOINTMENT_MAX_SERVICES).forEach((id) => next.append('service', String(id)));
  const { customer } = await requireCustomer(next.size ? `/book?${next.toString()}` : '/book');

  const [bikes, services, todayOpen] = await Promise.all([
    listMyBikes(customer.id),
    listServices(),
    todayHasBookableSlot(),
  ]);

  // Ignore ids that are not the customer's bikes or not offered services.
  const initialBikeId = bikes.some((b) => b.id === wantedBikes[0]) ? wantedBikes[0] : null;
  const initialServiceIds = [...new Set(wantedServices)]
    .filter((id) => services.some((s) => s.service_id === id))
    .slice(0, APPOINTMENT_MAX_SERVICES);
  const range = bookingDateRange(todayOpen);

  return (
    <>
      <PageIntro
        title="Book a service"
        description={`Choose your motorcycle, the work you need and a time. The workshop is open ${WORKSHOP_HOURS_TEXT}; each appointment lasts ${APPOINTMENT_SLOT_TEXT}.`}
        crumbs={CRUMBS}
      />
      <div className="container-page py-6 lg:py-8">
        {bikes.length === 0 ? (
          <EmptyState
            icon={Bike}
            title="Add your motorcycle first"
            action={
              <Link href="/account/garage/new" className="btn-primary h-11">
                <Plus aria-hidden="true" className="h-4 w-4" />
                Add a bike to your garage
              </Link>
            }
          >
            Appointments are booked for a motorcycle in your garage. Add yours, then come back to book.
          </EmptyState>
        ) : services.length === 0 ? (
          <EmptyState icon={Wrench} title="Online booking is not available right now">
            No workshop services are listed at the moment. Please contact the dealership to book.
          </EmptyState>
        ) : (
          <>
            <p className="mb-6 flex gap-2 text-sm text-ink-muted">
              <Clock aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-accent-strong" />
              <span>
                Book at least {APPOINTMENT_MIN_LEAD_HOURS} hours ahead. You can cancel online up to{' '}
                {APPOINTMENT_CANCEL_LEAD_HOURS} hours before your appointment.
              </span>
            </p>
            <BookingForm
              bikes={bikes.map((b) => ({ id: b.id, name: bikeName(b), registration: b.registration, year: b.year }))}
              services={services.map((s) => ({ id: s.service_id, name: s.name, description: s.description, cost: s.cost }))}
              initialBikeId={initialBikeId}
              initialServiceIds={initialServiceIds}
              minDate={range.min}
              maxDate={range.max}
            />
          </>
        )}
      </div>
    </>
  );
}
