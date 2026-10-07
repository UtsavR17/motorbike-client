import 'server-only';

import { toNumber } from '@/lib/format';
import { orderTypeOf, type OrderType } from '@/lib/orders/status';
import { createClient } from '@/lib/supabase/server';

// Customers read orders only through the my_orders / my_order_items views (RLS-scoped to the
// signed-in customer). Explicit column lists; no audit columns exist in these views, and the
// reservation columns describe the motorcycle without its VIN.

export type OrderStatus =
  | 'Pending Payment'
  | 'Paid'
  | 'Processing'
  | 'Ready for Pickup'
  | 'Out for Delivery'
  | 'Completed'
  | 'Cancelled';

export interface MyOrder {
  id: number;
  date: string;
  status: OrderStatus;
  fulfilment: 'Delivery' | 'Pickup';
  street: string | null;
  town: string | null;
  postCode: string | null;
  phone: string | null;
  estimatedDate: string | null;
  /** For a reservation: the deposit. */
  total: number;
  paidAt: string | null;
  orderType: OrderType;
  /** Reservations only: visit-by date set when the deposit is paid. */
  reservedUntil: string | null;
  bikeDescription: string | null;
  bikePrice: number | null;
}

export interface MyOrderItem {
  stockId: number;
  description: string;
  quantity: number;
  unitPrice: number;
}

const ORDER_COLUMNS =
  'order_id,order_date,status,fulfilment,delivery_street,delivery_town,delivery_post_code,delivery_phone,estimated_date,total,paid_at,order_type,reserved_until,bike_description,bike_price';

interface OrderRow {
  order_id: number;
  order_date: string;
  status: OrderStatus;
  fulfilment: 'Delivery' | 'Pickup';
  delivery_street: string | null;
  delivery_town: string | null;
  delivery_post_code: string | null;
  delivery_phone: string | null;
  estimated_date: string | null;
  total: number | string;
  paid_at: string | null;
  order_type: string | null;
  reserved_until: string | null;
  bike_description: string | null;
  bike_price: number | string | null;
}

function toOrder(r: OrderRow): MyOrder {
  return {
    id: r.order_id,
    date: r.order_date,
    status: r.status,
    fulfilment: r.fulfilment,
    street: r.delivery_street,
    town: r.delivery_town,
    postCode: r.delivery_post_code,
    phone: r.delivery_phone,
    estimatedDate: r.estimated_date,
    total: toNumber(r.total) ?? 0,
    paidAt: r.paid_at,
    orderType: orderTypeOf(r.order_type),
    reservedUntil: r.reserved_until,
    bikeDescription: r.bike_description,
    bikePrice: toNumber(r.bike_price),
  };
}

function fail(what: string, code: string | undefined): never {
  console.error(`[orders] ${what} failed: ${code ?? 'unknown'}`);
  throw new Error('Could not load your orders.');
}

export async function listMyOrders(limit?: number): Promise<MyOrder[]> {
  const supabase = await createClient();
  let req = supabase
    .from('my_orders')
    .select(ORDER_COLUMNS)
    .order('order_date', { ascending: false })
    .order('order_id', { ascending: false });
  if (limit) req = req.limit(limit);
  const { data, error } = await req;
  if (error) fail('list', error.code);
  return ((data ?? []) as OrderRow[]).map(toOrder);
}

/** The customer's own order, or null (also null for another customer's id). */
export async function getMyOrder(orderId: number): Promise<MyOrder | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from('my_orders').select(ORDER_COLUMNS).eq('order_id', orderId).maybeSingle();
  if (error) fail('read', error.code);
  return data ? toOrder(data as OrderRow) : null;
}

export async function getMyOrderItems(orderId: number): Promise<MyOrderItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('my_order_items')
    .select('order_id,stock_id,description,quantity,unit_price')
    .eq('order_id', orderId)
    .order('stock_id', { ascending: true });
  if (error) fail('items', error.code);
  return (
    (data ?? []) as { stock_id: number; description: string; quantity: number; unit_price: number | string }[]
  ).map((r) => ({
    stockId: r.stock_id,
    description: r.description,
    quantity: r.quantity,
    unitPrice: toNumber(r.unit_price) ?? 0,
  }));
}

/** Cancels the customer's own Pending Payment order. True when it was cancelled. */
export async function cancelMyPendingOrder(orderId: number): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('cancel_my_pending_order', { p_order_id: orderId });
  if (error) {
    console.error(`[orders] cancel failed: ${error.code ?? 'unknown'}`);
    return false;
  }
  return data === true;
}
