import { Wrench } from 'lucide-react';
import type { ReactNode } from 'react';
import { cleanText, formatMoney } from '@/lib/format';
import type { Service } from '@/types/catalog';

export function ServiceCard({ service, children }: { service: Service; children?: ReactNode }) {
  return (
    <article className="card flex h-full flex-col p-5">
      <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-control bg-accent-soft text-accent-strong">
        <Wrench aria-hidden="true" className="h-5 w-5" />
      </span>
      <h3 className="text-lg font-semibold">{cleanText(service.name)}</h3>
      {service.description && (
        <p className="mt-2 text-sm leading-relaxed text-ink-muted">{cleanText(service.description)}</p>
      )}
      <p className="mt-auto pt-4 text-xl font-bold">{formatMoney(service.cost)}</p>
      {children}
    </article>
  );
}
