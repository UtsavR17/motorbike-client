'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bike, ChevronDown, LayoutDashboard, LogOut, UserRound } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { signOutAction } from '@/lib/actions/auth';

/** Signed-in header menu: Account, Garage and Sign out. */
export function AccountMenu({ name }: { name: string }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Close on route change.
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    function onPointer(event: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
    };
  }, [open]);

  const itemClass =
    'flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium text-ink hover:bg-page';

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls="account-menu"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-10 max-w-48 items-center gap-2 rounded-control px-3 text-sm font-medium text-white/90 hover:bg-white/10 hover:text-white"
      >
        <UserRound aria-hidden="true" className="h-5 w-5 shrink-0" />
        <span className="truncate">{name}</span>
        <ChevronDown aria-hidden="true" className="h-4 w-4 shrink-0" />
        <span className="sr-only">: account menu</span>
      </button>
      <div
        id="account-menu"
        hidden={!open}
        className="absolute right-0 top-full z-50 mt-2 w-52 rounded-card border border-line bg-card p-1.5 shadow-lg"
      >
        <ul>
          <li>
            <Link href="/account" className={itemClass}>
              <LayoutDashboard aria-hidden="true" className="h-4 w-4" />
              Account
            </Link>
          </li>
          <li>
            <Link href="/account/garage" className={itemClass}>
              <Bike aria-hidden="true" className="h-4 w-4" />
              Garage
            </Link>
          </li>
          <li className="mt-1 border-t border-line pt-1">
            <form action={signOutAction}>
              <button type="submit" className={itemClass}>
                <LogOut aria-hidden="true" className="h-4 w-4" />
                Sign out
              </button>
            </form>
          </li>
        </ul>
      </div>
    </div>
  );
}
