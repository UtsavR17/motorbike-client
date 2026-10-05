// Hand-written types for the public catalogue views (see README: database contract).
// Raw rows mirror PostgREST output: NUMERIC columns may arrive as numbers or strings.
// The data layer converts raw rows into the clean types below exactly once.

export type Numeric = number | string;

export type StockStatus = 'in_stock' | 'low_stock' | 'out_of_stock';

export interface Brand {
  brand_id: number;
  brand: string;
}

export interface Category {
  category_id: number;
  category: string;
}

export interface CatalogModel {
  model_id: number;
  model: string;
  brand_id: number;
  brand: string;
  image_url: string | null;
}

export interface ServiceRow {
  service_id: number;
  name: string;
  description: string | null;
  cost: Numeric;
}

export interface Service {
  service_id: number;
  name: string;
  description: string | null;
  cost: number;
}

export interface PartVariantRow {
  stock_id: number;
  part_id: number;
  part_name: string;
  part_description: string | null;
  image_url: string | null;
  category_id: number | null;
  category: string | null;
  brand_id: number;
  brand: string;
  size: string | null;
  price: Numeric;
  warranty_months: number | null;
  stock_status: StockStatus;
  qty_available: number;
}

export interface PartVariant extends Omit<PartVariantRow, 'price'> {
  price: number;
}

export interface PartProductRow {
  part_id: number;
  brand_id: number;
  part_name: string;
  part_description: string | null;
  image_url: string | null;
  category_id: number | null;
  category: string | null;
  brand: string;
  min_price: Numeric;
  max_price: Numeric;
  variant_count: number;
  in_stock: boolean;
}

export interface PartProduct extends Omit<PartProductRow, 'min_price' | 'max_price'> {
  min_price: number;
  max_price: number;
  // Derived for cards: low_stock when every available variant is low on stock.
  stock_status: StockStatus;
}

export interface BikeRow {
  bike_id: number;
  model_id: number;
  model: string;
  brand_id: number;
  brand: string;
  image_url: string | null;
  year: number | null;
  color: string | null;
  price: Numeric;
  warranty_months: number | null;
  engine_cc: number | null;
  fuel_type: string | null;
  transmission: string | null;
  fuel_tank_capacity: Numeric | null;
}

export interface Bike extends Omit<BikeRow, 'price' | 'fuel_tank_capacity'> {
  price: number;
  fuel_tank_capacity: number | null;
}

export interface BikeModelRow {
  model_id: number;
  brand_id: number;
  model: string;
  brand: string;
  image_url: string | null;
  units_available: number;
  min_price: Numeric;
  max_price: Numeric;
  min_year: number | null;
  max_year: number | null;
  min_engine_cc: number | null;
  max_engine_cc: number | null;
  fuel_types: string[] | null;
  transmissions: string[] | null;
  colors: string[] | null;
}

export interface BikeModel
  extends Omit<BikeModelRow, 'min_price' | 'max_price' | 'fuel_types' | 'transmissions' | 'colors'> {
  min_price: number;
  max_price: number;
  fuel_types: string[];
  transmissions: string[];
  colors: string[];
}

export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  pageCount: number;
  // Set when the requested page is past the last page; the page redirects.
  outOfRange: boolean;
}
