'use server';

import { redirect } from 'next/navigation';
import { mapBikeError } from '@/lib/auth/errors';
import { requireCustomer } from '@/lib/auth/session';
import { bikeAddSchema, bikeEditSchema, bikeIdSchema, fieldErrorsFrom, readForm } from '@/lib/auth/validation';
import { getModel } from '@/lib/catalog/lookups';
import { errorState, type FormState } from '@/lib/forms';
import { createClient } from '@/lib/supabase/server';

export async function addBikeAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { customer } = await requireCustomer('/account/garage/new');
  const raw = readForm(formData, ['brandId', 'modelId', 'registration', 'year', 'vin']);
  const parsed = bikeAddSchema.safeParse(raw);
  if (!parsed.success) return errorState(raw, { fieldErrors: fieldErrorsFrom(parsed.error) });
  const d = parsed.data;

  if (!(await getModel(d.modelId))) {
    return errorState(raw, { fieldErrors: { modelId: 'Choose a model from the list' } });
  }

  const supabase = await createClient();
  const { error } = await supabase.from('Customer_bike').insert({
    RegistrationNumber: d.registration,
    Year: d.year,
    VIN: d.vin,
    Model_Model_No: d.modelId,
    // Always the signed-in customer's own id (RLS rejects anything else).
    Customer_CustomerID: customer.id,
  });
  if (error) return errorState(raw, mapBikeError('add', error));
  redirect('/account/garage?notice=bike-added');
}

export async function updateBikeAction(bikeId: number, _prev: FormState, formData: FormData): Promise<FormState> {
  const { customer } = await requireCustomer('/account/garage');
  const raw = readForm(formData, ['registration', 'year']);
  const parsed = bikeEditSchema.safeParse(raw);
  if (!parsed.success) return errorState(raw, { fieldErrors: fieldErrorsFrom(parsed.error) });

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('Customer_bike')
    .update({ RegistrationNumber: parsed.data.registration, Year: parsed.data.year })
    .eq('BikeID', bikeId)
    .eq('Customer_CustomerID', customer.id)
    .select('BikeID');
  if (error) return errorState(raw, mapBikeError('edit', error));
  if (!data || data.length === 0) return errorState(raw, { message: 'This bike was not found in your garage.' });
  redirect('/account/garage?notice=bike-updated');
}

export async function deleteBikeAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { customer } = await requireCustomer('/account/garage');
  const parsedId = bikeIdSchema.safeParse(readForm(formData, ['bikeId']).bikeId);
  if (!parsedId.success) return errorState(undefined, { message: 'This bike was not found in your garage.' });

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('Customer_bike')
    .delete()
    .eq('BikeID', parsedId.data)
    .eq('Customer_CustomerID', customer.id)
    .select('BikeID');
  if (error) return errorState(undefined, mapBikeError('delete', error));
  if (!data || data.length === 0) return errorState(undefined, { message: 'This bike was not found in your garage.' });
  redirect('/account/garage?notice=bike-deleted');
}
