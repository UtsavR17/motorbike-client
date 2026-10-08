import type { Metadata } from 'next';
import Link from 'next/link';
import { CalendarCheck, Wrench } from 'lucide-react';
import { ServiceCard } from '@/components/catalog/ServiceCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageIntro } from '@/components/ui/PageIntro';
import { listServices } from '@/lib/catalog/services';

export const metadata: Metadata = {
  title: 'Workshop services',
  description: 'Motorcycle servicing and repairs at our workshop, with clear fixed prices.',
};

export default async function ServicesPage() {
  const services = await listServices();

  return (
    <>
      <PageIntro
        title="Workshop services"
        description="Servicing and repairs by our own mechanics, with clear prices for each service."
        crumbs={[{ href: '/', label: 'Home' }, { label: 'Services' }]}
      >
        {services.length > 0 && (
          <Link href="/book" className="btn-primary mt-4 h-11">
            <CalendarCheck aria-hidden="true" className="h-4 w-4" />
            Book an appointment
          </Link>
        )}
      </PageIntro>
      <div className="container-page py-6 lg:py-8">
        {services.length === 0 ? (
          <EmptyState icon={Wrench} title="Services will be listed soon">
            Call in at the workshop for a quote in the meantime.
          </EmptyState>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {services.map((service) => (
              <li key={service.service_id}>
                <ServiceCard service={service}>
                  <div className="mt-4">
                    <Link href={`/book?service=${service.service_id}`} className="btn-primary w-full">
                      <CalendarCheck aria-hidden="true" className="h-4 w-4" />
                      Book appointment<span className="sr-only"> for {service.name}</span>
                    </Link>
                  </div>
                </ServiceCard>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
