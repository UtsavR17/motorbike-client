import 'server-only';

import { toNumber } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';
import type { Service, ServiceRow } from '@/types/catalog';
import { fail } from './shared';

export async function listServices(limit?: number): Promise<Service[]> {
  const supabase = await createClient();
  let req = supabase
    .from('catalog_services')
    .select('service_id,name,description,cost')
    .order('cost', { ascending: true })
    .order('name', { ascending: true });
  if (limit) req = req.limit(limit);
  const { data, error } = await req;
  if (error) fail('services', error);
  return ((data ?? []) as ServiceRow[]).map((row) => ({ ...row, cost: toNumber(row.cost) ?? 0 }));
}
