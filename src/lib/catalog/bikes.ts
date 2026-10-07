import 'server-only';

import { cache } from 'react';
import { PAGE_SIZE } from '@/config/shop';
import { toNumber } from '@/lib/format';
import type { BikeFacetOptions, BikesQuery } from '@/lib/params';
import { createClient } from '@/lib/supabase/server';
import type { Bike, BikeModel, BikeModelRow, BikeRow, Brand, Paged } from '@/types/catalog';
import { containsPattern, fail, isRangeError, pageCount, pageRange } from './shared';

// Explicit column lists: the views expose no VIN, but never select "*" either.
const MODEL_COLUMNS =
  'model_id,brand_id,model,brand,image_url,units_available,min_price,max_price,min_year,max_year,min_engine_cc,max_engine_cc,fuel_types,transmissions,colors';

const BIKE_COLUMNS =
  'bike_id,model_id,model,brand_id,brand,image_url,year,color,price,warranty_months,engine_cc,fuel_type,transmission,fuel_tank_capacity';

type Supabase = Awaited<ReturnType<typeof createClient>>;

function toBikeModel(row: BikeModelRow): BikeModel {
  const min = toNumber(row.min_price) ?? 0;
  return {
    ...row,
    min_price: min,
    max_price: toNumber(row.max_price) ?? min,
    fuel_types: row.fuel_types ?? [],
    transmissions: row.transmissions ?? [],
    colors: row.colors ?? [],
  };
}

function toBike(row: BikeRow): Bike {
  return {
    ...row,
    price: toNumber(row.price) ?? 0,
    fuel_tank_capacity: toNumber(row.fuel_tank_capacity),
  };
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

export interface BikeFacets extends BikeFacetOptions {
  brands: Brand[];
}

/** Filter options built from the models that currently have units for sale. */
export const getBikeFacets = cache(async (): Promise<BikeFacets> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('catalog_bike_models')
    .select('brand_id,brand,fuel_types,transmissions');
  if (error) fail('motorcycle filters', error);
  const rows = (data ?? []) as Pick<BikeModelRow, 'brand_id' | 'brand' | 'fuel_types' | 'transmissions'>[];

  const brands = new Map<number, string>();
  rows.forEach((r) => brands.set(r.brand_id, r.brand));
  return {
    brands: [...brands]
      .map(([brand_id, brand]) => ({ brand_id, brand }))
      .sort((a, b) => a.brand.localeCompare(b.brand)),
    fuelTypes: uniqueSorted(rows.flatMap((r) => r.fuel_types ?? [])),
    transmissions: uniqueSorted(rows.flatMap((r) => r.transmissions ?? [])),
  };
});

function buildModelsQuery(supabase: Supabase, q: BikesQuery) {
  let req = supabase.from('catalog_bike_models').select(MODEL_COLUMNS, { count: 'exact' });
  if (q.brand) req = req.eq('brand_id', q.brand);
  // Array columns: the value comes from the facet whitelist, never raw user input.
  if (q.fuel) req = req.contains('fuel_types', [q.fuel]);
  if (q.transmission) req = req.contains('transmissions', [q.transmission]);
  if (q.min !== undefined) req = req.gte('max_price', q.min);
  if (q.max !== undefined) req = req.lte('min_price', q.max);
  if (q.q) req = req.ilike('model', containsPattern(q.q));

  switch (q.sort) {
    case 'price_desc':
      req = req.order('max_price', { ascending: false });
      break;
    case 'name':
      break;
    default:
      req = req.order('min_price', { ascending: true });
  }
  return req
    .order('brand', { ascending: true })
    .order('model', { ascending: true })
    .order('model_id', { ascending: true });
}

export async function listBikeModels(
  q: BikesQuery,
  pageSize = PAGE_SIZE,
): Promise<Paged<BikeModel>> {
  const supabase = await createClient();
  const { from, to } = pageRange(q.page, pageSize);
  const { data, error, count } = await buildModelsQuery(supabase, q).range(from, to);

  if (isRangeError(error)) {
    const head = await buildModelsQuery(supabase, q).range(0, 0);
    if (head.error) fail('motorcycles', head.error);
    const total = head.count ?? 0;
    return { items: [], total, page: q.page, pageCount: pageCount(total, pageSize), outOfRange: true };
  }
  if (error) fail('motorcycles', error);

  const total = count ?? 0;
  return {
    items: ((data ?? []) as BikeModelRow[]).map(toBikeModel),
    total,
    page: q.page,
    pageCount: pageCount(total, pageSize),
    outOfRange: false,
  };
}

/** Home page: cheapest models first. */
export async function listFeaturedBikeModels(limit = 4): Promise<BikeModel[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('catalog_bike_models')
    .select(MODEL_COLUMNS)
    .order('min_price', { ascending: true })
    .order('model', { ascending: true })
    .limit(limit);
  if (error) fail('motorcycles', error);
  return ((data ?? []) as BikeModelRow[]).map(toBikeModel);
}

/** Summary for a model with units for sale, or null when it has none (or does not exist). */
export const getBikeModel = cache(async (modelId: number): Promise<BikeModel | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('catalog_bike_models')
    .select(MODEL_COLUMNS)
    .eq('model_id', modelId)
    .maybeSingle();
  if (error) fail('motorcycle', error);
  return data ? toBikeModel(data as BikeModelRow) : null;
});

/** Units for sale of one model, cheapest and newest first. */
export async function listBikesForModel(modelId: number): Promise<Bike[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('catalog_bikes')
    .select(BIKE_COLUMNS)
    .eq('model_id', modelId)
    .order('price', { ascending: true })
    .order('year', { ascending: false })
    .order('bike_id', { ascending: true });
  if (error) fail('motorcycle units', error);
  return ((data ?? []) as BikeRow[]).map(toBike);
}

/** One unit for sale (by bike_id), or null when it is unknown, sold or reserved. No VIN. */
export async function getBikeForSale(bikeId: number): Promise<Bike | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from('catalog_bikes').select(BIKE_COLUMNS).eq('bike_id', bikeId).maybeSingle();
  if (error) fail('motorcycle unit', error);
  return data ? toBike(data as BikeRow) : null;
}
