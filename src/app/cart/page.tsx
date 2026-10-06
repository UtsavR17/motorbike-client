import type { Metadata } from 'next';
import { CartView } from '@/components/cart/CartView';
import { PageIntro } from '@/components/ui/PageIntro';
import { getCurrentUser } from '@/lib/auth/session';
import { parseId, type SearchParams } from '@/lib/params';

export const metadata: Metadata = {
  title: 'Your cart',
  description: 'Review the parts in your cart before checkout.',
};

export default async function CartPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const user = await getCurrentUser();
  const issue = sp.issue === 'stock' ? { stockId: parseId(sp.item) ?? null } : null;

  return (
    <>
      <PageIntro title="Your cart" crumbs={[{ href: '/', label: 'Home' }, { label: 'Cart' }]} />
      <div className="container-page py-6 lg:py-8">
        <CartView signedIn={Boolean(user)} issue={issue} />
      </div>
    </>
  );
}
