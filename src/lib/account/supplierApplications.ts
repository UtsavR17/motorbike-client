import 'server-only';

import type { SupplierApplication } from '@/lib/supplier/state';
import { createClient } from '@/lib/supabase/server';

// Applicants read their own applications only through the my_supplier_applications view.
// Explicit columns; the view exposes no storage path, email or audit data.
const COLUMNS = 'application_id,company_name,country,brn,status,rejection_reason,submitted_date,reviewed_date';

interface Row {
  application_id: number;
  company_name: string;
  country: string | null;
  brn: string | null;
  status: string;
  rejection_reason: string | null;
  submitted_date: string | null;
  reviewed_date: string | null;
}

/** The signed-in user's applications, newest first. */
export async function listMySupplierApplications(): Promise<SupplierApplication[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('my_supplier_applications')
    .select(COLUMNS)
    .order('submitted_date', { ascending: false })
    .order('application_id', { ascending: false });
  if (error) {
    console.error(`[supplier-application] list failed: ${error.code ?? 'unknown'}`);
    throw new Error('Could not load your supplier applications.');
  }
  return ((data ?? []) as Row[]).map((r) => ({
    id: r.application_id,
    company: r.company_name,
    country: r.country,
    brn: r.brn,
    status: r.status,
    rejectionReason: r.rejection_reason,
    submittedDate: r.submitted_date,
    reviewedDate: r.reviewed_date,
  }));
}
