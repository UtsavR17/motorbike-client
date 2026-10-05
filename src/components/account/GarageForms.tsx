'use client';

import Link from 'next/link';
import { Trash2 } from 'lucide-react';
import { useActionState, useMemo, useState } from 'react';
import { Field } from '@/components/forms/Field';
import { FormMessage } from '@/components/forms/FormMessage';
import { SubmitButton } from '@/components/forms/SubmitButton';
import { useFormFeedback } from '@/components/forms/useFormFeedback';
import { addBikeAction, deleteBikeAction, updateBikeAction } from '@/lib/actions/garage';
import { BIKE_MIN_YEAR } from '@/config/shop';
import { initialFormState } from '@/lib/forms';
import type { CatalogModel } from '@/types/catalog';

/* --------------------------------- Add ----------------------------------- */

export function BikeAddForm({ models, maxYear }: { models: CatalogModel[]; maxYear: number }) {
  const [state, action] = useActionState(addBikeAction, initialFormState);
  const { formRef, messageRef } = useFormFeedback(state);
  const e = state.fieldErrors ?? {};
  const [brandId, setBrandId] = useState(state.values?.brandId ?? '');
  const [modelId, setModelId] = useState(state.values?.modelId ?? '');

  const brands = useMemo(() => {
    const map = new Map<number, string>();
    models.forEach((m) => map.set(m.brand_id, m.brand));
    return [...map].sort((a, b) => a[1].localeCompare(b[1]));
  }, [models]);
  const visible = brandId ? models.filter((m) => String(m.brand_id) === brandId) : models;

  return (
    <form ref={formRef} action={action} noValidate className="space-y-4">
      <FormMessage state={state} ref={messageRef} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="field-brandId" className="field-label">Brand</label>
          <select id="field-brandId" name="brandId" value={brandId} className="field h-11"
            onChange={(ev) => { setBrandId(ev.target.value); setModelId(''); }}>
            <option value="">All brands</option>
            {brands.map(([id, name]) => (
              <option key={id} value={id}>{name}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="field-modelId" className="field-label">Model</label>
          <select id="field-modelId" name="modelId" value={modelId} required className={`field h-11 ${e.modelId ? 'border-bad' : ''}`}
            aria-invalid={e.modelId ? true : undefined} aria-describedby={e.modelId ? 'field-modelId-error' : undefined}
            onChange={(ev) => setModelId(ev.target.value)}>
            <option value="">Select your model</option>
            {visible.map((m) => (
              <option key={m.model_id} value={m.model_id}>
                {brandId ? m.model : `${m.brand}: ${m.model}`}
              </option>
            ))}
          </select>
          {e.modelId && <p id="field-modelId-error" className="mt-1 text-sm font-medium text-bad">{e.modelId}</p>}
        </div>
        <Field name="registration" label="Registration number" autoComplete="off" maxLength={8} required
          defaultValue={state.values?.registration} error={e.registration} hint="Up to 6 letters and digits." />
        <Field name="year" label="Year" type="number" inputMode="numeric" min={BIKE_MIN_YEAR} max={maxYear} required
          defaultValue={state.values?.year} error={e.year} />
        <Field name="vin" label="VIN (chassis number)" autoComplete="off" maxLength={60} required
          defaultValue={state.values?.vin} error={e.vin} hint="5 to 50 letters and digits." className="sm:col-span-2" />
      </div>
      <div className="flex flex-wrap gap-3">
        <SubmitButton pendingLabel="Adding..." variant="primary">Add bike</SubmitButton>
        <Link href="/account/garage" className="btn-outline h-11">Cancel</Link>
      </div>
    </form>
  );
}

/* --------------------------------- Edit ---------------------------------- */

export function BikeEditForm({
  bikeId,
  registration,
  year,
  maxYear,
}: {
  bikeId: number;
  registration: string;
  year: number | null;
  maxYear: number;
}) {
  const boundAction = useMemo(() => updateBikeAction.bind(null, bikeId), [bikeId]);
  const [state, action] = useActionState(boundAction, initialFormState);
  const { formRef, messageRef } = useFormFeedback(state);
  const e = state.fieldErrors ?? {};
  return (
    <form ref={formRef} action={action} noValidate className="space-y-4">
      <FormMessage state={state} ref={messageRef} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field name="registration" label="Registration number" autoComplete="off" maxLength={8} required
          defaultValue={state.values?.registration ?? registration} error={e.registration}
          hint="Up to 6 letters and digits." />
        <Field name="year" label="Year" type="number" inputMode="numeric" min={BIKE_MIN_YEAR} max={maxYear} required
          defaultValue={state.values?.year ?? (year ? String(year) : '')} error={e.year} />
      </div>
      <div className="flex flex-wrap gap-3">
        <SubmitButton pendingLabel="Saving..." variant="primary">Save changes</SubmitButton>
        <Link href="/account/garage" className="btn-outline h-11">Cancel</Link>
      </div>
    </form>
  );
}

/* -------------------------------- Delete --------------------------------- */

/** Two-step delete: the first button asks for confirmation, the second submits. */
export function DeleteBikeButton({ bikeId, name }: { bikeId: number; name: string }) {
  const [state, action] = useActionState(deleteBikeAction, initialFormState);
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <div className="space-y-2">
        <button type="button" onClick={() => setConfirming(true)}
          className="btn h-10 border border-line bg-card text-bad hover:border-bad">
          <Trash2 aria-hidden="true" className="h-4 w-4" />
          Delete
        </button>
        <FormMessage state={state} />
      </div>
    );
  }
  return (
    <form action={action} className="w-full space-y-2 rounded-control border border-bad/40 bg-bad-soft p-3">
      <input type="hidden" name="bikeId" value={bikeId} />
      <p className="text-sm font-medium text-bad">Delete {name} from your garage? This cannot be undone.</p>
      <FormMessage state={state} />
      <div className="flex flex-wrap gap-2">
        <SubmitButton pendingLabel="Deleting..." variant="dark">Yes, delete</SubmitButton>
        <button type="button" onClick={() => setConfirming(false)} className="btn-outline h-11" autoFocus>
          Cancel
        </button>
      </div>
    </form>
  );
}
