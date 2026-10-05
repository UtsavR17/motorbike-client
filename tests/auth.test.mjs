// Unit tests for the pure auth modules (Node test runner; Node strips the TypeScript types).
// Run: npm test

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  BIKE_HAS_APPOINTMENTS,
  BIKE_TAKEN,
  NIC_TAKEN,
  PHONE_TAKEN,
  mapBikeError,
  mapEmailSendError,
  mapLoginError,
  mapOtpError,
  mapProfileUpdateError,
  mapRegisterCustomerError,
  mapSignUpError,
  mapUpdatePasswordError,
  rpcToken,
} from '../src/lib/auth/errors.ts';
import { safeNext } from '../src/lib/auth/redirect.ts';
import {
  bikeAddSchema,
  bikeEditSchema,
  changePasswordSchema,
  fieldErrorsFrom,
  loginSchema,
  profileCreateSchema,
  profileUpdateSchema,
  registerSchema,
  resetPasswordSchema,
  verifySchema,
} from '../src/lib/auth/validation.ts';

/** Field errors for a schema + input (or {} when valid). */
function errors(schema, input) {
  const r = schema.safeParse(input);
  return r.success ? {} : fieldErrorsFrom(r.error);
}

/* ----------------------------- Open redirect ----------------------------- */

describe('safeNext', () => {
  const hostile = [
    '//evil.com',
    '///evil.com',
    'https://evil.com',
    'http://evil.com/account',
    '/\\evil.com',
    '\\\\evil.com',
    '/\\/evil.com',
    'javascript:alert(1)',
    'JavaScript:alert(1)',
    'data:text/html,hi',
    ' /account',
    'account',
    '',
    '/acc\nount',
    '/acc\tount',
    '/%0d%0aSet-Cookie',
    `/${'a'.repeat(600)}`,
    null,
    undefined,
    42,
    ['//evil.com'],
  ];
  for (const value of hostile) {
    test(`rejects ${JSON.stringify(value)?.slice(0, 40)}`, () => {
      const out = safeNext(value);
      // "/%0d%0a..." is a harmless encoded path, so it may be kept; everything else falls back.
      if (value === '/%0d%0aSet-Cookie') assert.equal(out, value);
      else assert.equal(out, '/account');
    });
  }
  for (const value of ['/account', '/account/garage', '/parts?model=3&year=2026', '/parts#top', '/']) {
    test(`keeps ${value}`, () => assert.equal(safeNext(value), value));
  }
  test('uses the given fallback', () => assert.equal(safeNext('//evil.com', '/x'), '/x'));
  test('takes the first array value', () => assert.equal(safeNext(['/account/garage', '//evil']), '/account/garage'));
});

/* ------------------------------ Validation ------------------------------- */

describe('register / login schemas', () => {
  const ok = { email: ' User@Example.COM ', password: 'abc12345', confirmPassword: 'abc12345' };
  test('valid input; email trimmed and lowercased', () => {
    const r = registerSchema.parse(ok);
    assert.equal(r.email, 'user@example.com');
  });
  test('email required, format, max 100', () => {
    assert.ok(errors(registerSchema, { ...ok, email: '' }).email);
    assert.ok(errors(registerSchema, { ...ok, email: 'not-an-email' }).email);
    assert.ok(errors(registerSchema, { ...ok, email: `${'a'.repeat(95)}@x.com` }).email);
  });
  test('password 8 to 72, letter and number', () => {
    assert.ok(errors(registerSchema, { ...ok, password: 'ab1', confirmPassword: 'ab1' }).password);
    const long = `a1${'b'.repeat(71)}`;
    assert.ok(errors(registerSchema, { ...ok, password: long, confirmPassword: long }).password);
    assert.ok(errors(registerSchema, { ...ok, password: '12345678', confirmPassword: '12345678' }).password);
    assert.ok(errors(registerSchema, { ...ok, password: 'abcdefgh', confirmPassword: 'abcdefgh' }).password);
  });
  test('confirm password must match', () => {
    assert.equal(errors(registerSchema, { ...ok, confirmPassword: 'abc12346' }).confirmPassword, 'Passwords do not match');
  });
  test('login requires a password', () => {
    assert.ok(errors(loginSchema, { email: 'a@b.co', password: '' }).password);
    assert.deepEqual(errors(loginSchema, { email: 'a@b.co', password: 'x' }), {});
  });
});

describe('code schemas', () => {
  test('6 digits, spaces allowed', () => {
    assert.equal(verifySchema.parse({ email: 'a@b.co', code: '123 456' }).code, '123456');
    for (const code of ['', '12345', '1234567', 'abcdef', '12345a']) {
      assert.ok(errors(verifySchema, { email: 'a@b.co', code }).code, code);
    }
  });
  test('reset needs code, strong password and match', () => {
    const base = { email: 'a@b.co', code: '123456', password: 'newpass12', confirmPassword: 'newpass12' };
    assert.deepEqual(errors(resetPasswordSchema, base), {});
    assert.ok(errors(resetPasswordSchema, { ...base, code: '1' }).code);
    assert.ok(errors(resetPasswordSchema, { ...base, confirmPassword: 'x' }).confirmPassword);
  });
  test('change password must differ from the current one', () => {
    const e = errors(changePasswordSchema, { currentPassword: 'abc12345', password: 'abc12345', confirmPassword: 'abc12345' });
    assert.ok(e.password);
    assert.ok(errors(changePasswordSchema, { currentPassword: '', password: 'new12345', confirmPassword: 'new12345' }).currentPassword);
  });
});

