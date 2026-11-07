// Fix Phase 5: a login deactivated in the Admin Panel (Supabase ban) gets its own message on the
// login form only. Every other login failure stays generic, and password reset stays neutral.
// Run: npm test

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  ACCOUNT_DEACTIVATED,
  mapEmailSendError,
  mapLoginError,
  mapOtpError,
} from '../src/lib/auth/errors.ts';

const GENERIC = 'Incorrect email or password.';

describe('login error mapping: deactivated accounts', () => {
  test('the message text', () => {
    assert.equal(ACCOUNT_DEACTIVATED, 'This account has been deactivated. Please contact the dealership.');
  });

  test('user_banned code shows the deactivated message', () => {
    assert.deepEqual(mapLoginError({ code: 'user_banned', message: 'User is banned', status: 400 }), {
      message: ACCOUNT_DEACTIVATED,
    });
  });

  test('older servers without a code: matched on the message', () => {
    assert.equal(mapLoginError({ message: 'User is banned' }).message, ACCOUNT_DEACTIVATED);
  });

  test('every other failure stays generic', () => {
    for (const e of [
      { code: 'invalid_credentials', message: 'Invalid login credentials' },
      { code: 'user_not_found' },
      { code: 'validation_failed' },
      { code: 'unexpected_failure', status: 500 },
      { message: 'Network error' },
      { code: 'banned_ip' },
      { message: 'This user is not banned' },
      {},
    ]) {
      assert.equal(mapLoginError(e).message, GENERIC, JSON.stringify(e));
    }
  });

  test('unconfirmed and rate limits are unchanged', () => {
    assert.equal(mapLoginError({ code: 'email_not_confirmed' }), 'unconfirmed');
    assert.notEqual(mapLoginError({ status: 429 }).message, ACCOUNT_DEACTIVATED);
  });
});

describe('password reset does not reveal a deactivated account', () => {
  test('sending the reset code stays neutral', () => {
    assert.equal(mapEmailSendError({ code: 'user_banned', message: 'User is banned' }), 'neutral');
  });

  test('verifying the reset code gives the usual wrong-or-expired message', () => {
    const banned = mapOtpError({ code: 'user_banned', message: 'User is banned' });
    const wrong = mapOtpError({ code: 'otp_expired' });
    assert.deepEqual(banned, wrong);
    assert.ok(!JSON.stringify(banned).includes('deactivated'));
  });
});
