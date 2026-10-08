'use client';

import { useState } from 'react';
import { SubmitButton } from '@/components/forms/SubmitButton';
import { cancelAppointmentAction } from '@/lib/actions/appointments';

/**
 * Two-step cancel: the first click asks for confirmation, the second submits the Server Action
 * (which checks ownership, status and the 2 hour notice in the database).
 */
export function CancelAppointmentButton({
  appointmentId,
  label,
  from,
}: {
  appointmentId: number;
  label: string;
  from: 'list' | 'detail';
}) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button type="button" onClick={() => setConfirming(true)} className="btn-outline h-9 px-3 text-bad">
        Cancel appointment<span className="sr-only"> for {label}</span>
      </button>
    );
  }

  return (
    <form
      action={cancelAppointmentAction}
      role="group"
      aria-label={`Confirm cancelling the appointment for ${label}`}
      className="flex flex-wrap items-center gap-2 rounded-control bg-bad-soft px-3 py-2 text-sm text-bad"
    >
      <input type="hidden" name="appointmentId" value={appointmentId} />
      <input type="hidden" name="from" value={from} />
      <span className="font-medium">Cancel this appointment?</span>
      <SubmitButton variant="outline" pendingLabel="Cancelling..." className="h-9 px-3 text-bad">
        Yes, cancel it
      </SubmitButton>
      <button
        type="button"
        autoFocus
        onClick={() => setConfirming(false)}
        className="btn-outline h-9 px-3"
      >
        Keep it
      </button>
    </form>
  );
}
