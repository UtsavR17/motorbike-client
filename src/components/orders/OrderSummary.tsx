import { Store, Truck } from 'lucide-react';
import type { MyOrder, MyOrderItem } from '@/lib/account/orders';
import { formatDate, formatMoney } from '@/lib/format';

/** Estimated date sentence for an order. */
export function estimateText(order: MyOrder): string | null {
  const date = formatDate(order.estimatedDate);
  if (!date) return null;
  return order.fulfilment === 'Pickup' ? `Ready for pickup from ${date}` : `Estimated delivery by ${date}`;
}

export function OrderItemsTable({ items, total }: { items: MyOrderItem[]; total: number }) {
  return (
    <div className="card overflow-hidden">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">Items in this order</caption>
        <thead className="bg-page text-ink-muted">
          <tr>
            <th scope="col" className="px-4 py-3 font-medium">Item</th>
            <th scope="col" className="px-4 py-3 text-right font-medium">Qty</th>
            <th scope="col" className="hidden px-4 py-3 text-right font-medium sm:table-cell">Unit price</th>
            <th scope="col" className="px-4 py-3 text-right font-medium">Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {items.map((i) => (
            <tr key={i.stockId}>
              <td className="px-4 py-3 font-medium">{i.description}</td>
              <td className="px-4 py-3 text-right">{i.quantity}</td>
              <td className="hidden px-4 py-3 text-right sm:table-cell">{formatMoney(i.unitPrice)}</td>
              <td className="px-4 py-3 text-right font-semibold">{formatMoney(i.unitPrice * i.quantity)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-line">
            <th scope="row" colSpan={3} className="hidden px-4 py-3 text-right font-semibold sm:table-cell">Total (free delivery)</th>
            <th scope="row" colSpan={2} className="px-4 py-3 text-right font-semibold sm:hidden">Total</th>
            <td className="px-4 py-3 text-right text-base font-bold">{formatMoney(total)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

export function FulfilmentDetails({ order }: { order: MyOrder }) {
  const estimate = estimateText(order);
  if (order.fulfilment === 'Pickup') {
    return (
      <div className="card flex gap-3 p-4 text-sm">
        <Store aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-accent-strong" />
        <div>
          <p className="font-semibold">Store pickup</p>
          <p className="text-ink-muted">Collect at the dealership with your Order ID.{estimate ? ` ${estimate}.` : ''}</p>
        </div>
      </div>
    );
  }
  return (
    <div className="card flex gap-3 p-4 text-sm">
      <Truck aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-accent-strong" />
      <div>
        <p className="font-semibold">Home delivery</p>
        <p className="text-ink-muted">
          {[order.street, order.town, order.postCode].filter(Boolean).join(', ')}
          {order.phone ? ` (phone ${order.phone})` : ''}
        </p>
        {estimate && <p className="mt-1 font-medium">{estimate}.</p>}
      </div>
    </div>
  );
}
