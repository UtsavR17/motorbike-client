'use client';

import { CreditCard, Info } from 'lucide-react';
import { useActionState } from 'react';
import { FormMessage } from '@/components/forms/FormMessage';
import { SubmitButton } from '@/components/forms/SubmitButton';
import { useFormFeedback } from '@/components/forms/useFormFeedback';
import { startReservationAction } from '@/lib/actions/reservation';
import { initialFormState } from '@/lib/forms';

/** Confirmation tick and payment button. Only the bike id and the tick are sent; never a price. */
export function ReserveForm({ bikeId, depositText }: { bikeId: number; depositText: string }) {
  const [state, action] = useActionState(startReservationAction, initialFormState);
  const { formRef, messageRef } = useFormFeedback(state);
  const termsError = state.fieldErrors?.terms;

  return (
    <form ref={formRef} action={action} noValidate className="space-y-4">
      <input type="hidden" name="bikeId" value={bikeId} />
      <FormMessage state={state} ref={messageRef} />

      <div>
        <label className="flex cursor-pointer gap-3 rounded-control border-2 border-line p-3 text-sm has-[:checked]:border-accent has-[:checked]:bg-accent-soft has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-accent">
          <input
            type="checkbox"
            name="terms"
            value="yes"
            required
            aria-invalid={termsError ? true : undefined}
            aria-describedby={termsError ? 'terms-error' : undefined}
            className="mt-0.5 h-4 w-4 shrink-0 accent-accent"
          />
          <span>
            I understand the deposit reserves this motorcycle and the balance is payable at the dealership.
          </span>
        </label>
        {termsError && (
          <p id="terms-error" className="mt-1.5 text-sm font-medium text-bad">
            {termsError}
          </p>
        )}
      </div>

      <p className="flex gap-2 rounded-control bg-accent-soft px-3 py-2.5 text-xs text-ink">
        <Info aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-accent-strong" />
        <span>
          <strong>Stripe test mode:</strong> use card 4242 4242 4242 4242, any future date, any CVC. No real money is
          taken.
        </span>
      </p>

      <SubmitButton pendingLabel="Opening secure payment..." className="w-full">
        <CreditCard aria-hidden="true" className="h-4 w-4" />
        Pay deposit with card
      </SubmitButton>
      <p className="text-xs text-ink-muted">
        You will pay {depositText} on Stripe&apos;s secure page. The amount is confirmed from our records.
      </p>
    </form>
  );
}
