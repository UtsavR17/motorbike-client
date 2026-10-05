import type { Metadata } from 'next';
import { ShoppingCart } from 'lucide-react';
import { ComingSoon } from '@/components/ui/ComingSoon';

export const metadata: Metadata = {
  title: 'Cart',
  description: 'Online ordering is coming soon.',
};

export default function CartPage() {
  return (
    <ComingSoon icon={ShoppingCart} title="Your cart is coming soon">
      <p>
        Online ordering with home delivery or store pickup arrives in the next update. For now, browse parts
        and motorcycles to check prices and stock.
      </p>
    </ComingSoon>
  );
}
