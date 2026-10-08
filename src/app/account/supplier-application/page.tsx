import type { Metadata } from 'next';
import { CheckCircle2, Clock, ExternalLink, Info, XCircle } from 'lucide-react';
import { SupplierApplicationForm } from '@/components/supplier/SupplierApplicationForm';
import { SUPPLIER_APPLICATION_MAX_ATTEMPTS, SUPPLIER_PORTAL_URL } from '@/config/shop';
import { listMySupplierApplications } from '@/lib/account/supplierApplications';
import { requireUser } from '@/lib/auth/session';
import { formatDate } from '@/lib/format';
import type { SearchParams } from '@/lib/params';
import { applicationView, type SupplierApplication } from '@/lib/supplier/state';

export const metadata: Metadata = {
  title: 'Supplier application',
  robots: { index: false, follow: false },
};

const STATUS_STYLES: Record<string, string> = {
  Pending: 'bg-warn-soft text-warn',
  Approved: 'bg-ok-soft text-ok',
  Rejected: 'bg-bad-soft text-bad',
};
const STATUS_LABELS: Record<string, string> = { Pending: 'Under review', Approved: 'Approved', Rejected: 'Not approved' };

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLES[status] ?? 'bg-page text-ink'}`}>
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

function Detail({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="text-ink-muted">{label}</dt>
      <dd className="font-semibold break-words">{value || '-'}</dd>
    </div>
  );
}

export default async function SupplierApplicationPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  // A signed-in user is enough: a customer profile is not required to apply.
  const user = await requireUser('/account/supplier-application');
  const applications = await listMySupplierApplications();
  const view = applicationView(applications);
  const submitted = (await searchParams).submitted === '1';
  const history = applications.slice(view.kind === 'form' && !view.rejected ? 0 : 1);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Supplier application</h1>
        <p className="mt-1 max-w-2xl text-ink-muted">
          Apply to supply motorcycles or spare parts to the dealership. Approved suppliers sign in to the Supplier
          Portal with the same email and password.
        </p>
      </div>

      {submitted && view.kind === 'pending' && (
        <div role="status" className="flex gap-3 rounded-control bg-ok-soft px-4 py-3 text-sm text-ok">
          <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
          <span>
            <strong>Application submitted.</strong> Thank you: the dealership will review it soon.
          </span>
        </div>
      )}

      {view.kind === 'pending' && (
        <section aria-labelledby="pending-heading" className="card p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-3">
            <Clock aria-hidden="true" className="h-6 w-6 text-warn" />
            <h2 id="pending-heading" className="text-lg font-semibold">Under review</h2>
            <StatusBadge status="Pending" />
          </div>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
            <Detail label="Company" value={view.application.company} />
            <Detail label="BRN" value={view.application.brn} />
            <Detail label="Submitted" value={formatDate(view.application.submittedDate)} />
          </dl>
          <p className="mt-4 text-sm text-ink-muted">
            The dealership will review your application. You will see the result here.
          </p>
        </section>
      )}

      {view.kind === 'approved' && (
        <section aria-labelledby="approved-heading" className="rounded-card border-2 border-ok bg-ok-soft p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-3">
            <CheckCircle2 aria-hidden="true" className="h-6 w-6 text-ok" />
            <h2 id="approved-heading" className="text-lg font-semibold text-ink">You are now a supplier</h2>
          </div>
          <p className="mt-2 text-sm text-ink">
            {view.application.company} was approved
            {view.application.reviewedDate ? ` on ${formatDate(view.application.reviewedDate)}` : ''}.
          </p>
          <a href={SUPPLIER_PORTAL_URL} className="btn-primary mt-4 h-11">
            Go to the Supplier Portal
            <ExternalLink aria-hidden="true" className="h-4 w-4" />
          </a>
          <p className="mt-3 text-sm text-ink-muted">
            Sign in with the same email and password you use here. If you signed up with Google, use Forgot password to
            set a password first.
          </p>
        </section>
      )}

      {view.kind === 'exhausted' && (
        <section aria-labelledby="exhausted-heading" className="card p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-3">
            <XCircle aria-hidden="true" className="h-6 w-6 text-bad" />
            <h2 id="exhausted-heading" className="text-lg font-semibold">No more online applications</h2>
          </div>
          {view.application.rejectionReason && (
            <p className="mt-2 text-sm">
              Your latest application was not approved: {view.application.rejectionReason}
            </p>
          )}
          <p className="mt-2 text-sm text-ink-muted">
            You have used all {SUPPLIER_APPLICATION_MAX_ATTEMPTS} online applications, so no more can be submitted here.
            Please contact the dealership to discuss becoming a supplier.
          </p>
        </section>
      )}

      {view.kind === 'form' && (
        <section aria-labelledby="form-heading" className="card space-y-5 p-5 sm:p-6">
          {view.rejected && (
            <div role="status" className="flex gap-3 rounded-control bg-bad-soft px-4 py-3 text-sm text-bad">
              <XCircle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
              <span>
                Your previous application was not approved
                {view.rejected.rejectionReason ? `: ${view.rejected.rejectionReason}` : '.'}
              </span>
            </div>
          )}
          <div>
            <h2 id="form-heading" className="text-lg font-semibold">
              {view.rejected ? 'Apply again' : 'Apply to become a supplier'}
            </h2>
            <p className="mt-1 flex gap-2 text-sm text-ink-muted">
              <Info aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-accent-strong" />
              <span>
                You can submit up to {SUPPLIER_APPLICATION_MAX_ATTEMPTS} applications online
                {view.rejected ? ` (${view.attemptsLeft} left)` : ''}. All fields are required.
              </span>
            </p>
          </div>
          <SupplierApplicationForm email={user.email ?? ''} prefill={view.prefill} />
        </section>
      )}

      {history.length > 0 && (
        <section aria-labelledby="history-heading" className="space-y-3">
          <h2 id="history-heading" className="text-lg font-semibold">Earlier applications</h2>
          <ul className="space-y-3">
            {history.map((a: SupplierApplication) => (
              <li key={a.id} className="card p-4 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold">{a.company}</p>
                  <StatusBadge status={a.status} />
                </div>
                <p className="mt-1 text-ink-muted">
                  Submitted {formatDate(a.submittedDate) ?? '-'}
                  {a.reviewedDate ? `, reviewed ${formatDate(a.reviewedDate)}` : ''}
                </p>
                {a.rejectionReason && <p className="mt-1">Reason: {a.rejectionReason}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
