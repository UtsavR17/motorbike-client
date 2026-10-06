import type { Metadata } from 'next';
import { CheckoutForm } from '@/components/checkout/CheckoutForm';
import { PageIntro } from '@/components/ui/PageIntro';
import { requireCustomer } from '@/lib/auth/session';

export const metadata: Metadata = {
  title: 'Checkout',
  robots: { index: false, follow: false },
};

export default async function CheckoutPage() {
  const { customer } = await requireCustomer('/checkout');
  return (
    <>
      <PageIntro
        title="Checkout"
        crumbs={[{ href: '/', label: 'Home' }, { href: '/cart', label: 'Cart' }, { label: 'Checkout' }]}
      />
      <div className="container-page py-6 lg:py-8">
        <CheckoutForm
          defaults={{
            street: [customer.homeNumber, customer.street].filter(Boolean).join(' ').slice(0, 50),
            town: customer.town,
            postCode: customer.postCode ?? '',
            phone: customer.phone,
          }}
        />
      </div>
    </>
  );
}
