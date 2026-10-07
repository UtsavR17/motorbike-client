import { SubmitButton } from '@/components/forms/SubmitButton';
import { cancelOrderAction } from '@/lib/actions/checkout';

/** Cancels an order that is still awaiting payment (Server Action; checks ownership in the database). */
export function CancelOrderButton({ orderId, label = 'Cancel order' }: { orderId: number; label?: string }) {
  return (
    <form action={cancelOrderAction}>
      <input type="hidden" name="orderId" value={orderId} />
      <SubmitButton variant="outline" pendingLabel="Cancelling..." className="h-9 px-3 text-bad">
        {label}
      </SubmitButton>
    </form>
  );
}
