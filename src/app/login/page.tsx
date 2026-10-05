import type { Metadata } from 'next';
import { UserRound } from 'lucide-react';
import { ComingSoon } from '@/components/ui/ComingSoon';

export const metadata: Metadata = {
  title: 'Sign in',
  description: 'Customer accounts are coming soon.',
};

export default function LoginPage() {
  return (
    <ComingSoon icon={UserRound} title="Customer accounts are coming soon">
      <p>
        Soon you will be able to sign in to save your bikes, track orders and book workshop appointments.
        Until then you can browse everything as a guest.
      </p>
    </ComingSoon>
  );
}
