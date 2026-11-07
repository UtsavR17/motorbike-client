import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import type { ReactNode } from 'react';
import { CartProvider } from '@/components/cart/CartProvider';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { SHOP_NAME, SHOP_TAGLINE } from '@/config/shop';
import { getCurrentUser } from '@/lib/auth/session';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });

export const metadata: Metadata = {
  title: { template: `%s | ${SHOP_NAME}`, default: `${SHOP_NAME}: ${SHOP_TAGLINE}` },
  description:
    'Browse new motorcycles, genuine spare parts with live stock levels, and workshop services.',
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  // Whose cart this device shows (DEC-10). getCurrentUser is cached per request (the header uses it too).
  const user = await getCurrentUser();
  return (
    // suppressHydrationWarning: browser extensions inject attributes before React loads (dev-only warning, not an app bug).
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body className="flex min-h-screen flex-col font-sans" suppressHydrationWarning>
        <a
          href="#main"
          className="sr-only z-50 rounded-control bg-accent px-4 py-2 font-semibold text-ink focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
        >
          Skip to content
        </a>
        <CartProvider ownerId={user?.id ?? null}>
          <SiteHeader />
          <main id="main" className="flex-1">
            {children}
          </main>
          <SiteFooter />
        </CartProvider>
      </body>
    </html>
  );
}
