import { CalendarClock, Store, TriangleAlert } from 'lucide-react';
import { BIKE_DEPOSIT_PERCENT } from '@/config/shop';
import type { MyOrder } from '@/lib/account/orders';
import { balanceFor, isReservationExpired, mauritiusDateOf } from '@/lib/commerce/reservation';
import { formatDate, formatMoney } from '@/lib/format';

/** Visit-by date of a reservation, formatted ("14 Oct 2026"); null until the deposit is paid. */
export function reservedUntilText(order: MyOrder): string | null {
  return formatDate(mauritiusDateOf(order.reservedUntil));
}

/** Balance still payable at the dealership; null when the price is unknown. */
export function reservationBalance(order: MyOrder): number | null {
  if (order.bikePrice === null) return null;
  const balance = balanceFor(order.bikePrice, order.total);
  return Number.isFinite(balance) ? balance : null;
}

/** Motorcycle, price, deposit, balance and visit-by date. Never the VIN (not in my_orders). */
export function ReservationDetails({ order }: { order: MyOrder }) {
  const balance = reservationBalance(order);
  const until = reservedUntilText(order);
  const active = order.status === 'Paid';
  return (
    <section aria-labelledby="reservation-heading" className="card p-5">
      <h2 id="reservation-heading" className="font-semibold">Reserved motorcycle</h2>
      <p className="mt-1 text-lg font-bold">{order.bikeDescription ?? 'Motorcycle'}</p>
      <dl className="mt-4 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-ink-muted">Motorcycle price</dt>
          <dd className="font-semibold">{formatMoney(order.bikePrice)}</dd>
        </div>
        <div>
          <dt className="text-ink-muted">Deposit ({BIKE_DEPOSIT_PERCENT}%)</dt>
          <dd className="font-semibold">{formatMoney(order.total)}</dd>
        </div>
        <div>
          <dt className="text-ink-muted">Balance at the dealership</dt>
          <dd className="font-semibold">{balance === null ? 'Confirmed at the dealership' : formatMoney(balance)}</dd>
        </div>
        {until && (order.status === 'Paid' || order.status === 'Completed') && (
          <div>
            <dt className="text-ink-muted">Reserved until</dt>
            <dd className="font-semibold">{until}</dd>
          </div>
        )}
      </dl>
      {active && until && !isReservationExpired(order) && (
        <p className="mt-4 flex gap-2 rounded-control bg-page px-3 py-2.5 text-sm">
          <CalendarClock aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-accent-strong" />
          <span>
            Visit the dealership by <strong>{until}</strong> to pay the balance and collect your motorcycle.
          </span>
        </p>
      )}
    </section>
  );
}

/** Shown on a paid reservation whose visit-by date has passed. */
export function ReservationExpiredNotice() {
  return (
    <div role="status" className="flex gap-3 rounded-control bg-warn-soft px-4 py-3 text-sm font-medium text-warn">
      <TriangleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
      <span>This reservation has expired. Please contact the dealership.</span>
    </div>
  );
}

/** Replaces the delivery address for reservations: motorcycles are collected only. */
export function CollectFromDealership() {
  return (
    <div className="card flex gap-3 p-4 text-sm">
      <Store aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-accent-strong" />
      <div>
        <p className="font-semibold">Collect from the dealership</p>
        <p className="text-ink-muted">
          Bring your Order ID and ID card. We complete the paperwork, registration and a handover check with you.
          For cancellations, please contact the dealership.
        </p>
      </div>
    </div>
  );
}
