// Unit tests for the supplier application: form validation, BRN normalisation, document checks
// (size, extension, MIME, magic bytes), error mapping and the page state logic. Run: npm test

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { SUPPLIER_APPLICATION_MAX_ATTEMPTS, SUPPLIER_APPLICATION_MAX_FILE_MB } from '../src/config/shop.ts';
import { APPLICATION_MESSAGES, mapApplicationError } from '../src/lib/supplier/errors.ts';
import { applicationView } from '../src/lib/supplier/state.ts';
import {
  DOCUMENT_TYPE_MESSAGE,
  MAX_DOCUMENT_BYTES,
  checkDocument,
  normaliseBrn,
  supplierApplicationSchema,
} from '../src/lib/supplier/validation.ts';

const ok = {
  company: 'Island Moto Parts Ltd',
  contact: 'Anjali Ramdin',
  phone: '+230 5123 4567',
  address: '12 Royal Road, Curepipe',
  country: 'Mauritius',
  brn: 'c12345678',
  products: 'Genuine Yamaha and Honda spare parts, tyres and batteries.',
};

const firstIssue = (input) => {
  const r = supplierApplicationSchema.safeParse(input);
  assert.equal(r.success, false, JSON.stringify(input).slice(0, 80));
  return r.error.issues[0];
};

/* --------------------------------- Config --------------------------------- */

describe('supplier config', () => {
  test('5 MB and 3 attempts', () => {
    assert.equal(SUPPLIER_APPLICATION_MAX_FILE_MB, 5);
    assert.equal(SUPPLIER_APPLICATION_MAX_ATTEMPTS, 3);
    assert.equal(MAX_DOCUMENT_BYTES, 5 * 1024 * 1024);
  });
});

/* ------------------------------- Validation ------------------------------- */

describe('supplier application validation', () => {
  test('a valid application, trimmed, BRN uppercase', () => {
    const r = supplierApplicationSchema.parse({ ...ok, company: '  Island Moto Parts Ltd  ' });
    assert.equal(r.company, 'Island Moto Parts Ltd');
    assert.equal(r.brn, 'C12345678');
  });
  test('BRN normalisation and format', () => {
    assert.equal(normaliseBrn('  c-123/45 '), 'C-123/45');
    assert.equal(supplierApplicationSchema.parse({ ...ok, brn: 'ab-12/3' }).brn, 'AB-12/3');
    for (const brn of ['', 'AB12', 'AB 12345', 'AB_12345', 'A'.repeat(31), 'C1234#5']) {
      assert.deepEqual(firstIssue({ ...ok, brn }).path, ['brn'], brn);
    }
    assert.equal(supplierApplicationSchema.safeParse({ ...ok, brn: 'A'.repeat(30) }).success, true);
  });
  test('required text fields and maximum lengths', () => {
    const limits = { company: 100, contact: 100, address: 255, country: 60 };
    for (const [field, max] of Object.entries(limits)) {
      assert.deepEqual(firstIssue({ ...ok, [field]: '   ' }).path, [field], `${field} empty`);
      assert.deepEqual(firstIssue({ ...ok, [field]: 'x'.repeat(max + 1) }).path, [field], `${field} too long`);
      assert.equal(supplierApplicationSchema.safeParse({ ...ok, [field]: 'x'.repeat(max) }).success, true, `${field} at max`);
    }
  });
  test('phone: 7 to 20 digits, spaces, + or -', () => {
    for (const phone of ['', '123456', '1'.repeat(21), '5123-abcd', '(230) 5123']) {
      assert.deepEqual(firstIssue({ ...ok, phone }).path, ['phone'], phone);
    }
    for (const phone of ['5123456', '+230 5123-4567', '1'.repeat(20)]) {
      assert.equal(supplierApplicationSchema.safeParse({ ...ok, phone }).success, true, phone);
    }
  });
  test('products: 20 to 500 characters after trimming', () => {
    assert.deepEqual(firstIssue({ ...ok, products: 'Spare parts' }).path, ['products']);
    assert.deepEqual(firstIssue({ ...ok, products: `  ${'x'.repeat(19)}  ` }).path, ['products']);
    assert.equal(supplierApplicationSchema.safeParse({ ...ok, products: 'x'.repeat(20) }).success, true);
    assert.equal(supplierApplicationSchema.safeParse({ ...ok, products: 'x'.repeat(500) }).success, true);
    assert.deepEqual(firstIssue({ ...ok, products: 'x'.repeat(501) }).path, ['products']);
  });
  test('email, status and path from the browser are ignored', () => {
    const r = supplierApplicationSchema.parse({ ...ok, email: 'evil@x.y', status: 'Approved', p_document_path: 'x/y' });
    assert.deepEqual(Object.keys(r).sort(), ['address', 'brn', 'company', 'contact', 'country', 'phone', 'products']);
  });
});

/* ------------------------------ BRN document ------------------------------ */

const PDF = Uint8Array.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]);
const JPG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46]);
const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const EXE = Uint8Array.from([0x4d, 0x5a, 0x90, 0, 3, 0, 0, 0]);
const file = (name, type, size = 1000) => ({ name, type, size });

