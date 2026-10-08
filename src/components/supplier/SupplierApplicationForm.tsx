'use client';

import { FileUp, Send } from 'lucide-react';
import { useActionState, type TextareaHTMLAttributes } from 'react';
import { Field, ReadOnlyValue } from '@/components/forms/Field';
import { FormMessage } from '@/components/forms/FormMessage';
import { SubmitButton } from '@/components/forms/SubmitButton';
import { useFormFeedback } from '@/components/forms/useFormFeedback';
import { SUPPLIER_APPLICATION_MAX_FILE_MB } from '@/config/shop';
import { submitSupplierApplicationAction } from '@/lib/actions/supplierApplication';
import { initialFormState } from '@/lib/forms';
import type { FormPrefill } from '@/lib/supplier/state';

function TextArea({
  name,
  label,
  error,
  hint,
  ...rest
}: { name: string; label: string; error?: string; hint?: string } & Omit<
  TextareaHTMLAttributes<HTMLTextAreaElement>,
  'name' | 'id'
>) {
  const id = `field-${name}`;
  const describedBy = [error ? `${id}-error` : '', hint ? `${id}-hint` : ''].filter(Boolean).join(' ') || undefined;
  return (
    <div className="sm:col-span-2">
      <label htmlFor={id} className="field-label">{label}</label>
      <textarea
        id={id}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={`field min-h-24 ${error ? 'border-bad' : ''}`}
        {...rest}
      />
      {error && <p id={`${id}-error`} className="mt-1 text-sm font-medium text-bad">{error}</p>}
      {hint && <p id={`${id}-hint`} className="mt-1 text-xs text-ink-muted">{hint}</p>}
    </div>
  );
}

/** Supplier application form. Only the fields and the document are sent; never an email or status. */
export function SupplierApplicationForm({ email, prefill }: { email: string; prefill: FormPrefill | null }) {
  const [state, action] = useActionState(submitSupplierApplicationAction, initialFormState);
  const { formRef, messageRef } = useFormFeedback(state);
  const e = state.fieldErrors ?? {};
  const v = (key: string, fallback = '') => state.values?.[key] ?? fallback;

  return (
    <form ref={formRef} action={action} noValidate className="space-y-5">
      <FormMessage state={state} ref={messageRef} />

      <ReadOnlyValue label="Email" value={email} note="Applications are linked to this email." />

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-3 text-base font-semibold">Company details</legend>
        <Field name="company" label="Company name" maxLength={100} required autoComplete="organization"
          defaultValue={v('company', prefill?.company)} error={e.company} />
        <Field name="contact" label="Contact person" maxLength={100} required autoComplete="name"
          defaultValue={v('contact')} error={e.contact} />
        <Field name="phone" label="Phone" type="tel" maxLength={20} required autoComplete="tel"
          defaultValue={v('phone')} error={e.phone} hint="7 to 20 digits, spaces, + or -." />
        <Field name="country" label="Country" maxLength={60} required autoComplete="country-name"
          defaultValue={v('country', prefill?.country || 'Mauritius')} error={e.country} />
        <TextArea name="address" label="Business address" maxLength={255} required rows={3}
          autoComplete="street-address" defaultValue={v('address')} error={e.address} />
        <Field name="brn" label="BRN number" maxLength={30} required autoCapitalize="characters"
          defaultValue={v('brn', prefill?.brn)} error={e.brn}
          hint="Business Registration Number: 5 to 30 letters, digits, hyphens or slashes." className="sm:col-span-2" />
        <TextArea name="products" label="What would you like to supply?" maxLength={500} required rows={4}
          defaultValue={v('products')} error={e.products}
          hint="For example the brands, parts or motorcycles you supply. 20 to 500 characters." />
      </fieldset>

      <div>
        <label htmlFor="field-document" className="field-label">BRN document</label>
        <div className="flex items-start gap-3 rounded-control border-2 border-dashed border-line p-4 has-[:focus-visible]:border-accent">
          <FileUp aria-hidden="true" className="mt-1 h-5 w-5 shrink-0 text-accent-strong" />
          <input
            id="field-document"
            name="document"
            type="file"
            required
            accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
            aria-invalid={e.document ? true : undefined}
            aria-describedby={`field-document-hint${e.document ? ' field-document-error' : ''}`}
            className="block w-full text-sm file:mr-3 file:rounded-control file:border-0 file:bg-ink file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-ink-soft"
          />
        </div>
        {e.document && <p id="field-document-error" className="mt-1 text-sm font-medium text-bad">{e.document}</p>}
        <p id="field-document-hint" className="mt-1 text-xs text-ink-muted">
          PDF, JPG or PNG, up to {SUPPLIER_APPLICATION_MAX_FILE_MB} MB. Stored privately: only the dealership can view it.
          {state.status === 'error' ? ' Please choose the file again.' : ''}
        </p>
      </div>

      <SubmitButton pendingLabel="Submitting application..." className="w-full sm:w-auto">
        <Send aria-hidden="true" className="h-4 w-4" />
        Submit application
      </SubmitButton>
    </form>
  );
}
