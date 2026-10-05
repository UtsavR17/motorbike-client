import { CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import type { StockStatus } from '@/types/catalog';

const STYLES: Record<StockStatus, { label: string; className: string; Icon: typeof CheckCircle2 }> = {
  in_stock: { label: 'In stock', className: 'bg-ok-soft text-ok', Icon: CheckCircle2 },
  low_stock: { label: 'Low stock', className: 'bg-warn-soft text-warn', Icon: AlertTriangle },
  out_of_stock: { label: 'Out of stock', className: 'bg-bad-soft text-bad', Icon: XCircle },
};

export function StockBadge({ status }: { status: StockStatus }) {
  const { label, className, Icon } = STYLES[status];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${className}`}
    >
      <Icon aria-hidden="true" className="h-3.5 w-3.5" />
      {label}
    </span>
  );
}
