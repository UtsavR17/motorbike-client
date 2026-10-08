'use client';

import { CalendarCheck, Info, RefreshCw } from 'lucide-react';
import { useActionState, useRef, useState, useTransition } from 'react';
import { FormMessage } from '@/components/forms/FormMessage';
import { useFormFeedback } from '@/components/forms/useFormFeedback';
import { APPOINTMENT_MAX_SERVICES, APPOINTMENT_TYPES } from '@/config/shop';
import { bookAppointmentAction, getSlotsAction, type SlotsResult } from '@/lib/actions/appointments';
import { slotLabel } from '@/lib/appointments/time';
import { cleanText, formatDate, formatMoney } from '@/lib/format';
import { initialFormState, type FormState } from '@/lib/forms';

export interface BookingBike {
  id: number;
  name: string;
  registration: string;
  year: number | null;
}

export interface BookingService {
  id: number;
  name: string;
  description: string | null;
  cost: number;
}

interface BookingFormProps {
  bikes: BookingBike[];
  services: BookingService[];
  initialBikeId: number | null;
  initialServiceIds: number[];
  minDate: string;
  maxDate: string;
}

const fieldError = (msg: string | undefined, id: string) =>
  msg ? (
    <p id={id} className="mt-2 text-sm font-medium text-bad">
      {msg}
    </p>
  ) : null;

