'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bike, Building2, CalendarClock, LayoutDashboard, LogOut, Package, ShieldCheck, UserRound } from 'lucide-react';
import { signOutAction } from '@/lib/actions/auth';

const LINKS = [
  { href: '/account', label: 'Overview', Icon: LayoutDashboard, exact: true },
  { href: '/account/orders', label: 'Orders', Icon: Package, exact: false },
  { href: '/account/appointments', label: 'Appointments', Icon: CalendarClock, exact: false },
  { href: '/account/profile', label: 'Profile', Icon: UserRound, exact: false },
  { href: '/account/garage', label: 'Garage', Icon: Bike, exact: false },
  { href: '/account/supplier-application', label: 'Supplier application', Icon: Building2, exact: false },
  { href: '/account/security', label: 'Security', Icon: ShieldCheck, exact: false },
];

export function AccountNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Account" className="card p-2">
      <ul className="flex flex-wrap gap-1 lg:flex-col">
        {LINKS.map(({ href, label, Icon, exact }) => {
          const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={`flex items-center gap-2 rounded-control px-3 py-2 text-sm font-medium transition-colors ${
                  active ? 'bg-ink text-white' : 'text-ink hover:bg-page'
                }`}
              >
                <Icon aria-hidden="true" className="h-4 w-4" />
                {label}
              </Link>
            </li>
          );
        })}
        <li className="lg:mt-2 lg:border-t lg:border-line lg:pt-2">
          <form action={signOutAction}>
            <button
              type="submit"
              className="flex w-full items-center gap-2 rounded-control px-3 py-2 text-sm font-medium text-ink hover:bg-page"
            >
              <LogOut aria-hidden="true" className="h-4 w-4" />
              Sign out
            </button>
          </form>
        </li>
      </ul>
    </nav>
  );
}
