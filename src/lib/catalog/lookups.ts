import 'server-only';

import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import type { Brand, CatalogModel, Category } from '@/types/catalog';
import { fail } from './shared';

// Small reference lists. cache() only deduplicates calls within one request.

export const getBrands = cache(async (): Promise<Brand[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('catalog_brands')
    .select('brand_id,brand')
    .order('brand', { ascending: true });
  if (error) fail('brands', error);
  return (data ?? []) as Brand[];
});

export const getCategories = cache(async (): Promise<Category[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('catalog_categories')
    .select('category_id,category')
    .order('category', { ascending: true });
  if (error) fail('categories', error);
  return (data ?? []) as Category[];
});

/** All motorcycle models (used by the vehicle finder), ordered by brand then model. */
export const getModels = cache(async (): Promise<CatalogModel[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('catalog_models')
    .select('model_id,model,brand_id,brand,image_url')
    .order('brand', { ascending: true })
    .order('model', { ascending: true });
  if (error) fail('models', error);
  return (data ?? []) as CatalogModel[];
});

/** One motorcycle model from the public model list, or null when it does not exist. */
export const getModel = cache(async (modelId: number): Promise<CatalogModel | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('catalog_models')
    .select('model_id,model,brand_id,brand,image_url')
    .eq('model_id', modelId)
    .maybeSingle();
  if (error) fail('model', error);
  return (data as CatalogModel | null) ?? null;
});