describe('profile schemas', () => {
  const ok = {
    firstName: "  Marie-Claire ",
    lastName: "O'Neil",
    phone: '+230 5123-4567',
    nic: 'a1234567890123',
    street: 'Royal Road',
    town: 'Port Louis',
    homeNumber: '',
    postCode: '',
  };
  test('valid input; NIC uppercased; optional fields become null', () => {
    const r = profileCreateSchema.parse(ok);
    assert.equal(r.firstName, 'Marie-Claire');
    assert.equal(r.nic, 'A1234567890123');
    assert.equal(r.homeNumber, null);
    assert.equal(r.postCode, null);
  });
  test('names: letters, spaces, hyphens, apostrophes, 1 to 50', () => {
    assert.ok(errors(profileCreateSchema, { ...ok, firstName: '' }).firstName);
    assert.ok(errors(profileCreateSchema, { ...ok, firstName: 'J0hn' }).firstName);
    assert.ok(errors(profileCreateSchema, { ...ok, lastName: 'x'.repeat(51) }).lastName);
    assert.deepEqual(errors(profileCreateSchema, { ...ok, firstName: 'José' }), {});
  });
  test('phone: 7 to 20 of digits, spaces, + and -', () => {
    assert.ok(errors(profileCreateSchema, { ...ok, phone: '12345' }).phone);
    assert.ok(errors(profileCreateSchema, { ...ok, phone: '5123x4567' }).phone);
    assert.ok(errors(profileCreateSchema, { ...ok, phone: '1'.repeat(21) }).phone);
  });
  test('NIC: 8 to 20 letters and digits', () => {
    assert.ok(errors(profileCreateSchema, { ...ok, nic: 'A123456' }).nic);
    assert.ok(errors(profileCreateSchema, { ...ok, nic: 'A1234 5678' }).nic);
    assert.ok(errors(profileCreateSchema, { ...ok, nic: 'A'.repeat(21) }).nic);
  });
  test('address lengths', () => {
    assert.ok(errors(profileCreateSchema, { ...ok, street: '' }).street);
    assert.ok(errors(profileCreateSchema, { ...ok, street: 's'.repeat(51) }).street);
    assert.ok(errors(profileCreateSchema, { ...ok, town: 't'.repeat(61) }).town);
    assert.ok(errors(profileCreateSchema, { ...ok, homeNumber: 'h'.repeat(21) }).homeNumber);
    assert.ok(errors(profileCreateSchema, { ...ok, postCode: 'p'.repeat(11) }).postCode);
  });
  test('update schema has no NIC field', () => {
    const r = profileUpdateSchema.parse({ ...ok, nic: 'ignored' });
    assert.equal('nic' in r, false);
  });
});

describe('bike schemas', () => {
  const ok = { modelId: '3', registration: ' ab 12c ', year: '2020', vin: 'me4kc1234 5678' };
  test('valid input uppercased and spaces removed', () => {
    const r = bikeAddSchema.parse(ok);
    assert.equal(r.modelId, 3);
    assert.equal(r.registration, 'AB12C');
    assert.equal(r.year, 2020);
    assert.equal(r.vin, 'ME4KC12345678');
  });
  test('registration 1 to 6 letters and digits', () => {
    assert.ok(errors(bikeAddSchema, { ...ok, registration: '' }).registration);
    assert.ok(errors(bikeAddSchema, { ...ok, registration: 'ABC1234' }).registration);
    assert.ok(errors(bikeAddSchema, { ...ok, registration: 'AB-12' }).registration);
  });
  test('year 1950 to next year', () => {
    const next = new Date().getFullYear() + 1;
    assert.ok(errors(bikeAddSchema, { ...ok, year: '1949' }).year);
    assert.ok(errors(bikeAddSchema, { ...ok, year: String(next + 1) }).year);
    assert.ok(errors(bikeAddSchema, { ...ok, year: '20x0' }).year);
    assert.deepEqual(errors(bikeAddSchema, { ...ok, year: String(next) }), {});
  });
  test('VIN 5 to 50 letters and digits', () => {
    assert.ok(errors(bikeAddSchema, { ...ok, vin: 'AB12' }).vin);
    assert.ok(errors(bikeAddSchema, { ...ok, vin: 'A'.repeat(51) }).vin);
    assert.ok(errors(bikeAddSchema, { ...ok, vin: 'ME4-KC123' }).vin);
  });
  test('model must be a numeric id', () => {
    assert.ok(errors(bikeAddSchema, { ...ok, modelId: '' }).modelId);
    assert.ok(errors(bikeAddSchema, { ...ok, modelId: '3; drop' }).modelId);
  });
  test('edit schema only has registration and year', () => {
    assert.deepEqual(Object.keys(bikeEditSchema.parse({ registration: 'x1', year: '2019', vin: 'zz' })).sort(), ['registration', 'year']);
  });
});

