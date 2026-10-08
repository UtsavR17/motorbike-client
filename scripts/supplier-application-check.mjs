// Supplier application check: signs in as a TEST user with the public key only and prints
// PASS/FAIL for each rule the supplier application relies on. By default it creates NO
// application: test files it uploads are removed again. Set ALLOW_CREATE_APPLICATION=1 to also
// submit exactly one real application (it stays Pending until the dealership reviews it).
//
//   TEST_EMAIL=... TEST_PASSWORD=... npm run check:supplier-application
// The test user must have a verified email. No secret keys are used.

import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const email = process.env.TEST_EMAIL;
const password = process.env.TEST_PASSWORD;
const allowCreate = process.env.ALLOW_CREATE_APPLICATION === '1';

if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.');
  process.exit(2);
}
if (!email || !password) {
  console.error('Set TEST_EMAIL and TEST_PASSWORD for a test user to run this check. Nothing was run.');
  process.exit(2);
}

const BUCKET = 'supplier-applications';
const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const results = [];
const uploaded = new Set();

function report(name, pass, detail = '') {
  results.push(pass === null ? true : pass);
  const tag = pass === null ? 'SKIP' : pass ? 'PASS' : 'FAIL';
  console.log(`${tag}  ${name}${detail ? `  (${detail})` : ''}`);
}

const why = (error) =>
  error ? `${error.code ?? error.statusCode ?? ''} ${error.message ?? ''}`.trim() : 'no error';
const denied = (r) => Boolean(r.error) || (r.data ?? []).length === 0;
const rejectedWith = (r, token) => Boolean(r.error) && `${r.error.message}`.includes(token);

// A tiny but real PDF header, enough for the bucket's type rules.
const PDF_BYTES = new TextEncoder().encode('%PDF-1.4\n%check\n1 0 obj << >> endobj\ntrailer << >>\n%%EOF\n');

function fields(path) {
  return {
    p_company: 'Check Script Supplies Ltd',
    p_contact: 'Check Script',
    p_phone: '+230 5000 0000',
    p_address: '1 Test Street, Port Louis',
    p_country: 'Mauritius',
    p_brn: `CHK${Date.now()}`.slice(0, 30),
    p_products: 'Automated check: genuine spare parts and accessories.',
    p_document_path: path,
  };
}

async function upload(path, body, contentType) {
  const r = await supabase.storage.from(BUCKET).upload(path, body, { contentType, upsert: false });
  if (!r.error) uploaded.add(path);
  return r;
}

