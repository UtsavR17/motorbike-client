import 'server-only';

import { cache } from 'react';
import { PAGE_SIZE } from '@/config/shop';
import { toNumber } from '@/lib/format';
import type { PartsQuery } from '@/lib/params';
import { createClient } from '@/lib/supabase/server';
import type {
  Paged,
  PartProduct,
  PartProductRow,
  PartVariant,
  PartVariantRow,
  StockStatus,
} from '@/types/catalog';
import { containsPattern, fail, isRangeError, pageCount, pageRange } from './shared';

const PRODUCT_COLUMNS =
  'part_id,brand_id,part_name,part_description,image_url,category_id,category,brand,min_price,max_price,variant_count,in_stock';

const VARIANT_COLUMNS =
  'stock_id,part_id,part_name,part_description,image_url,category_id,category,brand_id,brand,size,price,warranty_months,stock_status,qty_available';

type Supabase = Awaited<ReturnType<typeof createClient>>;

function toVariant(row: PartVariantRow): PartVariant {
  return { ...row, price: toNumber(row.price) ?? 0 };
}

function toProduct(row: PartProductRow, status: StockStatus): PartProduct {
  const min = toNumber(row.min_price) ?? 0;
  const max = toNumber(row.max_price) ?? min;
  return { ...row, min_price: min, max_price: max, stock_status: status };
}

/** Source rows: the product view, or the compatibility RPC when a bike is selected. */
function productSource(supabase: Supabase, q: PartsQuery) {
  if (q.model) {
    const args: { p_model_id: number; p_year?: number } = { p_model_id: q.model };
    if (q.year) args.p_year = q.year;
    return supabase
      .rpc('catalog_parts_for_bike', args, { count: 'exact' })
      .select(PRODUCT_COLUMNS);
  }
  return supabase.from('catalog_part_products').select(PRODUCT_COLUMNS, { count: 'exact' });
}

function buildProductsQuery(supabase: Supabase, q: PartsQuery) {
  let req = productSource(supabase, q);
  if (q.category) req = req.eq('category_id', q.category);
  if (q.brand) req = req.eq('brand_id', q.brand);
  if (q.inStock) req = req.eq('in_stock', true);
  // Price filter keeps products whose price range overlaps [min, max].
  if (q.min !== undefined) req = req.gte('max_price', q.min);
  if (q.max !== undefined) req = req.lte('min_price', q.max);
  if (q.q) req = req.ilike('part_name', containsPattern(q.q));

  switch (q.sort) {
    case 'price_asc':
      req = req.order('min_price', { ascending: true });
      break;
    case 'price_desc':
      req = req.order('max_price', { ascending: false });
      break;
    default:
      break;
  }
  // Stable tie-breakers so pagination never repeats or skips a product.
  return req
    .order('part_name', { ascending: true })
    .order('brand', { ascending: true })
    .order('part_id', { ascending: true })
    .order('brand_id', { ascending: true });
}

/**
 * Card stock status for a product (part + brand): out of stock when no variant is
 * available, low stock when every available variant is low, otherwise in stock.
 */
async function productStatuses(
  supabase: Supabase,
  rows: PartProductRow[],
): Promise<Map<string, StockStatus>> {
  const statuses = new Map<string, StockStatus>();
  const partIds = [...new Set(rows.map((r) => r.part_id))];
  if (partIds.length === 0) return statuses;

  const { data, error } = await supabase
    .from('catalog_part_variants')
    .select('part_id,brand_id,stock_status')
    .in('part_id', partIds);
  if (error) fail('stock status', error);

  const byProduct = new Map<string, StockStatus[]>();
  for (const v of (data ?? []) as Pick<PartVariantRow, 'part_id' | 'brand_id' | 'stock_status'>[]) {
    const key = `${v.part_id}:${v.brand_id}`;
    byProduct.set(key, [...(byProduct.get(key) ?? []), v.stock_status]);
  }
  for (const row of rows) {
    const key = `${row.part_id}:${row.brand_id}`;
    const available = (byProduct.get(key) ?? []).filter((s) => s !== 'out_of_stock');
    let status: StockStatus = 'out_of_stock';
    if (row.in_stock && available.length > 0) {
      status = available.every((s) => s === 'low_stock') ? 'low_stock' : 'in_stock';
    } else if (row.in_stock) {
      status = 'in_stock';
    }
    statuses.set(key, status);
  }
  return statuses;
}

async function withStatuses(supabase: Supabase, rows: PartProductRow[]): Promise<PartProduct[]> {
  const statuses = await productStatuses(supabase, rows);
  return rows.map((r) =>
    toProduct(r, statuses.get(`${r.part_id}:${r.brand_id}`) ?? (r.in_stock ? 'in_stock' : 'out_of_stock')),
  );
}

export async function listPartProducts(
  q: PartsQuery,
  pageSize = PAGE_SIZE,
): Promise<Paged<PartProduct>> {
  const supabase = await createClient();
  const { from, to } = pageRange(q.page, pageSize);
  const { data, error, count } = await buildProductsQuery(supabase, q).range(from, to);

  if (isRangeError(error)) {
    // Page is past the end: fetch just the count so the page can redirect to the last page.
    const head = await buildProductsQuery(supabase, q).range(0, 0);
    if (head.error) fail('parts', head.error);
    const total = head.count ?? 0;
    return { items: [], total, page: q.page, pageCount: pageCount(total, pageSize), outOfRange: true };
  }
  if (error) fail('parts', error);

  const total = count ?? 0;
  const items = await withStatuses(supabase, (data ?? []) as PartProductRow[]);
  return { items, total, page: q.page, pageCount: pageCount(total, pageSize), outOfRange: false };
}

/** Home page: in-stock products by name. */
export async function listFeaturedParts(limit = 8): Promise<PartProduct[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('catalog_part_products')
    .select(PRODUCT_COLUMNS)
    .eq('in_stock', true)
    .order('part_name', { ascending: true })
    .order('brand', { ascending: true })
    .limit(limit);
  if (error) fail('featured parts', error);
  return withStatuses(supabase, (data ?? []) as PartProductRow[]);
}

/** Every variant (stock line) of one part across all brands. Deduplicated per request. */
export const getPartVariants = cache(async (partId: number): Promise<PartVariant[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('catalog_part_variants')
    .select(VARIANT_COLUMNS)
    .eq('part_id', partId)
    .order('brand', { ascending: true })
    .order('size', { ascending: true, nullsFirst: true })
    .order('price', { ascending: true })
    .order('stock_id', { ascending: true });
  if (error) fail('part', error);
  return ((data ?? []) as PartVariantRow[]).map(toVariant);
});
