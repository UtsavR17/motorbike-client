// Fix Phase 6 (ISS-11): the unified search page sections.
// Run: npm test

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';
import {
  SEARCH_SECTION_LIMIT,
  bikesSearchQuery,
  partsSearchQuery,
  searchSections,
} from '../src/lib/catalog/search-page.ts';

const many = (n) => Array.from({ length: n }, (_, i) => ({ id: i + 1 }));

describe('search page sections', () => {
  test('each section shows at most the limit, with the true total', () => {
    assert.equal(SEARCH_SECTION_LIMIT, 8);
    const view = searchSections('honda', { items: many(20), total: 20 }, { items: many(30), total: 31 });
    assert.equal(view.bikes.items.length, 8);
    assert.equal(view.parts.items.length, 8);
    assert.equal(view.bikes.total, 20);
    assert.equal(view.parts.total, 31);
    assert.equal(view.bothEmpty, false);
  });

  test('fewer results than the limit are all shown', () => {
    const view = searchSections('r2', { items: many(1), total: 1 }, { items: [], total: 0 });
    assert.equal(view.bikes.items.length, 1);
    assert.equal(view.parts.items.length, 0);
  });

  test('"View all" links open the listings with the same search', () => {
    const view = searchSections('honda cb', { items: [], total: 0 }, { items: [], total: 0 });
    assert.equal(view.bikes.viewAllHref, '/bikes?q=honda+cb');
    assert.equal(view.parts.viewAllHref, '/parts?q=honda+cb');
    assert.equal(view.bikes.viewAllLabel, 'View all motorcycles for "honda cb"');
    assert.equal(view.parts.viewAllLabel, 'View all parts for "honda cb"');
  });

  test('empty texts and the both-empty flag', () => {
    const view = searchSections('xyzzy', { items: [], total: 0 }, { items: [], total: 0 });
    assert.equal(view.bikes.emptyText, 'No motorcycles match');
    assert.equal(view.parts.emptyText, 'No spare parts match');
    assert.equal(view.bothEmpty, true);
  });

  test('section queries use the defaults (first page, default sort, no filters)', () => {
    assert.deepEqual(partsSearchQuery('a'), { q: 'a', inStock: false, sort: 'name', page: 1 });
    assert.deepEqual(bikesSearchQuery('a'), { q: 'a', sort: 'price_asc', page: 1 });
  });
});

describe('search page wiring', () => {
  const page = readFileSync('src/app/search/page.tsx', 'utf8');
  const header = readFileSync('src/components/layout/HeaderSearch.tsx', 'utf8');

  test('the page is not indexed and runs both queries in parallel', () => {
    assert.match(page, /robots: \{ index: false, follow: true \}/);
    assert.match(page, /Promise\.all\(\[\s*listBikeModels\(bikesSearchQuery\(q\), SEARCH_SECTION_LIMIT\),\s*listPartProducts\(partsSearchQuery\(q\), SEARCH_SECTION_LIMIT\),/);
  });

  test('the header and mobile menu search submit to /search', () => {
    assert.match(header, /<CleanGetForm action="\/search"/);
    assert.match(header, /name="q"/);
  });
});

describe('listing result messages', () => {
  test('headline: "N results for <q>" only with a search', async () => {
    const { resultsHeadline } = await import('../src/lib/catalog/search-page.ts');
    assert.equal(resultsHeadline(3, 'honda'), '3 results for "honda"');
    assert.equal(resultsHeadline(1, 'r2'), '1 result for "r2"');
    assert.equal(resultsHeadline(0, 'xyz'), '0 results for "xyz"');
    assert.equal(resultsHeadline(5, undefined), null);
  });

  test('filters hide matches: suggest clearing filters (search kept)', async () => {
    const { emptyListing } = await import('../src/lib/catalog/search-page.ts');
    assert.deepEqual(emptyListing('parts', 'yamaha', true, 2), {
      title: 'No results with these filters',
      body: 'Try clearing filters. 2 parts match "yamaha" without them.',
      action: 'clearFilters',
    });
    assert.equal(emptyListing('motorcycles', 'r2', true, 1).body, 'Try clearing filters. 1 motorcycle matches "r2" without them.');
    assert.equal(emptyListing('parts', undefined, true, 7).body, 'Try clearing filters.');
  });

  test('nothing matches the search at all: suggest another search', async () => {
    const { emptyListing } = await import('../src/lib/catalog/search-page.ts');
    const empty = emptyListing('parts', 'xyzzy', true, 0);
    assert.equal(empty.title, 'No parts match "xyzzy"');
    assert.equal(empty.action, 'clearSearch');
    assert.equal(emptyListing('motorcycles', 'xyzzy', false, 0).action, 'clearSearch');
  });

  test('filters only, nothing at all: clear filters', async () => {
    const { emptyListing } = await import('../src/lib/catalog/search-page.ts');
    assert.deepEqual(emptyListing('motorcycles', undefined, true, 0), {
      title: 'No motorcycles match your filters',
      body: 'Try a wider price range or remove a filter.',
      action: 'clearFilters',
    });
  });

  test('the listings fetch the unfiltered count only for an empty filtered page', () => {
    for (const [path, fn] of [['src/app/parts/page.tsx', 'listPartProducts(partsWithoutFilters(query), 1)'],
                              ['src/app/bikes/page.tsx', 'listBikeModels(bikesWithoutFilters(query), 1)']]) {
      const src = readFileSync(path, 'utf8');
      assert.ok(src.includes(`result.total === 0 && links.hasFilters ? (await ${fn}).total : 0`), path);
      assert.ok(src.includes('resultsHeadline(result.total, query.q)'), path);
    }
  });
});
