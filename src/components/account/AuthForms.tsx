'use client';

import Link from 'next/link';
import { useActionState, useEffect, useState } from 'react';
import { Field } from '@/components/forms/Field';
import { FormMessage } from '@/components/forms/FormMessage';
import { SubmitButton } from '@/components/forms/SubmitButton';
import { useFormFeedback } from '@/components/forms/useFormFeedback';
import {
  changePasswordAction,
  forgotPasswordAction,
  loginAction,
  registerAction,
  resendSignupAction,
  resetPasswordAction,
  verifyAction,
} from '@/lib/actions/auth';
import { RESEND_COOLDOWN_SECONDS } from '@/lib/auth/config';
import { initialFormState } from '@/lib/forms';

const PASSWORD_HINT = '8 to 72 characters, with at least one letter and one number.';

/* -------------------------------- Register ------------------------------- */

export function RegisterForm({ next }: { next?: string }) {
  const [state, action] = useActionState(registerAction, initialFormState);
  const { formRef, messageRef } = useFormFeedback(state);
  const e = state.fieldErrors ?? {};
  return (
    <form ref={formRef} action={action} noValidate className="space-y-4">
      <FormMessage state={state} ref={messageRef} />
      {next && <input type="hidden" name="next" value={next} />}
      <Field name="email" label="Email" type="email" autoComplete="email" maxLength={100} required
        defaultValue={state.values?.email} error={e.email} />
      <Field name="password" label="Password" type="password" autoComplete="new-password" maxLength={72} required
        hint={PASSWORD_HINT} error={e.password} />
      <Field name="confirmPassword" label="Confirm password" type="password" autoComplete="new-password"
        maxLength={72} required error={e.confirmPassword} />
      <SubmitButton pendingLabel="Creating account..." className="w-full">Create account</SubmitButton>
    </form>
  );
}

/* --------------------------------- Login --------------------------------- */

export function LoginForm({ next }: { next?: string }) {
  const [state, action] = useActionState(loginAction, initialFormState);
  const { formRef, messageRef } = useFormFeedback(state);
  const e = state.fieldErrors ?? {};
  return (
    <form ref={formRef} action={action} noValidate className="space-y-4">
      <FormMessage state={state} ref={messageRef} />
      {next && <input type="hidden" name="next" value={next} />}
      <Field name="email" label="Email" type="email" autoComplete="email" maxLength={100} required
        defaultValue={state.values?.email} error={e.email} />
      <div>
        <Field name="password" label="Password" type="password" autoComplete="current-password" maxLength={72}
          required error={e.password} />
        <p className="mt-2 text-right text-sm">
          <Link href="/forgot-password" className="link">Forgot your password?</Link>
        </p>
      </div>
      <SubmitButton pendingLabel="Signing in..." className="w-full">Sign in</SubmitButton>
    </form>
  );
}

/* ------------------------------ Verify email ----------------------------- */

export function VerifyForm({ email, next }: { email: string; next?: string }) {
  const [state, action] = useActionState(verifyAction, initialFormState);
  const { formRef, messageRef } = useFormFeedback(state);
  const e = state.fieldErrors ?? {};
  return (
    <form ref={formRef} action={action} noValidate className="space-y-4">
      <FormMessage state={state} ref={messageRef} />
      {next && <input type="hidden" name="next" value={next} />}
      <Field name="email" label="Email" type="email" autoComplete="email" maxLength={100} required
        defaultValue={state.values?.email ?? email} readOnly={Boolean(email)} error={e.email} />
      <Field name="code" label="6-digit code" type="text" inputMode="numeric" autoComplete="one-time-code"
        pattern="[0-9]*" maxLength={6} required autoFocus error={e.code}
        className="[&_input]:text-lg [&_input]:tracking-[0.4em]" />
      <SubmitButton pendingLabel="Checking code..." className="w-full">Confirm email</SubmitButton>
    </form>
  );
}

