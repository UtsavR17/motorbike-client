import Link from 'next/link';
import { Bike, UserRound } from 'lucide-react';
import { CartBadge } from '@/components/cart/CartBadge';
import { SHOP_NAME } from '@/config/shop';
import { displayName, getCurrentUser, getCustomerOrNull } from '@/lib/auth/session';
import { AccountMenu } from './AccountMenu';
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

/** First name (or email local part) of the signed-in user, or null for guests. */
async function headerAccountName(): Promise<string | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  try {
    return displayName(user, await getCustomerOrNull());
  } catch {
    // A profile lookup problem must not break every page; fall back to the email.
    return displayName(user, null);
  }
}

export async function SiteHeader() {
  const accountName = await headerAccountName();
  const linkClass =
    'hidden h-10 items-center gap-2 rounded-control px-3 text-sm font-medium text-white/90 hover:bg-white/10 hover:text-white lg:inline-flex';
  return (
    <header className="sticky top-0 z-40 bg-ink text-white shadow-sm">
      <div className="container-page relative flex h-16 items-center gap-4">
        <Logo />

        <div className="mx-auto hidden w-full max-w-xl lg:block">
          <HeaderSearch id="header-search" />
        </div>

        <div className="ml-auto flex items-center gap-1 lg:ml-0">
          {accountName ? (
            <div className="hidden lg:block">
              <AccountMenu name={accountName} />
            </div>
          ) : (
            <>
              <Link href="/login" className={linkClass}>
                <UserRound aria-hidden="true" className="h-5 w-5" />
                Sign in
              </Link>
              <Link href="/register" className={linkClass}>
                Register
              </Link>
            </>
          )}
          <CartBadge />
          <MobileMenu accountName={accountName} />
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
