import 'server-only';

import { getModels } from '@/lib/catalog/lookups';
import { getCurrentUser, getCustomerOrNull } from '@/lib/auth/session';
import { modelLabel } from '@/lib/labels';
import { createClient } from '@/lib/supabase/server';

export interface GarageBike {
  id: number;
  registration: string;
  year: number | null;
  vin: string;
  modelId: number;
  brand: string | null;
  model: string | null;
}

interface BikeRow {
  BikeID: number;
  RegistrationNumber: string;
  Year: number | null;
  VIN: string;
  Model_Model_No: number;
}

const BIKE_COLUMNS = 'BikeID,RegistrationNumber,Year,VIN,Model_Model_No';

async function withModelNames(rows: BikeRow[]): Promise<GarageBike[]> {
  const models = await getModels();
  const byId = new Map(models.map((m) => [m.model_id, m]));
  return rows.map((r) => {
    const m = byId.get(r.Model_Model_No);
    return {
      id: r.BikeID,
      registration: r.RegistrationNumber,
      year: r.Year,
      vin: r.VIN,
      modelId: r.Model_Model_No,
      brand: m?.brand ?? null,
      model: m?.model ?? null,
    };
  });
}

/** The customer's own bikes (RLS also limits rows to this customer). */
export async function listMyBikes(customerId: number): Promise<GarageBike[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('Customer_bike')
    .select(BIKE_COLUMNS)
    .eq('Customer_CustomerID', customerId)
    .order('BikeID', { ascending: true });
  if (error) {
    console.error(`[garage] list failed: ${error.code ?? 'unknown'}`);
    throw new Error('Could not load your garage.');
  }
  return withModelNames((data ?? []) as BikeRow[]);
}

export async function getMyBike(customerId: number, bikeId: number): Promise<GarageBike | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('Customer_bike')
    .select(BIKE_COLUMNS)
    .eq('Customer_CustomerID', customerId)
    .eq('BikeID', bikeId)
    .maybeSingle();
  if (error) {
    console.error(`[garage] read failed: ${error.code ?? 'unknown'}`);
    throw new Error('Could not load this bike.');
  }
  if (!data) return null;
  return (await withModelNames([data as BikeRow]))[0];
}

export function bikeName(bike: Pick<GarageBike, 'brand' | 'model'>): string {
  if (bike.brand && bike.model) return modelLabel(bike.brand, bike.model);
  return bike.model ?? 'Unknown model';
}

export interface GarageChip {
  modelId: number;
  year: number | null;
  label: string;
}

/** "My garage" shortcuts for the parts page. Empty for guests and users without bikes. */
export async function getGarageChips(): Promise<GarageChip[]> {
  if (!(await getCurrentUser())) return [];
  const customer = await getCustomerOrNull();
  if (!customer) return [];
  const bikes = await listMyBikes(customer.id);
  const seen = new Set<string>();
  const chips: GarageChip[] = [];
  for (const b of bikes) {
    const key = `${b.modelId}:${b.year ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    chips.push({ modelId: b.modelId, year: b.year, label: `${bikeName(b)}${b.year ? ` (${b.year})` : ''}` });
  }
  return chips;
}
