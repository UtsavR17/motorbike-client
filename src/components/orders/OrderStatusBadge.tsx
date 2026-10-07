import { CheckCircle2, Clock, Cog, PackageCheck, Store, Truck, XCircle } from 'lucide-react';
import { ORDER_STATUS_LABELS } from '@/lib/checkout/errors';

const STYLES: Record<string, { className: string; Icon: typeof Clock }> = {
  'Pending Payment': { className: 'bg-warn-soft text-warn', Icon: Clock },
  Paid: { className: 'bg-ok-soft text-ok', Icon: CheckCircle2 },
  Processing: { className: 'bg-accent-soft text-ink', Icon: Cog },
  'Ready for Pickup': { className: 'bg-ok-soft text-ok', Icon: Store },
  'Out for Delivery': { className: 'bg-accent-soft text-ink', Icon: Truck },
  Completed: { className: 'bg-ink text-white', Icon: PackageCheck },
  Cancelled: { className: 'bg-bad-soft text-bad', Icon: XCircle },
};

/** The single order status badge used across checkout and account pages. */
export function OrderStatusBadge({ status }: { status: string }) {
  const style = STYLES[status] ?? { className: 'bg-page text-ink', Icon: Clock };
  const { Icon } = style;
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${style.className}`}
    >
      <Icon aria-hidden="true" className="h-3.5 w-3.5" />
      {ORDER_STATUS_LABELS[status] ?? status}
    </span>
  );
}
