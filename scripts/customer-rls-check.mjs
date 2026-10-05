// Customer RLS check: signs in as a TEST customer with the public key and prints PASS/FAIL
// for each database rule the Client Side relies on. Cleans up the test bike it creates.
//
// Usage (credentials come from the environment, never from this file):
//   TEST_EMAIL=... TEST_PASSWORD=... npm run check:rls
// Optional: OTHER_CUSTOMER_ID (default 1) for the "other customer" checks.
// The test user must be a confirmed customer with a completed profile.

import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const email = process.env.TEST_EMAIL;
const password = process.env.TEST_PASSWORD;
const otherId = Number(process.env.OTHER_CUSTOMER_ID || 1);

if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.');
  process.exit(2);
}
if (!email || !password) {
  console.error('Set TEST_EMAIL and TEST_PASSWORD for a test customer to run this check. Nothing was run.');
  process.exit(2);
}

const CONTACT_TRIGGER = 'Customers may only change their contact details';
const BIKE_TRIGGER = 'Customers may only change the registration number and year of a bike';

const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const results = [];

function report(name, pass, detail = '') {
  results.push(pass);
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
}

/** Error summary without row data or secrets. */
function why(error) {
  return error ? `${error.code ?? ''} ${error.message ?? ''}`.trim() : 'no error';
}

