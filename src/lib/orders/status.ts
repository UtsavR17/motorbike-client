// Order types and the status labels customers see. The single place these labels are defined:
// the badge, pages and tests all use orderStatusLabel().

export type OrderType = 'Parts' | 'Reservation';

/** Online_Order.OrderType from the database; anything unexpected is treated as a parts order. */
export function orderTypeOf(value: unknown): OrderType {
  return value === 'Reservation' ? 'Reservation' : 'Parts';
}

export function orderTypeLabel(orderType: OrderType): string {
  return orderType === 'Reservation' ? 'Bike reservation' : 'Parts order';
}

const PARTS_LABELS: Record<string, string> = {
  'Pending Payment': 'Awaiting payment',
  Paid: 'Paid',
  Processing: 'Processing',
  'Ready for Pickup': 'Ready for pickup',
  'Out for Delivery': 'Out for delivery',
  Completed: 'Completed',
  Cancelled: 'Cancelled',
};

const RESERVATION_LABELS: Record<string, string> = {
  'Pending Payment': 'Awaiting deposit',
  Paid: 'Reserved',
  Completed: 'Collected',
  Cancelled: 'Cancelled',
};

/** Customer-facing label for a status (database value) of an order of the given type. */
export function orderStatusLabel(orderType: OrderType, status: string): string {
  if (orderType === 'Reservation' && RESERVATION_LABELS[status]) return RESERVATION_LABELS[status];
  return PARTS_LABELS[status] ?? status;
}
