// Appointments RLS check: signs in as a TEST customer with the public key only and prints
// PASS/FAIL for each rule online booking relies on. It books one appointment on the next
// bookable slot for the customer's first garage bike and cancels it again (one Cancelled
// appointment is left behind, which is expected).
//
//   TEST_EMAIL=... TEST_PASSWORD=... npm run check:appointments
// Optional: OTHER_BIKE_ID=<another customer's Customer_bike id> to test that bike as well.
// The test user must be a confirmed customer with a completed profile and a garage bike.

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
const createdIds = new Set();

function report(name, pass, detail = '') {
  results.push(pass === null ? true : pass);
  const tag = pass === null ? 'SKIP' : pass ? 'PASS' : 'FAIL';
  console.log(`${tag}  ${name}${detail ? `  (${detail})` : ''}`);
}

const why = (error) => (error ? `${error.code ?? ''} ${error.message ?? ''}`.trim() : 'no error');
const denied = (r) => Boolean(r.error) || (r.data ?? []).length === 0;
const rejectedWith = (r, tokens) => Boolean(r.error) && tokens.some((t) => `${r.error.message}`.includes(t));

// Mauritius is UTC+4 all year.
const MU_MS = 4 * 3600 * 1000;
const muToday = () => new Date(Date.now() + MU_MS).toISOString().slice(0, 10);
const addDays = (d, n) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
const weekday = (d) => new Date(`${d}T00:00:00Z`).getUTCDay();
const startMs = (d, t) => Date.parse(`${d}T${t.slice(0, 5)}:00Z`) - MU_MS;
const SLOT_TIMES = ['08:30', '09:30', '10:30', '11:30', '12:30', '13:30', '14:30', '15:30'];

async function book(bikeId, date, time, type, serviceIds) {
  const r = await supabase.rpc('create_my_appointment', {
    p_bike_id: bikeId,
    p_date: date,
    p_time: time,
    p_type: type,
    p_service_ids: serviceIds,
  });
  if (!r.error && r.data) createdIds.add(Number(r.data));
  return r;
}

