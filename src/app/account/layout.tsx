import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { AccountNav } from '@/components/account/AccountNav';

// Account pages are private: keep them out of search engines.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

// Each page checks the user itself (requireUser / requireCustomer); this layout only frames them.
export default function AccountLayout({ children }: { children: ReactNode }) {
  return (
    <div className="container-page grid gap-6 py-6 lg:grid-cols-[220px_1fr] lg:gap-8 lg:py-10">
      <aside>
        <AccountNav />
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