async function main() {
  const signIn = await supabase.auth.signInWithPassword({ email, password });
  if (signIn.error) {
    console.error(`Could not sign in as the test user: ${signIn.error.code ?? 'unknown'}`);
    process.exit(2);
  }
  const uid = signIn.data.user.id;
  console.log(`Signed in as the test user (email verified: ${Boolean(signIn.data.user.email_confirmed_at)}).\n`);

  /* 1. Base tables are not readable */
  for (const table of ['Supplier_Application', 'Supplier']) {
    const r = await supabase.from(table).select().limit(1);
    report(`1  Reading ${table} directly returns nothing`, denied(r), r.error ? why(r.error) : `${r.data.length} rows`);
  }

  /* 2. The view responds */
  const mine = await supabase
    .from('my_supplier_applications')
    .select('application_id,company_name,country,brn,status,rejection_reason,submitted_date,reviewed_date')
    .order('submitted_date', { ascending: false });
  report('2  my_supplier_applications responds', !mine.error, mine.error ? why(mine.error) : `${mine.data.length} applications`);
  const apps = mine.data ?? [];
  const latest = apps[0];
  const pending = latest?.status === 'Pending';
  const exhausted = apps.length >= 3;
  const approved = latest?.status === 'Approved';

  /* 3. submit_supplier_application rejects bad input */
  const empty = { ...fields(''), p_company: '', p_contact: '', p_phone: '', p_address: '', p_country: '', p_brn: '', p_products: '' };
  let r = await supabase.rpc('submit_supplier_application', empty);
  report('3a Missing fields rejected (MISSING_FIELDS)', rejectedWith(r, 'MISSING_FIELDS'), why(r.error));

  r = await supabase.rpc('submit_supplier_application', fields(`${randomUUID()}/someone-else.pdf`));
  if (pending || exhausted || approved) {
    report(
      "3b A document path outside the user's folder rejected",
      Boolean(r.error),
      `${why(r.error)}; the account state is checked first, so the path rule may not be reached`,
    );
  } else {
    report("3b A document path outside the user's folder rejected (INVALID_DOCUMENT)", rejectedWith(r, 'INVALID_DOCUMENT'), why(r.error));
  }

  /* 4. States (only when they apply: never creates an application) */
  if (pending) {
    const path = `${uid}/${randomUUID()}.pdf`;
    await upload(path, PDF_BYTES, 'application/pdf');
    r = await supabase.rpc('submit_supplier_application', fields(path));
    report('4a A second application while one is pending rejected (ALREADY_PENDING)', rejectedWith(r, 'ALREADY_PENDING'), why(r.error));
  } else {
    report('4a ALREADY_PENDING', null, 'the test user has no pending application');
  }
  if (exhausted && !pending) {
    const path = `${uid}/${randomUUID()}.pdf`;
    await upload(path, PDF_BYTES, 'application/pdf');
    r = await supabase.rpc('submit_supplier_application', fields(path));
    report('4b A fourth application rejected (TOO_MANY_APPLICATIONS)', rejectedWith(r, 'TOO_MANY_APPLICATIONS'), why(r.error));
  } else {
    report('4b TOO_MANY_APPLICATIONS', null, `the test user has ${apps.length} application(s)`);
  }

  /* 5. Storage rules */
  r = await upload(`${randomUUID()}/check.pdf`, PDF_BYTES, 'application/pdf');
  report("5a Upload into someone else's folder refused", Boolean(r.error), why(r.error));
  const ownPath = `${uid}/check-${randomUUID()}.pdf`;
  r = await upload(ownPath, PDF_BYTES, 'application/pdf');
  report("5b Upload into the user's own folder accepted", !r.error, why(r.error));
  if (!r.error) {
    const removed = await supabase.storage.from(BUCKET).remove([ownPath]);
    if (!removed.error) uploaded.delete(ownPath);
    report('5c The test file is removed again', !removed.error, why(removed.error));
  }
  r = await upload(`${uid}/check-${randomUUID()}.txt`, new TextEncoder().encode('plain text'), 'text/plain');
  report('5d A disallowed MIME type (text/plain) refused', Boolean(r.error), why(r.error));

  /* 6. Optional: one real application */
  if (!allowCreate) {
    report('6  Create a real application', null, 'set ALLOW_CREATE_APPLICATION=1 to submit one');
  } else if (pending || exhausted || approved) {
    report('6  Create a real application', null, 'not possible in the current state (pending, approved or 3 used)');
  } else {
    const path = `${uid}/${randomUUID()}.pdf`;
    const up = await upload(path, PDF_BYTES, 'application/pdf');
    r = up.error ? up : await supabase.rpc('submit_supplier_application', fields(path));
    if (!r.error) uploaded.delete(path); // it now belongs to the application
    report('6  One real application created', !r.error, r.error ? why(r.error) : `application id ${r.data}`);
    if (!r.error) console.log('      It stays Pending until the dealership reviews it in the Admin Panel.');
  }
}

main()
  .catch((err) => {
    console.error(`Unexpected error: ${err?.message ?? err}`);
    results.push(false);
  })
  .finally(async () => {
    // Files from rejected submissions or storage checks are removed, so nothing is left behind.
    if (uploaded.size) await supabase.storage.from(BUCKET).remove([...uploaded]);
    await supabase.auth.signOut();
    const failed = results.filter((x) => !x).length;
    console.log(`\n${results.length - failed} passed or skipped, ${failed} failed.`);
    process.exit(failed ? 1 : 0);
  });
