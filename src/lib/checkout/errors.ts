// Maps create_online_order (and related RPC) errors to what the customer should see.

interface ErrorLike {
  code?: string | null;
  message?: string | null;
  details?: string | null;
}

export type CreateOrderOutcome =
  | { kind: 'insufficient_stock'; stockId: number | null }
  | { kind: 'no_profile' }
  | { kind: 'error'; message: string };

const TOKENS = [
  'NO_PROFILE',
  'INVALID_FULFILMENT',
  'MISSING_DELIVERY_DETAILS',
  'INVALID_ITEMS',
  'INVALID_QUANTITY',
  'ITEM_NOT_FOUND',
  'INSUFFICIENT_STOCK',
] as const;

export function orderErrorToken(message: string | null | undefined): (typeof TOKENS)[number] | null {
  const m = message ?? '';
  for (const t of TOKENS) if (new RegExp(`(^|[^A-Z_])${t}($|[^A-Z_])`).test(m)) return t;
  return null;
}

/** First positive integer in the error details (the offending stock id). */
function stockIdFrom(details: string | null | undefined): number | null {
  const m = /\d{1,9}/.exec(details ?? '');
  return m ? Number(m[0]) : null;
}

export function mapCreateOrderError(e: ErrorLike): CreateOrderOutcome {
  switch (orderErrorToken(e.message)) {
    case 'INSUFFICIENT_STOCK':
      return { kind: 'insufficient_stock', stockId: stockIdFrom(e.details) };
    case 'NO_PROFILE':
      return { kind: 'no_profile' };
    case 'MISSING_DELIVERY_DETAILS':
      return { kind: 'error', message: 'Enter a delivery street, town and phone number, or choose store pickup.' };
    case 'INVALID_FULFILMENT':
      return { kind: 'error', message: 'Choose home delivery or store pickup.' };
    case 'INVALID_ITEMS':
      return { kind: 'error', message: 'Your cart could not be read. Please review it and try again.' };
    case 'INVALID_QUANTITY':
      return { kind: 'error', message: 'One of the quantities is not allowed. Please review your cart.' };
    case 'ITEM_NOT_FOUND':
      return { kind: 'error', message: 'An item in your cart is no longer sold. Please remove it and try again.' };
    default:
      break;
  }
  if (e.code === '23505') {
    return { kind: 'error', message: 'The same item appears twice in your cart. Please review it and try again.' };
  }
  if (e.code === '22001') return { kind: 'error', message: 'One of the delivery details is too long.' };
  return { kind: 'error', message: 'We could not start your order right now. Please try again.' };
}

/** Status labels customers see (database value -> label). */
export const ORDER_STATUS_LABELS: Record<string, string> = {
  'Pending Payment': 'Awaiting payment',
  Paid: 'Paid',
  Processing: 'Processing',
  'Ready for Pickup': 'Ready for pickup',
  'Out for Delivery': 'Out for delivery',
  Completed: 'Completed',
  Cancelled: 'Cancelled',
};
