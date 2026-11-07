// The unified search page (/search?q=...): one section for motorcycles and one for spare parts
// (Fix Phase 6, ISS-11). Pure, so the section limits and links are unit-tested.

import { bikesHref, partsHref, type BikesQuery, type PartsQuery } from '@/lib/params';

/** Cards shown per section; "View all" opens the full listing with the same search. */
export const SEARCH_SECTION_LIMIT = 8;

/** The listing queries behind each section: the search only, default sort, first page. */
export function partsSearchQuery(q: string): PartsQuery {
  return { q, inStock: false, sort: 'name', page: 1 };
}

export function bikesSearchQuery(q: string): BikesQuery {
  return { q, sort: 'price_asc', page: 1 };
}

export interface SectionResult<T> {
  items: T[];
  total: number;
}

export interface SearchSection<T> {
  title: string;
  items: T[];
  total: number;
  viewAllHref: string;
  viewAllLabel: string;
  emptyText: string;
}

export function searchSections<B, P>(
  q: string,
  bikes: SectionResult<B>,
  parts: SectionResult<P>,
  limit = SEARCH_SECTION_LIMIT,
): { bikes: SearchSection<B>; parts: SearchSection<P>; bothEmpty: boolean } {
  return {
    bikes: {
      title: 'Motorcycles',
      items: bikes.items.slice(0, limit),
      total: bikes.total,
      viewAllHref: bikesHref(bikesSearchQuery(q)),
      viewAllLabel: `View all motorcycles for "${q}"`,
      emptyText: 'No motorcycles match',
    },
    parts: {
      title: 'Spare parts',
      items: parts.items.slice(0, limit),
      total: parts.total,
      viewAllHref: partsHref(partsSearchQuery(q)),
      viewAllLabel: `View all parts for "${q}"`,
      emptyText: 'No spare parts match',
    },
    bothEmpty: bikes.total === 0 && parts.total === 0,
  };
}
