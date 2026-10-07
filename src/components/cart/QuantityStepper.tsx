'use client';

import { Minus, Plus } from 'lucide-react';

interface QuantityStepperProps {
  value: number;
  max: number;
  onChange: (qty: number) => void;
  label: string;
  id?: string;
  disabled?: boolean;
}

/** Accessible - / number / + control. The number input accepts typing and arrow keys. */
export function QuantityStepper({ value, max, onChange, label, id, disabled = false }: QuantityStepperProps) {
  const safeMax = Math.max(1, max);
  const set = (n: number) => onChange(Math.min(Math.max(Number.isFinite(n) ? Math.trunc(n) : 1, 1), safeMax));
  const btn =
    'flex h-10 w-10 items-center justify-center text-ink transition-colors hover:bg-page disabled:cursor-not-allowed disabled:text-ink-muted disabled:hover:bg-transparent';
  return (
    <div className="inline-flex items-center overflow-hidden rounded-control border border-line bg-card">
      <button type="button" onClick={() => set(value - 1)} disabled={disabled || value <= 1} className={btn}>
        <Minus aria-hidden="true" className="h-4 w-4" />
        <span className="sr-only">Decrease {label}</span>
      </button>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={1}
        max={safeMax}
        value={value}
        disabled={disabled}
        aria-label={label}
        onChange={(e) => set(Number(e.target.value))}
        className="h-10 w-12 border-x border-line text-center text-sm font-semibold [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      <button type="button" onClick={() => set(value + 1)} disabled={disabled || value >= safeMax} className={btn}>
        <Plus aria-hidden="true" className="h-4 w-4" />
        <span className="sr-only">Increase {label}</span>
      </button>
    </div>
  );
}