function rand(chars, n) {
  let out = '';
  for (let i = 0; i < n; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

async function main() {
  const { data: signIn, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
  if (signInError || !signIn.session) {
    console.error(`Could not sign in as the test customer: ${signInError?.code ?? 'unknown'}`);
    process.exit(2);
  }
  console.log('Signed in as the test customer.\n');

  /* 1. Own Customer row only */
  const own = await supabase.from('Customer').select('CustomerID,NIC,PhoneNumber');
  const me = own.data?.[0];
  report('1a Can read own Customer row (exactly one row)', !own.error && own.data?.length === 1, why(own.error));
  if (!me) {
    console.error('\nNo own Customer row: complete the profile for this test user first.');
    process.exit(1);
  }
  const otherCustomerId = otherId === me.CustomerID ? me.CustomerID + 1 : otherId;
  const byId = await supabase.from('Customer').select('CustomerID').eq('CustomerID', otherCustomerId);
  report('1b Reading another CustomerID returns nothing', !byId.error ? byId.data.length === 0 : true, why(byId.error));
  const byNic = await supabase.from('Customer').select('CustomerID').neq('NIC', me.NIC);
  report('1c Reading other customers by NIC returns nothing', !byNic.error ? byNic.data.length === 0 : true, why(byNic.error));

  /* 2. Staff and supplier tables */
  for (const table of ['Stock', 'Sale', 'Payment', 'Supplier_Product', 'New_MotorBike']) {
    const r = await supabase.from(table).select().limit(1);
    report(`2  Cannot read ${table}`, Boolean(r.error) || (r.data ?? []).length === 0, why(r.error));
  }

  /* 3. Updating own Customer row */
  const phone = await supabase
    .from('Customer')
    .update({ PhoneNumber: me.PhoneNumber })
    .eq('CustomerID', me.CustomerID)
    .select('CustomerID');
  report('3a Updating own phone works', !phone.error && phone.data?.length === 1, why(phone.error));

  const forbidden = {
    NIC: `RLSCHK${rand('0123456789', 6)}`,
    Email: `rls-check-${rand('abcdefgh', 6)}@example.invalid`,
    AuthUserID: crypto.randomUUID(),
  };
  for (const [column, value] of Object.entries(forbidden)) {
    const r = await supabase
      .from('Customer')
      .update({ [column]: value })
      .eq('CustomerID', me.CustomerID)
      .select('CustomerID');
    const blocked = Boolean(r.error) && (r.error.message ?? '').includes(CONTACT_TRIGGER);
    report(`3b Updating ${column} fails with the trigger message`, blocked, why(r.error));
    if (!r.error && r.data?.length) {
      console.error(`   WARNING: ${column} was changed. Restore it in the Admin Panel or Supabase dashboard.`);
    }
  }

  /* 4. No direct Customer inserts */
  const insertCustomer = await supabase.from('Customer').insert({
    FirstName: 'Rls',
    LastName: 'Check',
    PhoneNumber: `5${rand('0123456789', 7)}`,
    Email: `rls-insert-${rand('abcdefgh', 6)}@example.invalid`,
    Street: 'Test street',
    Town: 'Test town',
    NIC: `RLSINS${rand('0123456789', 6)}`,
  });
  report('4  Inserting a Customer row directly fails', Boolean(insertCustomer.error), why(insertCustomer.error));

  /* 5-7. Customer_bike */
  const { data: models, error: modelError } = await supabase.from('catalog_models').select('model_id').limit(1);
  if (modelError || !models?.length) {
    report('5  Bike checks need a model in catalog_models', false, why(modelError));
  } else {
    const modelId = models[0].model_id;
    const upper = 'ABCDEFGHJKLMNPRSTUVWXYZ0123456789';
    const bike = {
      RegistrationNumber: rand(upper, 6),
      Year: 2020,
      VIN: `RLSCHK${rand(upper, 14)}`,
      Model_Model_No: modelId,
      Customer_CustomerID: me.CustomerID,
    };
    const added = await supabase.from('Customer_bike').insert(bike).select('BikeID');
    const bikeId = added.data?.[0]?.BikeID;
    report('5a Inserting a bike for the own customer works', !added.error && Boolean(bikeId), why(added.error));

    const foreign = await supabase
      .from('Customer_bike')
      .insert({ ...bike, RegistrationNumber: rand(upper, 6), VIN: `RLSCHK${rand(upper, 14)}`, Customer_CustomerID: otherCustomerId })
      .select('BikeID');
    report(`5b Inserting a bike for customer ${otherCustomerId} fails`, Boolean(foreign.error), why(foreign.error));
    if (!foreign.error) console.error('   WARNING: a bike was created for another customer. Delete it in the Admin Panel.');

    if (bikeId) {
      const edit = await supabase
        .from('Customer_bike')
        .update({ RegistrationNumber: rand(upper, 6), Year: 2021 })
        .eq('BikeID', bikeId)
        .select('BikeID');
      report('6a Updating RegistrationNumber and Year works', !edit.error && edit.data?.length === 1, why(edit.error));

      const vin = await supabase.from('Customer_bike').update({ VIN: `RLSCHK${rand(upper, 14)}` }).eq('BikeID', bikeId);
      report('6b Updating VIN fails with the trigger message', (vin.error?.message ?? '').includes(BIKE_TRIGGER), why(vin.error));

      const otherModel = await supabase.from('catalog_models').select('model_id').neq('model_id', modelId).limit(1);
      const newModel = otherModel.data?.[0]?.model_id ?? modelId;
      const model = await supabase.from('Customer_bike').update({ Model_Model_No: newModel }).eq('BikeID', bikeId);
      const modelBlocked =
        newModel === modelId ? null : (model.error?.message ?? '').includes(BIKE_TRIGGER);
      report(
        '6c Updating Model_Model_No fails with the trigger message',
        modelBlocked === null ? false : modelBlocked,
        modelBlocked === null ? 'needs a second model in catalog_models' : why(model.error),
      );

      const removed = await supabase.from('Customer_bike').delete().eq('BikeID', bikeId).select('BikeID');
      report('7  Deleting the test bike works (cleanup)', !removed.error && removed.data?.length === 1, why(removed.error));
    }
  }

  /* 8. register_customer is one-shot */
  const again = await supabase.rpc('register_customer', {
    p_first_name: 'Rls',
    p_last_name: 'Check',
    p_phone: '5000000',
    p_street: 'Test street',
    p_town: 'Test town',
    p_nic: 'RLSCHECK000',
  });
  report('8  register_customer again returns ALREADY_HAS_PROFILE', (again.error?.message ?? '').includes('ALREADY_HAS_PROFILE'), why(again.error));

  await supabase.auth.signOut();
  const failed = results.filter((r) => !r).length;
  console.log(`\n${results.length - failed} passed, ${failed} failed.`);
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error(`Unexpected error: ${err?.message ?? err}`);
  process.exit(1);
});
