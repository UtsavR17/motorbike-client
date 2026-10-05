import { SubmitButton } from '@/components/forms/SubmitButton';
import { googleSignInAction } from '@/lib/actions/auth';
import { GOOGLE_AUTH_ENABLED } from '@/lib/auth/config';

/** "Continue with Google" (PKCE). Renders nothing unless NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=true. */
export function GoogleButton({ next }: { next?: string }) {
  if (!GOOGLE_AUTH_ENABLED) return null;
  return (
    <>
      <div className="my-5 flex items-center gap-3 text-xs font-medium uppercase tracking-wide text-ink-muted">
        <span className="h-px flex-1 bg-line" />
        or
        <span className="h-px flex-1 bg-line" />
      </div>
      <form action={googleSignInAction}>
        {next && <input type="hidden" name="next" value={next} />}
        <SubmitButton variant="outline" pendingLabel="Opening Google..." className="w-full">
          Continue with Google
        </SubmitButton>
      </form>
    </>
  );
}
