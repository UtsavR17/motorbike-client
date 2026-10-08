'use server';

import { randomUUID } from 'node:crypto';
import { redirect } from 'next/navigation';
import { loginHref, verifyHref } from '@/lib/auth/config';
import { requireUser } from '@/lib/auth/session';
import { fieldErrorsFrom, readForm, type FieldErrors } from '@/lib/auth/validation';
import { errorState, type FormState } from '@/lib/forms';
import { mapApplicationError } from '@/lib/supplier/errors';
import { checkDocument, supplierApplicationSchema } from '@/lib/supplier/validation';
import { createClient } from '@/lib/supabase/server';

const BUCKET = 'supplier-applications';
const PAGE = '/account/supplier-application';
const FIELDS = ['company', 'contact', 'phone', 'address', 'country', 'brn', 'products'] as const;

/**
 * Validates the form and the BRN document, uploads the document into the user's own folder of
 * the private bucket under a random name, then creates the application with
 * submit_supplier_application. The email comes from the login, never from the form.
 */
export async function submitSupplierApplicationAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser(PAGE);
  const raw = readForm(formData, FIELDS);
  const values = { ...raw };

  const parsed = supplierApplicationSchema.safeParse(raw);
  const fieldErrors: FieldErrors = parsed.success ? {} : fieldErrorsFrom(parsed.error);

  const file = formData.get('document');
  const document = file instanceof File && file.size > 0 ? file : null;
  const head = document ? new Uint8Array(await document.slice(0, 8).arrayBuffer()) : new Uint8Array();
  const check = checkDocument(
    file instanceof File ? { name: file.name, size: file.size, type: file.type } : null,
    head,
  );
  if (!check.ok) fieldErrors.document = check.message;

  if (!parsed.success || !check.ok || !document) return errorState(values, { fieldErrors });
  const d = parsed.data;

  const supabase = await createClient();
  // Never the original file name: a random name inside the user's own folder.
  const path = `${user.id}/${randomUUID()}.${check.extension}`;
  const upload = await supabase.storage.from(BUCKET).upload(path, document, {
    contentType: check.contentType,
    upsert: false,
  });
  if (upload.error) {
    console.error('[supplier-application] upload failed');
    return errorState(values, {
      message: 'We could not upload your document. Please try again.',
      fieldErrors: { document: 'Please choose the file again' },
    });
  }

  const { error } = await supabase.rpc('submit_supplier_application', {
    p_company: d.company,
    p_contact: d.contact,
    p_phone: d.phone,
    p_address: d.address,
    p_country: d.country,
    p_brn: d.brn,
    p_products: d.products,
    p_document_path: path,
  });
  if (error) {
    // The application was not created: remove the uploaded file (best effort).
    await supabase.storage.from(BUCKET).remove([path]).catch(() => undefined);
    console.error(`[supplier-application] submit failed: ${error.code ?? 'unknown'}`);
    const outcome = mapApplicationError(error);
    if (outcome.kind === 'login') redirect(loginHref(PAGE));
    if (outcome.kind === 'verify') redirect(verifyHref(user.email ?? '', { unconfirmed: true, next: PAGE }));
    return errorState(values, {
      message: outcome.message,
      fieldErrors: outcome.field ? { [outcome.field]: outcome.message } : undefined,
    });
  }

  redirect(`${PAGE}?submitted=1`);
}
