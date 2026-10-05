'use client';

import { useActionState } from 'react';
import { Field } from '@/components/forms/Field';
import { FormMessage } from '@/components/forms/FormMessage';
import { SubmitButton } from '@/components/forms/SubmitButton';
import { useFormFeedback } from '@/components/forms/useFormFeedback';
import { createProfileAction, updateProfileAction } from '@/lib/actions/profile';
import { initialFormState } from '@/lib/forms';

export interface ProfileValues {
  firstName: string;
  lastName: string;
  phone: string;
  street: string;
  town: string;
  homeNumber: string;
  postCode: string;
}

/**
 * mode "create": all fields including NIC, calls register_customer (no email field).
 * mode "update": contact fields only; NIC and email are shown read-only by the page.
 */
export function ProfileForm({ mode, initial }: { mode: 'create' | 'update'; initial?: ProfileValues }) {
  const [state, action] = useActionState(
    mode === 'create' ? createProfileAction : updateProfileAction,
    initialFormState,
  );
  const { formRef, messageRef } = useFormFeedback(state);
  const e = state.fieldErrors ?? {};
  const v = (key: keyof ProfileValues | 'nic') =>
    state.values?.[key] ?? (key === 'nic' ? '' : (initial?.[key] ?? ''));

  return (
    <form ref={formRef} action={action} noValidate className="space-y-5">
      <FormMessage state={state} ref={messageRef} />

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-3 text-base font-semibold">Your details</legend>
        <Field name="firstName" label="First name" autoComplete="given-name" maxLength={50} required
          defaultValue={v('firstName')} error={e.firstName} />
        <Field name="lastName" label="Last name" autoComplete="family-name" maxLength={50} required
          defaultValue={v('lastName')} error={e.lastName} />
        <Field name="phone" label="Phone number" type="tel" autoComplete="tel" maxLength={20} required
          defaultValue={v('phone')} error={e.phone} hint="Digits, spaces, + or -." />
        {mode === 'create' && (
          <Field name="nic" label="NIC number" autoComplete="off" maxLength={20} required
            defaultValue={v('nic')} error={e.nic}
            hint="8 to 20 letters and digits. It cannot be changed later." className="[&_input]:uppercase" />
        )}
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-3 text-base font-semibold">Address</legend>
        <Field name="homeNumber" label="House or flat number" autoComplete="address-line2" maxLength={20} optional
          defaultValue={v('homeNumber')} error={e.homeNumber} />
        <Field name="street" label="Street" autoComplete="address-line1" maxLength={50} required
          defaultValue={v('street')} error={e.street} />
        <Field name="town" label="Town" autoComplete="address-level2" maxLength={60} required
          defaultValue={v('town')} error={e.town} />
        <Field name="postCode" label="Post code" autoComplete="postal-code" maxLength={10} optional
          defaultValue={v('postCode')} error={e.postCode} />
      </fieldset>

      <SubmitButton pendingLabel="Saving..." variant="primary">
        {mode === 'create' ? 'Save profile' : 'Save changes'}
      </SubmitButton>
    </form>
  );
}