describe('document check', () => {
  test('PDF, JPG (both extensions) and PNG accepted with the right content type', () => {
    assert.deepEqual(checkDocument(file('brn.pdf', 'application/pdf'), PDF), { ok: true, extension: 'pdf', contentType: 'application/pdf' });
    assert.deepEqual(checkDocument(file('Scan.JPG', 'image/jpeg'), JPG), { ok: true, extension: 'jpg', contentType: 'image/jpeg' });
    assert.deepEqual(checkDocument(file('scan.jpeg', 'image/jpeg'), JPG), { ok: true, extension: 'jpg', contentType: 'image/jpeg' });
    assert.deepEqual(checkDocument(file('brn.png', 'image/png'), PNG), { ok: true, extension: 'png', contentType: 'image/png' });
  });
  test('missing, empty and oversize files', () => {
    assert.equal(checkDocument(null, PDF).ok, false);
    assert.equal(checkDocument(file('', 'application/octet-stream', 0), new Uint8Array()).ok, false);
    assert.match(checkDocument(file('brn.pdf', 'application/pdf', 0), new Uint8Array()).message, /empty/);
    assert.match(checkDocument(file('brn.pdf', 'application/pdf', MAX_DOCUMENT_BYTES + 1), PDF).message, /5 MB/);
    assert.equal(checkDocument(file('brn.pdf', 'application/pdf', MAX_DOCUMENT_BYTES), PDF).ok, true);
    assert.equal(checkDocument(file('brn.pdf', 'application/pdf', 1), PDF).ok, true);
  });
  test('type mismatches are refused with one message', () => {
    const bad = [
      [file('brn.jpg', 'image/jpeg'), PDF], // a PDF renamed to .jpg
      [file('brn.pdf', 'application/pdf'), JPG], // a JPEG renamed to .pdf
      [file('brn.pdf', 'image/png'), PDF], // wrong MIME
      [file('brn.exe', 'application/pdf'), PDF], // wrong extension
      [file('brn.pdf', 'application/pdf'), EXE], // not a PDF inside
      [file('brn', 'application/pdf'), PDF], // no extension
      [file('brn.gif', 'image/gif'), Uint8Array.from([0x47, 0x49, 0x46, 0x38])],
    ];
    for (const [info, head] of bad) {
      assert.deepEqual(checkDocument(info, head), { ok: false, message: DOCUMENT_TYPE_MESSAGE }, info.name);
    }
    assert.equal(DOCUMENT_TYPE_MESSAGE, 'Please upload a PDF, JPG or PNG file');
  });
});

/* ------------------------------ Error mapping ------------------------------ */

describe('submit_supplier_application error mapping', () => {
  const err = (message, code = 'P0001') => ({ code, message });
  test('every function error', () => {
    assert.deepEqual(mapApplicationError(err('NOT_AUTHENTICATED')), { kind: 'login' });
    assert.deepEqual(mapApplicationError(err('EMAIL_NOT_VERIFIED')), { kind: 'verify' });
    assert.deepEqual(mapApplicationError(err('ALREADY_PENDING')), { kind: 'error', message: APPLICATION_MESSAGES.alreadyPending });
    assert.deepEqual(mapApplicationError(err('TOO_MANY_APPLICATIONS')), { kind: 'error', message: APPLICATION_MESSAGES.tooMany });
    assert.deepEqual(mapApplicationError(err('ALREADY_SUPPLIER')), { kind: 'error', message: APPLICATION_MESSAGES.alreadySupplier });
    assert.deepEqual(mapApplicationError(err('BRN_ALREADY_REGISTERED')), { kind: 'error', message: APPLICATION_MESSAGES.brnRegistered, field: 'brn' });
    assert.deepEqual(mapApplicationError(err('MISSING_FIELDS')), { kind: 'error', message: APPLICATION_MESSAGES.missingFields });
    assert.deepEqual(mapApplicationError(err('INVALID_DOCUMENT')), { kind: 'error', message: APPLICATION_MESSAGES.invalidDocument, field: 'document' });
    assert.deepEqual(mapApplicationError(err('value too long for type character varying(30)', '22001')), { kind: 'error', message: 'One of the values is too long.' });
  });
  test('wording from the spec; unknown errors are generic', () => {
    assert.equal(
      APPLICATION_MESSAGES.brnRegistered,
      'This business registration number has already been submitted or registered. If this is a mistake, please contact the dealership.',
    );
    for (const e of [err('ALREADY_PENDINGX'), err('permission denied', '42501'), {}]) {
      assert.deepEqual(mapApplicationError(e), { kind: 'error', message: APPLICATION_MESSAGES.generic });
    }
  });
});

/* ------------------------------- Page state ------------------------------- */

describe('application page state', () => {
  const app = (id, status, extra = {}) => ({
    id, company: `Company ${id}`, country: 'Mauritius', brn: `BRN0000${id}`, status,
    rejectionReason: status === 'Rejected' ? 'BRN document unreadable' : null,
    submittedDate: '2026-10-01', reviewedDate: status === 'Pending' ? null : '2026-10-03', ...extra,
  });
  test('no application: the empty form', () => {
    assert.deepEqual(applicationView([]), { kind: 'form', rejected: null, prefill: null, attemptsLeft: 3 });
  });
  test('latest pending or approved', () => {
    assert.equal(applicationView([app(2, 'Pending'), app(1, 'Rejected')]).kind, 'pending');
    assert.equal(applicationView([app(3, 'Approved'), app(2, 'Rejected'), app(1, 'Rejected')]).kind, 'approved');
  });
  test('rejected with attempts left: form with reason and prefill', () => {
    const v = applicationView([app(2, 'Rejected', { country: null }), app(1, 'Rejected')]);
    assert.equal(v.kind, 'form');
    assert.equal(v.rejected.id, 2);
    assert.equal(v.attemptsLeft, 1);
    assert.deepEqual(v.prefill, { company: 'Company 2', country: '', brn: 'BRN00002' });
  });
  test('rejected with no attempts left: exhausted', () => {
    const v = applicationView([app(3, 'Rejected'), app(2, 'Rejected'), app(1, 'Rejected')]);
    assert.equal(v.kind, 'exhausted');
    assert.equal(v.application.id, 3);
  });
});
