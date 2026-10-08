import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Building2, ClipboardCheck, FileText, LogIn, PackageSearch, UserRoundPlus } from 'lucide-react';
import { PageIntro } from '@/components/ui/PageIntro';
import { SHOP_NAME, SUPPLIER_APPLICATION_MAX_FILE_MB } from '@/config/shop';
import { loginHref } from '@/lib/auth/config';
import { getCurrentUser } from '@/lib/auth/session';

export const metadata: Metadata = {
  title: 'Become a supplier',
  description: `Supply motorcycles and spare parts to ${SHOP_NAME}. Apply online with your company details and BRN.`,
};

const APPLICATION_PAGE = '/account/supplier-application';

const STEPS = [
  {
    Icon: UserRoundPlus,
    title: 'Create or sign in to an account',
    text: 'Use a customer account with a verified email. It becomes your supplier login.',
  },
  {
    Icon: FileText,
    title: 'Submit your company details',
    text: 'Tell us about your business and upload your BRN document.',
  },
  {
    Icon: ClipboardCheck,
    title: 'The dealership reviews it',
    text: 'We check your details and let you know the result on your account page.',
  },
  {
    Icon: LogIn,
    title: 'Sign in to the Supplier Portal',
    text: 'Approved suppliers use the same email and password to list their products and receive purchase orders.',
  },
];

const NEEDED = [
  'Company name and a contact person',
  'Phone number, business address and country',
  'BRN (Business Registration Number)',
  `Your BRN document as a PDF, JPG or PNG, up to ${SUPPLIER_APPLICATION_MAX_FILE_MB} MB`,
  'A short description of what you would supply',
];

export default async function BecomeASupplierPage() {
  const user = await getCurrentUser();
  const start = user ? APPLICATION_PAGE : loginHref(APPLICATION_PAGE);

  return (
    <>
      <PageIntro
        title="Become a supplier"
        description={`Supply motorcycles or genuine spare parts to ${SHOP_NAME}. We work with local and overseas suppliers who can deliver reliably.`}
        crumbs={[{ href: '/', label: 'Home' }, { label: 'Become a supplier' }]}
      >
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Link href={start} className="btn-primary h-11">
            {user ? 'Apply now' : 'Sign in to apply'}
            <ArrowRight aria-hidden="true" className="h-4 w-4" />
          </Link>
          {!user && (
            <p className="text-sm text-ink-muted">
              New here?{' '}
              <Link href={`/register?next=${encodeURIComponent(APPLICATION_PAGE)}`} className="link">
                Create an account
              </Link>
            </p>
          )}
        </div>
      </PageIntro>

      <div className="container-page space-y-10 py-8 lg:py-12">
        <section aria-labelledby="what-heading" className="grid gap-4 md:grid-cols-2">
          <div className="card flex gap-4 p-5">
            <Building2 aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0 text-accent-strong" />
            <div>
              <h2 id="what-heading" className="font-semibold">What suppliers do with us</h2>
              <p className="mt-1 text-sm text-ink-muted">
                Suppliers list the motorcycle models and spare parts they can provide. The dealership sends purchase
                orders through the Supplier Portal, where you accept them and record shipments.
              </p>
            </div>
          </div>
          <div className="card flex gap-4 p-5">
            <PackageSearch aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0 text-accent-strong" />
            <div>
              <h2 className="font-semibold">Why work with us</h2>
              <p className="mt-1 text-sm text-ink-muted">
                Steady orders for a busy workshop and showroom, clear purchase orders and one place to track them.
              </p>
            </div>
          </div>
        </section>

        <section aria-labelledby="steps-heading">
          <h2 id="steps-heading" className="text-xl font-bold">How it works</h2>
          <ol className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map(({ Icon, title, text }, i) => (
              <li key={title} className="card p-5">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink text-sm font-bold text-white">
                    {i + 1}
                  </span>
                  <Icon aria-hidden="true" className="h-5 w-5 text-accent-strong" />
                </div>
                <h3 className="mt-3 font-semibold">{title}</h3>
                <p className="mt-1 text-sm text-ink-muted">{text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="needed-heading" className="card p-5 sm:p-6">
          <h2 id="needed-heading" className="text-xl font-bold">What you need</h2>
          <ul className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            {NEEDED.map((item) => (
              <li key={item} className="flex gap-2">
                <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                {item}
              </li>
            ))}
          </ul>
          <Link href={start} className="btn-primary mt-5 h-11">
            {user ? 'Apply now' : 'Sign in to apply'}
            <ArrowRight aria-hidden="true" className="h-4 w-4" />
          </Link>
        </section>
      </div>
    </>
  );
}