/** Booking form: motorcycle, needs, date and time, review. Only ids and choices are sent. */
export function BookingForm({ bikes, services, initialBikeId, initialServiceIds, minDate, maxDate }: BookingFormProps) {
  const [bikeId, setBikeId] = useState(initialBikeId ? String(initialBikeId) : bikes.length === 1 ? String(bikes[0].id) : '');
  const [type, setType] = useState<string>('Service');
  const [serviceIds, setServiceIds] = useState<number[]>(initialServiceIds);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [slots, setSlots] = useState<SlotsResult | null>(null);
  const [loadingSlots, startSlots] = useTransition();
  const [, startSubmit] = useTransition();
  const latestDate = useRef('');

  async function refreshSlots(d: string): Promise<SlotsResult> {
    latestDate.current = d;
    const result = await getSlotsAction(d);
    if (latestDate.current === d) {
      setSlots(result);
      // Keep the chosen time only while it is still bookable.
      setTime((t) => (result.status === 'ok' && result.slots.some((s) => s.time === t && s.state === 'available') ? t : ''));
    }
    return result;
  }

  const [state, action, submitting] = useActionState(async (prev: FormState, formData: FormData) => {
    const result = await bookAppointmentAction(prev, formData);
    const d = formData.get('date');
    // After an error the slots may have changed (for example a slot was just taken).
    if (result.status === 'error' && typeof d === 'string' && d) await refreshSlots(d);
    return result;
  }, initialFormState);
  const { formRef, messageRef } = useFormFeedback(state);
  const e = state.fieldErrors ?? {};

  function syncUrl(nextBike: string, nextServices: number[]) {
    const p = new URLSearchParams();
    if (nextBike) p.set('bike', nextBike);
    nextServices.forEach((id) => p.append('service', String(id)));
    const query = p.toString();
    const path = window.location.pathname;
    window.history.replaceState(null, '', query ? `${path}?${query}` : path);
  }

  function chooseBike(id: string) {
    setBikeId(id);
    syncUrl(id, serviceIds);
  }

  function toggleService(id: number, checked: boolean) {
    const next = checked ? [...serviceIds, id] : serviceIds.filter((s) => s !== id);
    setServiceIds(next);
    syncUrl(bikeId, next);
  }

  function chooseDate(d: string) {
    setDate(d);
    setTime('');
    if (!d) {
      setSlots(null);
      return;
    }
    startSlots(async () => {
      await refreshSlots(d);
    });
  }

  const selectedServices = services.filter((s) => serviceIds.includes(s.id));
  const estimate = selectedServices.reduce((sum, s) => sum + s.cost, 0);
  const bike = bikes.find((b) => String(b.id) === bikeId);
  const atMax = serviceIds.length >= APPOINTMENT_MAX_SERVICES;

  return (
    <form
      ref={formRef}
      // onSubmit (not action=) so React does not reset the form: selections stay after an error.
      onSubmit={(ev) => {
        ev.preventDefault();
        const formData = new FormData(ev.currentTarget);
        startSubmit(() => action(formData));
      }}
      noValidate
      className="grid gap-6 lg:grid-cols-[1fr_360px] lg:items-start">
      <div className="space-y-6">
        <FormMessage state={state} ref={messageRef} />

        {/* 1. Motorcycle */}
        <fieldset className="card space-y-3 p-5" aria-describedby={e.bikeId ? 'bike-error' : undefined}>
          <legend className="sr-only">1. Motorcycle</legend>
          <h2 className="text-lg font-semibold" aria-hidden="true">1. Motorcycle</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {bikes.map((b) => (
              <label
                key={b.id}
                className={`flex cursor-pointer gap-3 rounded-control border-2 p-4 transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-accent ${
                  bikeId === String(b.id) ? 'border-accent bg-accent-soft' : 'border-line hover:border-ink'
                }`}
              >
                <input
                  type="radio"
                  name="bikeId"
                  value={b.id}
                  checked={bikeId === String(b.id)}
                  onChange={() => chooseBike(String(b.id))}
                  className="mt-1 h-4 w-4 accent-accent"
                />
                <span>
                  <span className="block font-semibold">{b.name}</span>
                  <span className="block text-sm text-ink-muted">
                    {b.registration}
                    {b.year ? `, ${b.year}` : ''}
                  </span>
                </span>
              </label>
            ))}
          </div>
          {fieldError(e.bikeId, 'bike-error')}
        </fieldset>

        {/* 2. What do you need */}
        <fieldset className="card space-y-4 p-5">
          <legend className="sr-only">2. What do you need</legend>
          <h2 className="text-lg font-semibold" aria-hidden="true">2. What do you need</h2>
          <div className="max-w-xs">
            <label htmlFor="appointment-type" className="field-label">
              Appointment type
            </label>
            <select
              id="appointment-type"
              name="type"
              value={type}
              onChange={(ev) => setType(ev.target.value)}
              aria-invalid={e.type ? true : undefined}
              aria-describedby={e.type ? 'type-error' : undefined}
              className="field h-11 w-full"
            >
              {APPOINTMENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            {fieldError(e.type, 'type-error')}
          </div>

          <fieldset aria-describedby={`services-hint${e.serviceIds ? ' services-error' : ''}`}>
            <legend className="text-sm font-medium">Services</legend>
            <p id="services-hint" className="text-sm text-ink-muted">
              Choose 1 to {APPOINTMENT_MAX_SERVICES} services.
            </p>
            <ul className="mt-3 grid gap-3 sm:grid-cols-2">
              {services.map((s) => {
                const checked = serviceIds.includes(s.id);
                return (
                  <li key={s.id}>
                    <label
                      className={`flex h-full cursor-pointer gap-3 rounded-control border-2 p-4 transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-accent has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60 ${
                        checked ? 'border-accent bg-accent-soft' : 'border-line hover:border-ink'
                      }`}
                    >
                      <input
                        type="checkbox"
                        name="serviceIds"
                        value={s.id}
                        checked={checked}
                        disabled={!checked && atMax}
                        onChange={(ev) => toggleService(s.id, ev.target.checked)}
                        aria-invalid={e.serviceIds ? true : undefined}
                        className="mt-1 h-4 w-4 shrink-0 accent-accent"
                      />
                      <span className="min-w-0">
                        <span className="flex flex-wrap justify-between gap-x-3">
                          <span className="font-semibold">{cleanText(s.name)}</span>
                          <span className="font-semibold">{formatMoney(s.cost)}</span>
                        </span>
                        {s.description && (
                          <span className="mt-1 block text-sm text-ink-muted">{cleanText(s.description)}</span>
                        )}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
            {fieldError(e.serviceIds, 'services-error')}
          </fieldset>

          <div className="rounded-control bg-page px-4 py-3 text-sm">
            <p aria-live="polite" className="font-semibold">
              Estimated service cost: {formatMoney(estimate)}
            </p>
            <p className="mt-1 text-ink-muted">
              Parts, if needed, are added by the workshop and charged at the dealership.
            </p>
          </div>
        </fieldset>

        {/* 3. Date and time */}
        <fieldset className="card space-y-4 p-5">
          <legend className="sr-only">3. Date and time</legend>
          <h2 className="text-lg font-semibold" aria-hidden="true">3. Date and time</h2>
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-full sm:w-56">
              <label htmlFor="appointment-date" className="field-label">
                Date
              </label>
              <input
                id="appointment-date"
                type="date"
                name="date"
                autoComplete="off"
                min={minDate}
                max={maxDate}
                value={date}
                onChange={(ev) => chooseDate(ev.target.value)}
                aria-invalid={e.date ? true : undefined}
                aria-describedby={`date-hint${e.date ? ' date-error' : ''}`}
                className="field h-11"
              />
            </div>
            {date && (
              <button
                type="button"
                onClick={() => chooseDate(date)}
                disabled={loadingSlots}
                className="btn-outline h-11"
              >
                <RefreshCw aria-hidden="true" className="h-4 w-4" />
                Refresh times
              </button>
            )}
          </div>
          <p id="date-hint" className="text-sm text-ink-muted">
            Bookable from {formatDate(minDate)} to {formatDate(maxDate)}.
          </p>
          {fieldError(e.date, 'date-error')}

          <fieldset aria-describedby={`time-status${e.time ? ' time-error' : ''}`} aria-busy={loadingSlots}>
            <legend className="text-sm font-medium">Time</legend>
            <div id="time-status" aria-live="polite" className="mt-1 text-sm text-ink-muted">
              {loadingSlots
                ? 'Loading the available times...'
                : !slots
                  ? 'Choose a date to see the available times.'
                  : slots.status === 'closed'
                    ? 'The workshop is closed on Sundays. Please choose another day.'
                    : slots.status === 'error'
                      ? slots.message
                      : slots.slots.length === 0
                        ? 'No times can be booked on this date. Please choose another day.'
                        : slots.slots.some((s) => s.state === 'available')
                          ? 'Each appointment lasts 1 hour.'
                          : 'All times on this date are taken or too soon. Please choose another day.'}
            </div>
            {!loadingSlots && slots?.status === 'ok' && slots.slots.length > 0 && (
              <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {slots.slots.map((s) => {
                  const available = s.state === 'available';
                  const selected = time === s.time;
                  return (
                    <li key={s.time}>
                      <label
                        className={`flex min-h-14 flex-col items-center justify-center rounded-control border-2 px-2 py-2 text-center text-sm has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-accent ${
                          !available
                            ? 'cursor-not-allowed border-line bg-page text-ink-muted'
                            : selected
                              ? 'cursor-pointer border-accent bg-accent-soft font-semibold'
                              : 'cursor-pointer border-line hover:border-ink'
                        }`}
                      >
                        <input
                          type="radio"
                          name="time"
                          value={s.time}
                          checked={selected}
                          disabled={!available}
                          onChange={() => setTime(s.time)}
                          className="sr-only"
                        />
                        <span>{slotLabel(s.time)}</span>
                        {!available && (
                          <span className="text-xs font-medium">{s.state === 'full' ? 'Full' : 'Not available'}</span>
                        )}
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
            {fieldError(e.time, 'time-error')}
          </fieldset>
        </fieldset>
      </div>

      {/* 4. Review and confirm */}
      <aside aria-labelledby="review-heading" className="card space-y-4 p-5 lg:sticky lg:top-32">
        <h2 id="review-heading" className="text-lg font-semibold">4. Review and confirm</h2>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-ink-muted">Motorcycle</dt>
            <dd className="text-right font-medium">{bike ? `${bike.name} (${bike.registration})` : 'Not chosen'}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-ink-muted">Type</dt>
            <dd className="font-medium">{type}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-ink-muted">Date</dt>
            <dd className="font-medium">{date ? formatDate(date) : 'Not chosen'}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-ink-muted">Time</dt>
            <dd className="font-medium">{time ? slotLabel(time) : 'Not chosen'}</dd>
          </div>
        </dl>
        <div className="border-t border-line pt-3 text-sm">
          <p className="text-ink-muted">Services</p>
          {selectedServices.length === 0 ? (
            <p className="font-medium">None chosen</p>
          ) : (
            <ul className="mt-1 space-y-1">
              {selectedServices.map((s) => (
                <li key={s.id} className="flex justify-between gap-3">
                  <span>{cleanText(s.name)}</span>
                  <span className="shrink-0 font-medium">{formatMoney(s.cost)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex justify-between border-t border-line pt-3 text-base">
          <span className="font-semibold">Estimated cost</span>
          <span className="font-bold">{formatMoney(estimate)}</span>
        </div>
        <button type="submit" disabled={submitting} aria-disabled={submitting} className="btn-primary h-11 w-full">
          {submitting ? (
            'Booking...'
          ) : (
            <>
              <CalendarCheck aria-hidden="true" className="h-4 w-4" />
              Confirm booking
            </>
          )}
        </button>
        <p className="flex gap-2 text-xs text-ink-muted">
          <Info aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-accent-strong" />
          <span>Your booking is confirmed by the dealership. You will see the status here.</span>
        </p>
      </aside>
    </form>
  );
}
