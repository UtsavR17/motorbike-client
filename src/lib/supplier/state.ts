// Which view the supplier application page shows, from the user's applications. Pure, unit tested.

import { SUPPLIER_APPLICATION_MAX_ATTEMPTS } from '@/config/shop';

export interface SupplierApplication {
  id: number;
  company: string;
  country: string | null;
  brn: string | null;
  status: string;
  rejectionReason: string | null;
  submittedDate: string | null;
  reviewedDate: string | null;
}

export interface FormPrefill {
  company: string;
  country: string;
  brn: string;
}

export type ApplicationView =
  | { kind: 'form'; rejected: SupplierApplication | null; prefill: FormPrefill | null; attemptsLeft: number }
  | { kind: 'pending'; application: SupplierApplication }
  | { kind: 'approved'; application: SupplierApplication }
  | { kind: 'exhausted'; application: SupplierApplication };

/** `applications` newest first. */
export function applicationView(applications: SupplierApplication[]): ApplicationView {
  const latest = applications[0];
  const attemptsLeft = Math.max(0, SUPPLIER_APPLICATION_MAX_ATTEMPTS - applications.length);
  if (!latest) return { kind: 'form', rejected: null, prefill: null, attemptsLeft };
  if (latest.status === 'Pending') return { kind: 'pending', application: latest };
  if (latest.status === 'Approved') return { kind: 'approved', application: latest };
  if (attemptsLeft === 0) return { kind: 'exhausted', application: latest };
  return {
    kind: 'form',
    rejected: latest,
    prefill: { company: latest.company ?? '', country: latest.country ?? '', brn: latest.brn ?? '' },
    attemptsLeft,
  };
}
