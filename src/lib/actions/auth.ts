'use server';

// Auth Server Actions. Passwords and codes are never logged, echoed back or put in URLs.

import { redirect } from 'next/navigation';
import { AFTER_VERIFY, GOOGLE_AUTH_ENABLED, SITE_URL, verifyHref } from '@/lib/auth/config';
import {
  mapEmailSendError,
  mapLoginError,
  mapOtpError,
  mapSignUpError,
  mapUpdatePasswordError,
} from '@/lib/auth/errors';
import { safeNext } from '@/lib/auth/redirect';
import { requireUser } from '@/lib/auth/session';
import {
  changePasswordSchema,
  emailOnlySchema,
  fieldErrorsFrom,
  loginSchema,
  readForm,
  registerSchema,
  resetPasswordSchema,
  verifySchema,
} from '@/lib/auth/validation';
import { errorState, successState, type FormState } from '@/lib/forms';
import { createClient } from '@/lib/supabase/server';

const CALLBACK_URL = `${SITE_URL}/auth/callback`;

/** Keeps a "next" value only when it is a safe same-site path. */
function optionalNext(value: string): string | undefined {
  return value ? safeNext(value, '') || undefined : undefined;
}

/* ------------------------------- Register -------------------------------- */

export async function registerAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const raw = readForm(formData, ['email', 'password', 'confirmPassword', 'next']);
  const values = { email: raw.email };
  const parsed = registerSchema.safeParse(raw);
  if (!parsed.success) return errorState(values, { fieldErrors: fieldErrorsFrom(parsed.error) });

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { emailRedirectTo: CALLBACK_URL },
  });
  if (error) {
    const mapped = mapSignUpError(error);
    // An existing account gets the same response as a new one.
    if (mapped !== 'neutral') return errorState(values, mapped);
  }
  redirect(verifyHref(parsed.data.email, { next: optionalNext(raw.next) }));
}

/* ------------------------------ Verify email ----------------------------- */

export async function verifyAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const raw = readForm(formData, ['email', 'code', 'next']);
  const values = { email: raw.email };
  const parsed = verifySchema.safeParse(raw);
  if (!parsed.success) return errorState(values, { fieldErrors: fieldErrorsFrom(parsed.error) });

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    email: parsed.data.email,
    token: parsed.data.code,
    type: 'signup',
  });
  if (error) return errorState(values, mapOtpError(error));
  redirect(safeNext(raw.next, AFTER_VERIFY));
}

export async function resendSignupAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const raw = readForm(formData, ['email']);
  const parsed = emailOnlySchema.safeParse(raw);
  if (!parsed.success) return errorState(raw, { fieldErrors: fieldErrorsFrom(parsed.error) });

  const supabase = await createClient();
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email: parsed.data.email,
    options: { emailRedirectTo: CALLBACK_URL },
  });
  if (error) {
    const mapped = mapEmailSendError(error);
    if (mapped !== 'neutral') return errorState(raw, mapped);
  }
  return successState('If this email is waiting for confirmation, we sent a new code.', raw);
}

/* ------------------------------ Sign in / out ---------------------------- */

export async function loginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const raw = readForm(formData, ['email', 'password', 'next']);
  const values = { email: raw.email };
  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) return errorState(values, { fieldErrors: fieldErrorsFrom(parsed.error) });

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (error) {
    const mapped = mapLoginError(error);
    if (mapped === 'unconfirmed') {
      redirect(verifyHref(parsed.data.email, { unconfirmed: true, next: optionalNext(raw.next) }));
    }
    return errorState(values, mapped);
  }
  redirect(safeNext(raw.next));
}

export async function googleSignInAction(formData: FormData): Promise<void> {
  if (!GOOGLE_AUTH_ENABLED) redirect('/login');
  const next = safeNext(formData.get('next'));
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${CALLBACK_URL}?next=${encodeURIComponent(next)}` },
  });
  if (error || !data.url) redirect('/login?error=oauth');
  redirect(data.url);
}

export async function signOutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: 'local' });
  redirect('/');
}

/* ---------------------------- Password reset ----------------------------- */

export async function forgotPasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const raw = readForm(formData, ['email']);
  const parsed = emailOnlySchema.safeParse(raw);
  if (!parsed.success) return errorState(raw, { fieldErrors: fieldErrorsFrom(parsed.error) });

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${SITE_URL}/reset-password`,
  });
  if (error) {
    const mapped = mapEmailSendError(error);
    if (mapped !== 'neutral') return errorState(raw, mapped);
  }
  redirect(`/reset-password?${new URLSearchParams({ email: parsed.data.email, sent: '1' })}`);
}

export async function resetPasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const raw = readForm(formData, ['email', 'code', 'password', 'confirmPassword']);
  const values = { email: raw.email };
  const parsed = resetPasswordSchema.safeParse(raw);
  if (!parsed.success) return errorState(values, { fieldErrors: fieldErrorsFrom(parsed.error) });

  const supabase = await createClient();
  const { error: otpError } = await supabase.auth.verifyOtp({
    email: parsed.data.email,
    token: parsed.data.code,
    type: 'recovery',
  });
  if (otpError) return errorState(values, mapOtpError(otpError));

  // The code is now used and this browser is signed in.
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    if (error.code === 'same_password') redirect('/account?notice=password-unchanged');
    const mapped = mapUpdatePasswordError(error);
    return errorState(values, {
      message: `${mapped.fieldErrors?.password ?? mapped.message ?? ''} Your code was used, so request a new one to try again.`.trim(),
    });
  }
  redirect('/account?notice=password-reset');
}

/* ---------------------------- Change password ---------------------------- */

export async function changePasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser('/account/security');
  if (!user.hasPassword || !user.email) {
    return errorState(undefined, { message: 'You sign in with Google, so there is no password to change here.' });
  }
  const raw = readForm(formData, ['currentPassword', 'password', 'confirmPassword']);
  const parsed = changePasswordSchema.safeParse(raw);
  if (!parsed.success) return errorState(undefined, { fieldErrors: fieldErrorsFrom(parsed.error) });

  const supabase = await createClient();
  // Re-authenticate with the current password first.
  const { error: authError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: parsed.data.currentPassword,
  });
  if (authError) {
    const mapped = mapLoginError(authError);
    if (mapped !== 'unconfirmed' && mapped.message?.startsWith('Too many')) return errorState(undefined, mapped);
    return errorState(undefined, { fieldErrors: { currentPassword: 'Your current password is incorrect.' } });
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return errorState(undefined, mapUpdatePasswordError(error));
  return successState('Your password has been changed.');
}
