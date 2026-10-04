import Link from 'next/link';
import { Bike, ShoppingCart, UserRound } from 'lucide-react';
import { SHOP_NAME } from '@/config/shop';
import { HeaderSearch } from './HeaderSearch';
import { MobileMenu } from './MobileMenu';
import { NavLinks } from './NavLinks';

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 rounded-control text-white">
      <span className="flex h-9 w-9 items-center justify-center rounded-control bg-accent text-ink">
        <Bike aria-hidden="true" className="h-5 w-5" />
      </span>
      <span className="text-lg font-bold tracking-tight">{SHOP_NAME}</span>
    </Link>
  );
}

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 bg-ink text-white shadow-sm">
      <div className="container-page relative flex h-16 items-center gap-4">
        <Logo />

        <div className="mx-auto hidden w-full max-w-xl lg:block">
          <HeaderSearch id="header-search" />
        </div>

        <div className="ml-auto flex items-center gap-1 lg:ml-0">
          <Link
            href="/login"
            className="hidden h-10 items-center gap-2 rounded-control px-3 text-sm font-medium text-white/90 hover:bg-white/10 hover:text-white lg:inline-flex"
          >
            <UserRound aria-hidden="true" className="h-5 w-5" />
            Sign in
          </Link>
          <Link
            href="/cart"
            className="inline-flex h-10 w-10 items-center justify-center rounded-control text-white/90 hover:bg-white/10 hover:text-white"
          >
            <ShoppingCart aria-hidden="true" className="h-5 w-5" />
            <span className="sr-only">Cart</span>
          </Link>
          <MobileMenu />
        </div>
      </div>

      <nav aria-label="Main" className="hidden border-t border-white/10 bg-ink-soft lg:block">
        <div className="container-page">
          <NavLinks />
        </div>
      </nav>
    </header>
  );
}
