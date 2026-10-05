'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { mapProfileUpdateError, mapRegisterCustomerError } from '@/lib/auth/errors';
import { getCustomerOrNull, requireCustomer, requireUser } from '@/lib/auth/session';
import {
  PROFILE_CREATE_FIELDS,
  PROFILE_UPDATE_FIELDS,
  fieldErrorsFrom,
  profileCreateSchema,
  profileUpdateSchema,
  readForm,
} from '@/lib/auth/validation';
import { errorState, successState, type FormState } from '@/lib/forms';
import { createClient } from '@/lib/supabase/server';

interface RegisterCustomerRow {
  customer_id: number;
  claimed: boolean;
}

/**
 * Creates (or claims) the customer profile through the register_customer RPC.
 * No email is sent: the database uses the verified login email.
 */
export async function createProfileAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser('/account/profile/complete');
  if (await getCustomerOrNull()) redirect('/account/profile');

  const raw = readForm(formData, PROFILE_CREATE_FIELDS);
  const parsed = profileCreateSchema.safeParse(raw);
  if (!parsed.success) return errorState(raw, { fieldErrors: fieldErrorsFrom(parsed.error) });
  const d = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('register_customer', {
    p_first_name: d.firstName,
    p_last_name: d.lastName,
    p_phone: d.phone,
    p_street: d.street,
    p_town: d.town,
    p_nic: d.nic,
    p_home_number: d.homeNumber,
    p_post_code: d.postCode,
  });
  if (error) {
    const mapped = mapRegisterCustomerError(error);
    if (mapped.redirect === 'profile') redirect('/account/profile');
    if (mapped.redirect === 'login') redirect('/login?next=%2Faccount%2Fprofile%2Fcomplete');
    return errorState(raw, mapped);
  }

  const row = (Array.isArray(data) ? data[0] : data) as RegisterCustomerRow | null;
  revalidatePath('/', 'layout');
  redirect(`/account?notice=${row?.claimed ? 'profile-linked' : 'profile-created'}`);
}

/** Updates contact fields on the customer's own row (RLS + trigger enforce the rest). */
export async function updateProfileAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { customer } = await requireCustomer('/account/profile');
  const raw = readForm(formData, PROFILE_UPDATE_FIELDS);
  const parsed = profileUpdateSchema.safeParse(raw);
  if (!parsed.success) return errorState(raw, { fieldErrors: fieldErrorsFrom(parsed.error) });
  const d = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('Customer')
    .update({
      FirstName: d.firstName,
      LastName: d.lastName,
      PhoneNumber: d.phone,
      Street: d.street,
      Town: d.town,
      HomeNumber: d.homeNumber,
      PostCode: d.postCode,
    })
    .eq('CustomerID', customer.id)
    .select('CustomerID');
  if (error) return errorState(raw, mapProfileUpdateError(error));
  if (!data || data.length === 0) {
    return errorState(raw, { message: 'We could not find your profile. Please sign in again.' });
  }

  revalidatePath('/', 'layout');
  return successState('Your profile has been saved.', raw);
}