/** "Resend code" with a cooldown; starts counting because a code was just sent. */
export function ResendCodeForm({ email }: { email: string }) {
  const [state, action] = useActionState(resendSignupAction, initialFormState);
  const [remaining, setRemaining] = useState(RESEND_COOLDOWN_SECONDS);

  // Restart the cooldown after every successful resend (state adjusted during render).
  const [seenAt, setSeenAt] = useState(state.submittedAt);
  if (state.submittedAt !== seenAt) {
    setSeenAt(state.submittedAt);
    if (state.status === 'success') setRemaining(RESEND_COOLDOWN_SECONDS);
  }

  useEffect(() => {
    if (remaining <= 0) return;
    const t = setTimeout(() => setRemaining((r) => r - 1), 1000);
    return () => clearTimeout(t);
  }, [remaining]);

  if (!email) return null;
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="email" value={email} />
      <FormMessage state={state} />
      <button type="submit" disabled={remaining > 0} className="btn-outline h-11 w-full">
        {remaining > 0 ? `Resend code in ${remaining}s` : 'Resend code'}
      </button>
    </form>
  );
}

/* ---------------------------- Password reset ----------------------------- */

export function ForgotPasswordForm() {
  const [state, action] = useActionState(forgotPasswordAction, initialFormState);
  const { formRef, messageRef } = useFormFeedback(state);
  const e = state.fieldErrors ?? {};
  return (
    <form ref={formRef} action={action} noValidate className="space-y-4">
      <FormMessage state={state} ref={messageRef} />
      <Field name="email" label="Email" type="email" autoComplete="email" maxLength={100} required
        defaultValue={state.values?.email} error={e.email} />
      <SubmitButton pendingLabel="Sending..." className="w-full">Send reset code</SubmitButton>
    </form>
  );
}

export function ResetPasswordForm({ email }: { email: string }) {
  const [state, action] = useActionState(resetPasswordAction, initialFormState);
  const { formRef, messageRef } = useFormFeedback(state);
  const e = state.fieldErrors ?? {};
  return (
    <form ref={formRef} action={action} noValidate className="space-y-4">
      <FormMessage state={state} ref={messageRef} />
      <Field name="email" label="Email" type="email" autoComplete="email" maxLength={100} required
        defaultValue={state.values?.email ?? email} error={e.email} />
      <Field name="code" label="6-digit code" type="text" inputMode="numeric" autoComplete="one-time-code"
        pattern="[0-9]*" maxLength={6} required autoFocus={Boolean(email)} error={e.code}
        className="[&_input]:text-lg [&_input]:tracking-[0.4em]" />
      <Field name="password" label="New password" type="password" autoComplete="new-password" maxLength={72}
        required hint={PASSWORD_HINT} error={e.password} />
      <Field name="confirmPassword" label="Confirm new password" type="password" autoComplete="new-password"
        maxLength={72} required error={e.confirmPassword} />
      <SubmitButton pendingLabel="Saving..." className="w-full">Set new password</SubmitButton>
    </form>
  );
}

export function ChangePasswordForm() {
  const [state, action] = useActionState(changePasswordAction, initialFormState);
  const { formRef, messageRef } = useFormFeedback(state);
  const e = state.fieldErrors ?? {};
  return (
    <form ref={formRef} action={action} noValidate className="space-y-4">
      <FormMessage state={state} ref={messageRef} />
      <Field name="currentPassword" label="Current password" type="password" autoComplete="current-password"
        maxLength={72} required error={e.currentPassword} />
      <Field name="password" label="New password" type="password" autoComplete="new-password" maxLength={72}
        required hint={PASSWORD_HINT} error={e.password} />
      <Field name="confirmPassword" label="Confirm new password" type="password" autoComplete="new-password"
        maxLength={72} required error={e.confirmPassword} />
      <SubmitButton pendingLabel="Saving..." variant="dark">Change password</SubmitButton>
    </form>
  );
}