async function main() {
  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
  if (signInError) {
    console.error(`Could not sign in as the test customer: ${signInError.code ?? 'unknown'}`);
    process.exit(2);
  }
  console.log('Signed in as the test customer.\n');

  /* 1. Base tables are not readable */
  for (const table of ['Appointment', 'appointment_service', 'Appointment_Stock']) {
    const r = await supabase.from(table).select().limit(1);
    report(`1  Reading ${table} directly returns nothing`, denied(r), r.error ? why(r.error) : `${r.data.length} rows`);
  }

  /* 2. Customer views respond */
  const views = {
    my_appointments:
      'appointment_id,appointment_date,appointment_time,appointment_type,status,bike_id,registration_number,bike_label,technician_assigned,total_amount,amount_paid',
    my_appointment_services: 'appointment_id,name,quantity,unit_cost',
    my_appointment_parts: 'appointment_id,description,quantity,unit_price',
  };
  for (const [view, cols] of Object.entries(views)) {
    const r = await supabase.from(view).select(cols).limit(5);
    report(`2  ${view} responds`, !r.error, why(r.error));
  }

  /* 3. Slots */
  const today = muToday();
  const slots = await supabase.rpc('get_appointment_slots', { p_from: today, p_to: addDays(today, 13) });
  report('3a get_appointment_slots responds', !slots.error, why(slots.error));
  const rows = slots.data ?? [];
  const days = [...new Set(rows.map((r) => r.slot_date))];
  report('3b Only Monday to Saturday rows', rows.length > 0 && rows.every((r) => weekday(r.slot_date) !== 0), `${days.length} days`);
  const perDayOk = days.every((d) => {
    const times = rows.filter((r) => r.slot_date === d).map((r) => r.slot_time.slice(0, 5)).sort();
    return JSON.stringify(times) === JSON.stringify(SLOT_TIMES);
  });
  report('3c 8 slots per day, 08:30 to 15:30', perDayOk);
  const tooSoon = rows.filter((r) => startMs(r.slot_date, r.slot_time) - Date.now() < 2 * 3600 * 1000);
  report(
    '3d Past or too-soon slots are not bookable',
    tooSoon.every((r) => r.bookable === false),
    `${tooSoon.length} past or too-soon slots in range`,
  );
  const far = await supabase.rpc('get_appointment_slots', { p_from: addDays(today, 31), p_to: addDays(today, 33) });
  report('3e Slots more than 30 days away are not bookable', !far.error && (far.data ?? []).every((r) => !r.bookable), why(far.error));
  const wide = await supabase.rpc('get_appointment_slots', { p_from: today, p_to: addDays(today, 40) });
  report('3f A range over 32 days is rejected (INVALID_RANGE)', rejectedWith(wide, ['INVALID_RANGE']), why(wide.error));

  /* 4. create_my_appointment rejects bad input */
  const bikes = await supabase.from('Customer_bike').select('BikeID').order('BikeID').limit(1);
  const bikeId = bikes.data?.[0]?.BikeID;
  if (!bikeId) {
    report('4  Booking checks', null, 'the test customer has no garage bike: add one in My garage and run again');
    return;
  }
  const services = await supabase.from('catalog_services').select('service_id,name').order('service_id').limit(5);
  const serviceIds = (services.data ?? []).map((s) => s.service_id);
  if (serviceIds.length === 0) {
    report('4  Booking checks', null, 'catalog_services is empty');
    return;
  }
  const next = rows.find((r) => r.bookable);
  if (!next) {
    report('4  Booking checks', null, 'no bookable slot in the next 14 days');
    return;
  }
  const date = next.slot_date;
  const time = next.slot_time.slice(0, 5);
  const one = [serviceIds[0]];
  const SLOT = ['SLOT_INVALID', 'SLOT_OUT_OF_RANGE'];

  let r = await book(2147483000, date, time, 'Service', one);
  report('4a Unknown bike rejected (BIKE_NOT_FOUND)', rejectedWith(r, ['BIKE_NOT_FOUND']), why(r.error));
  if (process.env.OTHER_BIKE_ID) {
    r = await book(Number(process.env.OTHER_BIKE_ID), date, time, 'Service', one);
    report("4a Another customer's bike rejected (BIKE_NOT_FOUND)", rejectedWith(r, ['BIKE_NOT_FOUND']), why(r.error));
  } else {
    report("4a Another customer's bike rejected", null, 'set OTHER_BIKE_ID to test it');
  }
  r = await book(bikeId, date, time, 'Wash', one);
  report('4b Invalid type rejected (INVALID_TYPE)', rejectedWith(r, ['INVALID_TYPE']), why(r.error));
  r = await book(bikeId, date, time, 'Service', []);
  report('4c Zero services rejected (INVALID_SERVICES)', rejectedWith(r, ['INVALID_SERVICES']), why(r.error));
  const six = [...serviceIds, 2147483001, 2147483002, 2147483003, 2147483004, 2147483005, 2147483006].slice(0, 6);
  r = await book(bikeId, date, time, 'Service', six);
  report('4d Six services rejected (INVALID_SERVICES)', rejectedWith(r, ['INVALID_SERVICES']), why(r.error));
  r = await book(bikeId, date, time, 'Service', [2147483000]);
  report('4e Unknown service rejected (INVALID_SERVICES)', rejectedWith(r, ['INVALID_SERVICES']), why(r.error));
  let sunday = addDays(today, 1);
  while (weekday(sunday) !== 0) sunday = addDays(sunday, 1);
  r = await book(bikeId, sunday, '09:30', 'Service', one);
  report('4f Sunday rejected', rejectedWith(r, SLOT), why(r.error));
  r = await book(bikeId, date, '09:00', 'Service', one);
  report('4g A time that is not a slot time rejected', rejectedWith(r, SLOT), why(r.error));
  let past = addDays(today, -1);
  if (weekday(past) === 0) past = addDays(past, -1);
  r = await book(bikeId, past, '09:30', 'Service', one);
  report('4h A past slot rejected', rejectedWith(r, SLOT), why(r.error));
  let farDay = addDays(today, 35);
  if (weekday(farDay) === 0) farDay = addDays(farDay, 1);
  r = await book(bikeId, farDay, '09:30', 'Service', one);
  report('4i A slot more than 30 days away rejected', rejectedWith(r, SLOT), why(r.error));

  /* 5. Valid booking */
  const chosen = serviceIds.slice(0, 2);
  const created = await book(bikeId, date, time, 'Service', chosen);
  const id = created.error ? null : Number(created.data);
  report('5a Valid booking on the next bookable slot succeeds', Boolean(id), created.error ? why(created.error) : `${date} ${time}, id ${id}`);
  if (id) {
    const mine = await supabase
      .from('my_appointments')
      .select('appointment_id,status,technician_assigned,appointment_date,appointment_time')
      .eq('appointment_id', id)
      .maybeSingle();
    report(
      '5b Appears in my_appointments as Pending, no technician',
      mine.data?.status === 'Pending' && mine.data?.technician_assigned === false,
      mine.error ? why(mine.error) : `${mine.data?.status}, technician_assigned ${mine.data?.technician_assigned}`,
    );
    const lines = await supabase.from('my_appointment_services').select('name,quantity').eq('appointment_id', id);
    const wanted = (services.data ?? []).filter((s) => chosen.includes(s.service_id)).map((s) => s.name).sort();
    const got = (lines.data ?? []).map((l) => l.name).sort();
    report(
      '5c The chosen services are listed (quantity 1)',
      JSON.stringify(got) === JSON.stringify(wanted) && (lines.data ?? []).every((l) => l.quantity === 1),
      lines.error ? why(lines.error) : got.join(', '),
    );

    /* 6. One active booking per bike per day */
    const other = rows.find((x) => x.slot_date === date && x.bookable && x.slot_time.slice(0, 5) !== time);
    const again = await book(bikeId, date, other ? other.slot_time.slice(0, 5) : time, 'Service', one);
    report('6  Second booking for the same bike and day rejected (ALREADY_BOOKED)', rejectedWith(again, ['ALREADY_BOOKED']), why(again.error));

    /* 7. Cancel */
    const c1 = await supabase.rpc('cancel_my_appointment', { p_appointment_id: id });
    report('7a cancel_my_appointment returns true', c1.data === true, why(c1.error));
    const c2 = await supabase.rpc('cancel_my_appointment', { p_appointment_id: id });
    report('7b A second cancel returns false', c2.data === false, why(c2.error));

    /* 8. Direct writes are refused */
    const ins = await supabase.from('Appointment').insert({ Appointment_Date: date, Status: 'Pending' }).select('AppointmentID');
    report('8a Direct INSERT on Appointment fails', denied(ins), why(ins.error));
    const upd = await supabase.from('Appointment').update({ Status: 'Confirmed' }).eq('AppointmentID', id).select('AppointmentID');
    report('8b Direct UPDATE on Appointment fails', denied(upd), why(upd.error));
    const del = await supabase.from('Appointment').delete().eq('AppointmentID', id).select('AppointmentID');
    report('8c Direct DELETE on Appointment fails', denied(del), why(del.error));
    const after = await supabase.from('my_appointments').select('status').eq('appointment_id', id).maybeSingle();
    report('8d The test appointment is still there and Cancelled', after.data?.status === 'Cancelled', why(after.error));
  }
}

main()
  .catch((err) => {
    console.error(`Unexpected error: ${err?.message ?? err}`);
    results.push(false);
  })
  .finally(async () => {
    // Anything a check created by mistake is cancelled, so only Cancelled appointments remain.
    for (const id of createdIds) await supabase.rpc('cancel_my_appointment', { p_appointment_id: id });
    await supabase.auth.signOut();
    const failed = results.filter((r) => !r).length;
    console.log(`\n${results.length - failed} passed or skipped, ${failed} failed.`);
    process.exit(failed ? 1 : 0);
  });
