'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bike, LayoutDashboard, LogOut, Menu, Package, UserRound, UserRoundPlus, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { signOutAction } from '@/lib/actions/auth';
import { HeaderSearch } from './HeaderSearch';
import { isActivePath } from './NavLinks';
import { NAV_LINKS } from './nav';

/** Hamburger menu for small screens: search, navigation and account links. */
export function MobileMenu({ accountName }: { accountName: string | null }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Close with Escape and return focus to the toggle button.
  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const close = () => setOpen(false);
  const accountLink = 'flex items-center gap-2 py-3 text-left text-base font-medium text-white hover:text-accent';

  return (
    <div className="lg:hidden">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls="mobile-menu"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-10 w-10 items-center justify-center rounded-control text-white hover:bg-white/10"
      >
        {open ? <X aria-hidden="true" className="h-6 w-6" /> : <Menu aria-hidden="true" className="h-6 w-6" />}
        <span className="sr-only">{open ? 'Close menu' : 'Open menu'}</span>
      </button>

      <div
        id="mobile-menu"
        hidden={!open}
        className="absolute inset-x-0 top-full border-t border-white/10 bg-ink-soft pb-4 shadow-lg"
      >
        <div className="container-page pt-4">
          <HeaderSearch id="mobile-search" onNavigate={close} />
          <nav aria-label="Mobile" className="mt-3">
            <ul className="divide-y divide-white/10">
              {NAV_LINKS.map((link) => {
                const active = isActivePath(pathname, link.href);
                return (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      onClick={close}
                      aria-current={active ? 'page' : undefined}
                      className={`block py-3 text-base font-medium ${
                        active ? 'text-accent' : 'text-white hover:text-accent'
                      }`}
                    >
                      {link.label}
                    </Link>
                  </li>
                );
              })}
              {accountName ? (
                <>
                  <li>
                    <Link href="/account" onClick={close} className={accountLink}>
                      <LayoutDashboard aria-hidden="true" className="h-5 w-5" />
                      Account ({accountName})
                    </Link>
                  </li>
                  <li>
                    <Link href="/account/orders" onClick={close} className={accountLink}>
                      <Package aria-hidden="true" className="h-5 w-5" />
                      Orders
                    </Link>
                  </li>
                  <li>
                    <Link href="/account/garage" onClick={close} className={accountLink}>
                      <Bike aria-hidden="true" className="h-5 w-5" />
                      Garage
                    </Link>
                  </li>
                  <li>
                    <form action={signOutAction}>
                      <button type="submit" className={`${accountLink} w-full`}>
                        <LogOut aria-hidden="true" className="h-5 w-5" />
                        Sign out
                      </button>
                    </form>
                  </li>
                </>
              ) : (
                <>
                  <li>
                    <Link href="/login" onClick={close} className={accountLink}>
                      <UserRound aria-hidden="true" className="h-5 w-5" />
                      Sign in
                    </Link>
                  </li>
                  <li>
                    <Link href="/register" onClick={close} className={accountLink}>
                      <UserRoundPlus aria-hidden="true" className="h-5 w-5" />
                      Register
                    </Link>
                  </li>
                </>
              )}
            </ul>
          </nav>
        </div>
      </div>
    </div>
  );
}
