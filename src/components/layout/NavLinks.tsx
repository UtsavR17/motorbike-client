'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NAV_LINKS } from './nav';

export function isActivePath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Desktop navigation row. */
export function NavLinks() {
  const pathname = usePathname();
  return (
    <ul className="flex items-center gap-1">
      {NAV_LINKS.map((link) => {
        const active = isActivePath(pathname, link.href);
        return (
          <li key={link.href}>
            <Link
              href={link.href}
              aria-current={active ? 'page' : undefined}
              className={`inline-flex h-11 items-center border-b-2 px-3 text-sm font-medium transition-colors ${
                active
                  ? 'border-accent text-white'
                  : 'border-transparent text-white/80 hover:text-white'
              }`}
            >
              {link.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
