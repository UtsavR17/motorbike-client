// Online orders RLS check: signs in as a TEST customer with the public key only and prints
// PASS/FAIL for each rule the checkout relies on. It creates one Pickup order for a single
// in-stock item and cancels it again (a Cancelled order is left behind, which is expected).
//
//   TEST_EMAIL=... TEST_PASSWORD=... npm run check:orders
// The test user must be a confirmed customer with a completed profile. No secret keys are used.

import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const email = process.env.TEST_EMAIL;
const password = process.env.TEST_PASSWORD;

if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.');
  process.exit(2);
}
if (!email || !password) {
  console.error('Set TEST_EMAIL and TEST_PASSWORD for a test customer to run this check. Nothing was run.');
  process.exit(2);
}

const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const results = [];

function report(name, pass, detail = '') {
  results.push(pass === null ? true : pass);
  const tag = pass === null ? 'SKIP' : pass ? 'PASS' : 'FAIL';
  console.log(`${tag}  ${name}${detail ? `  (${detail})` : ''}`);
}

const why = (error) => (error ? `${error.code ?? ''} ${error.message ?? ''}`.trim() : 'no error');
const denied = (r) => Boolean(r.error) || (r.data ?? []).length === 0;
const rejectedWith = (r, token) => Boolean(r.error) && (token ? `${r.error.message}`.includes(token) : true);

async function createOrder(items, fulfilment = 'Pickup', address = {}) {
  return supabase.rpc('create_online_order', {
    p_items: items,
    p_fulfilment: fulfilment,
    p_street: address.street ?? null,
    p_town: address.town ?? null,
    p_post_code: address.postCode ?? null,
    p_phone: address.phone ?? null,
  });
}

async function main() {
  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
  if (signInError) {
    console.error(`Could not sign in as the test customer: ${signInError.code ?? 'unknown'}`);
    process.exit(2);
  }
  console.log('Signed in as the test customer.\n');

  /* 1. Base tables are not readable */
  for (const table of ['Online_Order', 'Online_Order_Item', 'Payment']) {
    const r = await supabase.from(table).select().limit(1);
    report(`1  Cannot read ${table} directly`, denied(r), why(r.error));
  }

  /* 2. Customer views respond */
  const orders = await supabase
    .from('my_orders')
    .select('order_id,order_date,status,fulfilment,total,estimated_date,paid_at')
    .limit(5);
  report('2a my_orders responds', !orders.error, why(orders.error));
  const items = await supabase.from('my_order_items').select('order_id,stock_id,description,quantity,unit_price').limit(5);
  report('2b my_order_items responds', !items.error, why(items.error));

  /* 3. Webhook-only functions are denied */
  const fin = await supabase.rpc('finalize_online_order', { p_order_id: 1, p_session_id: 'cs_test_x', p_payment_intent: 'pi_x' });
  report('3a finalize_online_order is denied', Boolean(fin.error), why(fin.error));
  const exp = await supabase.rpc('expire_online_order', { p_order_id: 1, p_session_id: 'cs_test_x' });
  report('3b expire_online_order is denied', Boolean(exp.error), why(exp.error));

  /* 4. create_online_order rejects bad input */
  const { data: variants, error: vErr } = await supabase
    .from('catalog_part_variants')
    .select('stock_id,price,qty_available,stock_status')
    .neq('stock_status', 'out_of_stock')
    .order('qty_available', { ascending: true })
    .limit(50);
  if (vErr || !variants?.length) {
    report('4  Needs an in-stock variant in catalog_part_variants', false, why(vErr));
  } else {
    const any = variants[variants.length - 1];
    let r = await createOrder([]);
    report('4a Empty items rejected', rejectedWith(r), why(r.error));
    r = await createOrder([{ stock_id: any.stock_id, qty: 0 }]);
    report('4b Quantity 0 rejected', rejectedWith(r), why(r.error));
    r = await createOrder([{ stock_id: any.stock_id, qty: 11 }]);
    report('4c Quantity 11 rejected', rejectedWith(r), why(r.error));
    r = await createOrder([{ stock_id: 2147483000, qty: 1 }]);
    report('4d Unknown stock id rejected', rejectedWith(r, 'ITEM_NOT_FOUND'), why(r.error));
    const low = variants.find((v) => v.qty_available < 10);
    if (low) {
      r = await createOrder([{ stock_id: low.stock_id, qty: low.qty_available + 1 }]);
      report('4e Quantity above available stock rejected', rejectedWith(r, 'INSUFFICIENT_STOCK'), why(r.error));
      if (!r.error) await supabase.rpc('cancel_my_pending_order', { p_order_id: r.data?.order_id });
    } else {
      report('4e Quantity above available stock rejected', null, 'every variant shows 10+ in stock; nothing to exceed within 10');
    }
    r = await createOrder([{ stock_id: any.stock_id, qty: 1 }], 'Delivery', {});
    report('4f Delivery without an address rejected', rejectedWith(r, 'MISSING_DELIVERY_DETAILS'), why(r.error));
    if (!r.error) await supabase.rpc('cancel_my_pending_order', { p_order_id: r.data?.order_id });

    /* 5. Valid Pickup order, then cancel */
    const created = await createOrder([{ stock_id: any.stock_id, qty: 1 }]);
    const order = typeof created.data === 'string' ? JSON.parse(created.data) : created.data;
    report('5a Valid Pickup order created', !created.error && Boolean(order?.order_id), why(created.error));
    if (order?.order_id) {
      const mine = await supabase.from('my_orders').select('order_id,status,total').eq('order_id', order.order_id).maybeSingle();
      report('5b Order appears in my_orders as Pending Payment', mine.data?.status === 'Pending Payment', why(mine.error));
      const expected = Number(any.price) * 1;
      report('5c Total equals the database price x quantity', Math.abs(Number(mine.data?.total) - expected) < 0.005,
        `total ${mine.data?.total}, expected ${expected}`);

      /* 6. Direct updates are refused */
      const upd1 = await supabase.from('Online_Order').update({ Status: 'Paid' }).eq('OrderID', order.order_id).select('OrderID');
      report('6a Direct UPDATE of Status fails', denied(upd1), why(upd1.error));
      const upd2 = await supabase.from('Online_Order').update({ TotalAmount: 1 }).eq('OrderID', order.order_id).select('OrderID');
      report('6b Direct UPDATE of TotalAmount fails', denied(upd2), why(upd2.error));

      const cancel = await supabase.rpc('cancel_my_pending_order', { p_order_id: order.order_id });
      report('5d cancel_my_pending_order cancels it', cancel.data === true, why(cancel.error));
      const after = await supabase.from('my_orders').select('status').eq('order_id', order.order_id).maybeSingle();
      report('5e Order is now Cancelled', after.data?.status === 'Cancelled', why(after.error));
    }
  }

  await supabase.auth.signOut();
  const failed = results.filter((r) => !r).length;
  console.log(`\n${results.length - failed} passed or skipped, ${failed} failed.`);
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error(`Unexpected error: ${err?.message ?? err}`);
  process.exit(1);
});
