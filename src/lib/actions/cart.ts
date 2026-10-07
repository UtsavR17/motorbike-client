'use server';

import { z } from 'zod';
import { MAX_CART_LINES, MAX_LINE_QTY } from '@/config/shop';
import { toNumber } from '@/lib/format';
import { sizeLabel } from '@/lib/labels';
import { createClient } from '@/lib/supabase/server';
import type { StockStatus } from '@/types/catalog';

/** Current catalogue data for one cart line. Prices are always read fresh here. */
export interface CartItemInfo {
  stockId: number;
  partId: number;
  brandId: number;
  name: string;
  brand: string;
  size: string;
  price: number;
  stockStatus: StockStatus;
  /** Most the customer can order: min(qty_available, MAX_LINE_QTY); 0 when out of stock. */
  maxQty: number;
  imageUrl: string | null;
}

const idsSchema = z.array(z.number().int().positive().max(2_147_483_647)).max(MAX_CART_LINES * 2);

interface VariantRow {
  stock_id: number;
  part_id: number;
  brand_id: number;
  part_name: string;
  brand: string;
  size: string | null;
  price: number | string;
  stock_status: StockStatus;
  qty_available: number;
  image_url: string | null;
}

/**
 * Looks up cart lines in catalog_part_variants (public view). Unknown ids are simply missing
 * from the result, so the cart can show "no longer available".
 */
export async function getCartItemsAction(stockIds: number[]): Promise<CartItemInfo[]> {
  const parsed = idsSchema.safeParse(stockIds);
  if (!parsed.success || parsed.data.length === 0) return [];
  const ids = [...new Set(parsed.data)];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('catalog_part_variants')
    .select('stock_id,part_id,brand_id,part_name,brand,size,price,stock_status,qty_available,image_url')
    .in('stock_id', ids);
  if (error) {
    console.error(`[cart] lookup failed: ${error.code ?? 'unknown'}`);
    throw new Error('Could not load your cart.');
  }
  return ((data ?? []) as VariantRow[]).map((r) => {
    const available = r.stock_status === 'out_of_stock' ? 0 : Math.max(0, r.qty_available);
    return {
      stockId: r.stock_id,
      partId: r.part_id,
      brandId: r.brand_id,
      name: r.part_name,
      brand: r.brand,
      size: sizeLabel(r.size),
      price: toNumber(r.price) ?? 0,
      stockStatus: r.stock_status,
      maxQty: Math.min(available, MAX_LINE_QTY),
      imageUrl: r.image_url,
    };
  });
}
