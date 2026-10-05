import 'server-only';

import { redirect } from 'next/navigation';
import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import { loginHref } from './config';

export interface CurrentUser {
  id: string;
  email: string | null;
  /** Sign-in methods linked to the account, e.g. ["email"] or ["google"]. */
  providers: string[];
  /** True when the account has an email + password identity. */
  hasPassword: boolean;
}

export interface Customer {
  id: number;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  street: string;
  town: string;
  homeNumber: string | null;
  postCode: string | null;
  nic: string;
}

// Explicit columns. AuthUserID is used only as a filter, never selected or rendered.
const CUSTOMER_COLUMNS = 'CustomerID,FirstName,LastName,PhoneNumber,Email,Street,Town,HomeNumber,PostCode,NIC';

interface CustomerRow {
  CustomerID: number;
  FirstName: string;
  LastName: string;
  PhoneNumber: string;
  Email: string;
  Street: string;
  Town: string;
  HomeNumber: string | null;
  PostCode: string | null;
  NIC: string;
}

/** The signed-in user from verified JWT claims (getClaims), or null for guests. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) return null;
  const claims = data.claims;
  const meta = claims.app_metadata ?? {};
  const providers = Array.isArray(meta.providers)
    ? meta.providers.filter((p): p is string => typeof p === 'string')
    : typeof meta.provider === 'string'
      ? [meta.provider]
      : [];
  return {
    id: claims.sub,
    email: typeof claims.email === 'string' && claims.email ? claims.email : null,
    providers,
    hasPassword: providers.includes('email'),
  };
});

/** The signed-in user's own Customer record, or null (guest, or no profile yet). */
export const getCustomerOrNull = cache(async (): Promise<Customer | null> => {
  const user = await getCurrentUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('Customer')
    .select(CUSTOMER_COLUMNS)
    .eq('AuthUserID', user.id)
    .maybeSingle();
  if (error) {
    console.error(`[account] customer lookup failed: ${error.code ?? 'unknown'}`);
    throw new Error('Could not load your profile.');
  }
  if (!data) return null;
  const row = data as CustomerRow;
  return {
    id: row.CustomerID,
    firstName: row.FirstName,
    lastName: row.LastName,
    phone: row.PhoneNumber,
    email: row.Email,
    street: row.Street,
    town: row.Town,
    homeNumber: row.HomeNumber,
    postCode: row.PostCode,
    nic: row.NIC,
  };
});

/** Redirects guests to /login (returning to `next` afterwards). */
export async function requireUser(next = '/account'): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(loginHref(next));
  return user;
}

/** Like requireUser, and also sends users without a profile to the profile form. */
export async function requireCustomer(next = '/account'): Promise<{ user: CurrentUser; customer: Customer }> {
  const user = await requireUser(next);
  const customer = await getCustomerOrNull();
  if (!customer) redirect('/account/profile/complete');
  return { user, customer };
}

/** Name for greetings: first name, else the part of the email before "@". */
export function displayName(user: CurrentUser, customer: Customer | null): string {
  if (customer?.firstName) return customer.firstName;
  if (user.email) return user.email.split('@')[0];
  return 'there';
}
