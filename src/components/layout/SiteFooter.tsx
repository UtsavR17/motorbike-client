import Link from 'next/link';
import { Store, Truck } from 'lucide-react';
import { DELIVERY_ESTIMATE, PICKUP_ESTIMATE, SHOP_NAME, SHOP_TAGLINE } from '@/config/shop';
import { NAV_LINKS } from './nav';

export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-16 bg-ink text-white/80">
      <div className="container-page grid gap-10 py-12 md:grid-cols-3">
        <section aria-labelledby="footer-about">
          <h2 id="footer-about" className="text-base font-semibold text-white">
            {SHOP_NAME}
          </h2>
          <p className="mt-3 text-sm leading-relaxed">
            {SHOP_TAGLINE}. A local dealership selling new motorcycles, genuine spare parts and
            workshop services, with honest prices and real stock levels.
          </p>
        </section>

        <nav aria-labelledby="footer-shop">
          <h2 id="footer-shop" className="text-base font-semibold text-white">
            Shop
          </h2>
          <ul className="mt-3 space-y-2 text-sm">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="hover:text-accent">
                  {link.label}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/login" className="hover:text-accent">
                Sign in
              </Link>
            </li>
          </ul>
        </nav>

        <section aria-labelledby="footer-delivery">
          <h2 id="footer-delivery" className="text-base font-semibold text-white">
            Delivery and pickup
          </h2>
          <ul className="mt-3 space-y-3 text-sm">
            <li className="flex gap-2">
              <Truck aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
              <span>Home delivery on parts: {DELIVERY_ESTIMATE}.</span>
            </li>
            <li className="flex gap-2">
              <Store aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
              <span>Store pickup: {PICKUP_ESTIMATE.toLowerCase()}. Motorcycles are collected at the dealership.</span>
            </li>
          </ul>
        </section>
      </div>
      <div className="border-t border-white/10">
        <p className="container-page py-4 text-xs text-white/60">
          &copy; {year} {SHOP_NAME}. Prices and availability can change as stock moves.
        </p>
      </div>
    </footer>
  );
}