/* ----------------------------- Error mapping ----------------------------- */

describe('auth error mapping', () => {
  test('signUp: existing accounts look like success', () => {
    assert.equal(mapSignUpError({ code: 'user_already_exists' }), 'neutral');
    assert.equal(mapSignUpError({ code: 'email_exists' }), 'neutral');
    assert.ok(mapSignUpError({ code: 'weak_password' }).fieldErrors.password);
    assert.match(mapSignUpError({ code: 'over_email_send_rate_limit' }).message, /Too many/);
  });
  test('login: generic except unconfirmed', () => {
    assert.equal(mapLoginError({ code: 'invalid_credentials' }).message, 'Incorrect email or password.');
    assert.equal(mapLoginError({ code: 'user_not_found' }).message, 'Incorrect email or password.');
    assert.equal(mapLoginError({ code: 'email_not_confirmed' }), 'unconfirmed');
    assert.equal(mapLoginError({ message: 'Email not confirmed' }), 'unconfirmed');
  });
  test('otp: wrong and expired give the same message', () => {
    assert.equal(mapOtpError({ code: 'otp_expired' }).fieldErrors.code, mapOtpError({ code: 'invalid' }).fieldErrors.code);
  });
  test('email send: neutral unless rate limited', () => {
    assert.equal(mapEmailSendError({ code: 'user_not_found' }), 'neutral');
    assert.ok(mapEmailSendError({ status: 429 }).message);
  });
  test('update password', () => {
    assert.ok(mapUpdatePasswordError({ code: 'same_password' }).fieldErrors.password);
    assert.ok(mapUpdatePasswordError({ code: 'reauthentication_needed' }).message);
  });
});

describe('register_customer RPC error mapping', () => {
  const rpc = (message, code = 'P0001') => mapRegisterCustomerError({ code, message });
  test('exact tokens, no partial matches', () => {
    assert.equal(rpcToken('NIC_OR_PHONE_ALREADY_REGISTERED'), 'NIC_OR_PHONE_ALREADY_REGISTERED');
    assert.equal(rpcToken('PHONE_ALREADY_REGISTERED'), 'PHONE_ALREADY_REGISTERED');
    assert.equal(rpcToken('error: NIC_ALREADY_REGISTERED.'), 'NIC_ALREADY_REGISTERED');
    assert.equal(rpcToken('XNIC_ALREADY_REGISTERED'), null);
  });
  test('each code', () => {
    assert.equal(rpc('ALREADY_HAS_PROFILE').redirect, 'profile');
    assert.equal(rpc('NOT_AUTHENTICATED').redirect, 'login');
    assert.match(rpc('EMAIL_NOT_VERIFIED').message, /confirm your email/);
    assert.match(rpc('MISSING_FIELDS').message, /required/);
    assert.equal(rpc('NIC_ALREADY_REGISTERED').fieldErrors.nic, NIC_TAKEN);
    assert.equal(rpc('PHONE_ALREADY_REGISTERED').fieldErrors.phone, PHONE_TAKEN);
    const both = rpc('NIC_OR_PHONE_ALREADY_REGISTERED');
    assert.ok(both.message && both.fieldErrors.nic && both.fieldErrors.phone);
    assert.equal(rpc('value too long for type character varying(50)', '22001').message, 'One of the values is too long.');
    assert.match(rpc('boom', 'XX000').message, /could not save/);
  });
});

describe('profile update and bike error mapping', () => {
  test('profile update', () => {
    assert.equal(
      mapProfileUpdateError({ code: '23505', message: 'duplicate key value violates unique constraint "customer_phonenumber_key"' }).fieldErrors.phone,
      PHONE_TAKEN,
    );
    assert.ok(mapProfileUpdateError({ code: '23505', message: 'duplicate key' }).message);
    assert.equal(mapProfileUpdateError({ code: '22001' }).message, 'One of the values is too long.');
    assert.match(mapProfileUpdateError({ code: 'P0001', message: 'Customers may only change their contact details' }).message, /contact details/);
  });
  test('bikes', () => {
    assert.equal(mapBikeError('add', { code: '23505' }).message, BIKE_TAKEN);
    assert.equal(mapBikeError('edit', { code: '23505' }).message, BIKE_TAKEN);
    assert.equal(mapBikeError('delete', { code: '23503' }).message, BIKE_HAS_APPOINTMENTS);
    assert.ok(mapBikeError('add', { code: '23503' }).fieldErrors.modelId);
    assert.equal(mapBikeError('add', { code: '22001' }).message, 'One of the values is too long.');
    assert.match(
      mapBikeError('edit', { code: 'P0001', message: 'Customers may only change the registration number and year of a bike' }).message,
      /registration number and year/,
    );
    assert.ok(mapBikeError('add', { code: '42501' }).message);
  });
});
