import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Bike, CalendarClock, Package, ShieldCheck, UserRound, UserRoundPlus } from 'lucide-react';
import { Notice } from '@/components/forms/FormMessage';
import { noticeText } from '@/lib/account/notices';
import { displayName, getCustomerOrNull, requireUser } from '@/lib/auth/session';
import type { SearchParams } from '@/lib/params';

export const metadata: Metadata = { title: 'My account' };

const QUICK_LINKS = [
  { href: '/account/profile', label: 'Profile', text: 'Your name, phone and address.', Icon: UserRound },
  { href: '/account/garage', label: 'Garage', text: 'Your bikes, and parts that fit them.', Icon: Bike },
  { href: '/account/security', label: 'Security', text: 'Change your password.', Icon: ShieldCheck },
];

export default async function AccountPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requireUser('/account');
  const customer = await getCustomerOrNull();
  const notice = noticeText((await searchParams).notice);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Hello, {displayName(user, customer)}</h1>
        <p className="mt-1 text-ink-muted">Manage your details, your bikes and your sign-in.</p>
      </div>

      {notice && <Notice>{notice}</Notice>}

      {!customer && (
        <section aria-labelledby="complete-heading" className="rounded-card border-2 border-accent bg-accent-soft p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-3">
              <UserRoundPlus aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0 text-accent-strong" />
              <div>
                <h2 id="complete-heading" className="font-semibold">Complete your profile</h2>
                <p className="text-sm text-ink-muted">
                  Add your contact details to use your garage. If you have visited us before, we will link your
                  existing customer record.
                </p>
              </div>
            </div>
            <Link href="/account/profile/complete" className="btn-primary h-11 shrink-0">
              Complete profile
            </Link>
          </div>
        </section>
      )}

      {customer && (
        <section aria-labelledby="summary-heading" className="card p-5">
          <div className="flex items-start justify-between gap-3">
            <h2 id="summary-heading" className="font-semibold">Your profile</h2>
            <Link href="/account/profile" className="link text-sm">Edit</Link>
          </div>
          <dl className="mt-3 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-ink-muted">Name</dt>
              <dd className="font-medium">{customer.firstName} {customer.lastName}</dd>
            </div>
            <div>
              <dt className="text-ink-muted">Email</dt>
              <dd className="font-medium break-all">{customer.email}</dd>
            </div>
            <div>
              <dt className="text-ink-muted">Phone</dt>
              <dd className="font-medium">{customer.phone}</dd>
            </div>
            <div>
              <dt className="text-ink-muted">Address</dt>
              <dd className="font-medium">
                {[customer.homeNumber, customer.street, customer.town, customer.postCode].filter(Boolean).join(', ')}
              </dd>
            </div>
          </dl>
        </section>
      )}

      <section aria-labelledby="links-heading">
        <h2 id="links-heading" className="sr-only">Quick links</h2>
        <ul className="grid gap-4 sm:grid-cols-3">
          {QUICK_LINKS.map(({ href, label, text, Icon }) => (
            <li key={href}>
              <Link href={href} className="card group flex h-full flex-col gap-2 p-5 transition-colors hover:border-ink">
                <Icon aria-hidden="true" className="h-6 w-6 text-accent-strong" />
                <span className="flex items-center gap-1 font-semibold">
                  {label}
                  <ArrowRight aria-hidden="true" className="h-4 w-4 opacity-60 group-hover:opacity-100" />
                </span>
                <span className="text-sm text-ink-muted">{text}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="soon-heading">
        <h2 id="soon-heading" className="mb-3 text-lg font-semibold">Coming soon</h2>
        <ul className="grid gap-4 sm:grid-cols-2">
          <li className="card flex gap-3 p-5">
            <Package aria-hidden="true" className="h-6 w-6 shrink-0 text-ink-muted" />
            <div>
              <p className="font-semibold">Orders</p>
              <p className="text-sm text-ink-muted">Order parts online and track them here.</p>
            </div>
          </li>
          <li className="card flex gap-3 p-5">
            <CalendarClock aria-hidden="true" className="h-6 w-6 shrink-0 text-ink-muted" />
            <div>
              <p className="font-semibold">Appointments</p>
              <p className="text-sm text-ink-muted">Book a service for one of your bikes.</p>
            </div>
          </li>
        </ul>
      </section>
    </div>
  );
}
