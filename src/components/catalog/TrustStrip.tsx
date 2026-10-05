import { ShieldCheck, Store, Truck } from 'lucide-react';
import { DELIVERY_ESTIMATE, PICKUP_ESTIMATE } from '@/config/shop';

const ITEMS = [
  { Icon: ShieldCheck, title: 'Warranty on parts', text: 'Every part lists its warranty period up front.' },
  { Icon: Truck, title: 'Home delivery', text: `Parts delivered in ${DELIVERY_ESTIMATE}.` },
  { Icon: Store, title: 'Store pickup', text: `${PICKUP_ESTIMATE}.` },
];

export function TrustStrip() {
  return (
    <section aria-label="Why shop with us" className="border-y border-line bg-card">
      <ul className="container-page grid gap-4 py-5 sm:grid-cols-3">
        {ITEMS.map(({ Icon, title, text }) => (
          <li key={title} className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-strong">
              <Icon aria-hidden="true" className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-semibold">{title}</p>
              <p className="text-sm text-ink-muted">{text}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
