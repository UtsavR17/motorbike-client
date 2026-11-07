// Fix Phase 6 (ISS-11): search, filters, sort, page and the vehicle finder never drop each other.
// Every combination of parameters is checked against the rules of partsLinks / bikesLinks.
// Run: npm test

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';
import {
  BIKES_FORM_FIELDS,
  PARTS_FORM_FIELDS,
  bikesLinks,
  partsLinks,
} from '../src/lib/params.ts';

/** URL params of an href as a plain object. */
function params(href) {
  const qs = href.includes('?') ? href.slice(href.indexOf('?') + 1) : '';
  return Object.fromEntries(new URLSearchParams(qs));
}

function without(obj, ...keys) {
  const copy = { ...obj };
  keys.forEach((k) => delete copy[k]);
  return copy;
}

/** Every subset of the given optional parts, merged onto a base query. */
function* combinations(base, parts) {
  const keys = Object.keys(parts);
  for (let mask = 0; mask < 1 << keys.length; mask++) {
    const q = { ...base };
    keys.forEach((k, i) => {
      if (mask & (1 << i)) Object.assign(q, parts[k]);
    });
    yield q;
  }
}

const PART_PARTS = {
  q: { q: 'honda cb' },
  category: { category: 2 },
  brand: { brand: 3 },
  stock: { inStock: true },
  min: { min: 100 },
  max: { max: 900 },
  bike: { model: 5, year: 2020 },
  sort: { sort: 'price_desc' },
  page: { page: 3 },
};
const PART_FILTER_PARAMS = ['category', 'brand', 'stock', 'min', 'max', 'model', 'year'];
const PART_KEY_PARAMS = { q: ['q'], category: ['category'], brand: ['brand'], stock: ['stock'], min: ['min'], max: ['max'], model: ['model', 'year'] };

describe('parts links: every combination', () => {
  const all = [...combinations({ inStock: false, sort: 'name', page: 1 }, PART_PARTS)];

  test(`covers ${all.length} combinations`, () => assert.equal(all.length, 512));

  for (const query of all) {
    const links = partsLinks(query);
    const self = params(links.self);
    const name = JSON.stringify(self);

    test(`rules hold for ${name}`, () => {
      // Pagination keeps everything.
      assert.deepEqual(params(links.page(4)), { ...without(self, 'page'), page: '4' });
      assert.deepEqual(params(links.page(1)), without(self, 'page'));
      // Sort keeps the search and filters and resets the page.
      assert.deepEqual(params(links.sort('price_asc')), { ...without(self, 'page', 'sort'), sort: 'price_asc' });
      assert.deepEqual(params(links.sort('name')), without(self, 'page', 'sort'));
      // Removing one chip removes only that parameter (the bike removes its year too).
      for (const [key, removed] of Object.entries(PART_KEY_PARAMS)) {
        assert.deepEqual(params(links.remove(key)), without(self, 'page', ...removed), key);
      }
      // Clear filters keeps the search and sort; clear search keeps the filters and sort.
      assert.deepEqual(params(links.clearFilters), without(self, 'page', ...PART_FILTER_PARAMS));
      assert.deepEqual(params(links.clearSearch), without(self, 'page', 'q'));
      assert.equal(links.hasFilters, PART_FILTER_PARAMS.some((p) => p in self));
      // The form: visible fields plus hidden fields reproduce everything except the page.
      const hidden = Object.fromEntries(links.hiddenFields(PARTS_FORM_FIELDS));
      assert.ok(!('page' in hidden));
      assert.ok(PARTS_FORM_FIELDS.every((f) => !(f in hidden)));
      const visible = Object.fromEntries(Object.entries(self).filter(([k]) => PARTS_FORM_FIELDS.includes(k)));
      assert.deepEqual({ ...visible, ...hidden }, without(self, 'page'));
    });
  }

  test('the vehicle finder combines with search and filters', () => {
    const links = partsLinks({ q: 'plug', category: 2, inStock: false, sort: 'price_asc', page: 2 });
    assert.deepEqual(params(links.withBike(9, 2021)), { q: 'plug', category: '2', model: '9', year: '2021', sort: 'price_asc' });
    assert.deepEqual(params(links.withBike(9)), { q: 'plug', category: '2', model: '9', sort: 'price_asc' });
  });

  test('defaults are omitted from links', () => {
    assert.equal(partsLinks({ inStock: false, sort: 'name', page: 1 }).self, '/parts');
    assert.equal(partsLinks({ q: 'a', inStock: false, sort: 'name', page: 1 }).clearSearch, '/parts');
  });
});

const BIKE_PARTS = {
  q: { q: 'red 150' },
  brand: { brand: 4 },
  fuel: { fuel: 'Petrol' },
  transmission: { transmission: 'Manual' },
  min: { min: 50000 },
  max: { max: 90000 },
  sort: { sort: 'name' },
  page: { page: 2 },
};
const BIKE_FILTER_PARAMS = ['brand', 'fuel', 'transmission', 'min', 'max'];

describe('bike links: every combination', () => {
  const all = [...combinations({ sort: 'price_asc', page: 1 }, BIKE_PARTS)];

  test(`covers ${all.length} combinations`, () => assert.equal(all.length, 256));

  for (const query of all) {
    const links = bikesLinks(query);
    const self = params(links.self);

    test(`rules hold for ${JSON.stringify(self)}`, () => {
      assert.deepEqual(params(links.page(5)), { ...without(self, 'page'), page: '5' });
      assert.deepEqual(params(links.sort('price_desc')), { ...without(self, 'page', 'sort'), sort: 'price_desc' });
      for (const key of ['q', ...BIKE_FILTER_PARAMS]) {
        assert.deepEqual(params(links.remove(key)), without(self, 'page', key), key);
      }
      assert.deepEqual(params(links.clearFilters), without(self, 'page', ...BIKE_FILTER_PARAMS));
      assert.deepEqual(params(links.clearSearch), without(self, 'page', 'q'));
      assert.equal(links.hasFilters, BIKE_FILTER_PARAMS.some((p) => p in self));
      const hidden = Object.fromEntries(links.hiddenFields(BIKES_FORM_FIELDS));
      const visible = Object.fromEntries(Object.entries(self).filter(([k]) => BIKES_FORM_FIELDS.includes(k)));
      assert.deepEqual({ ...visible, ...hidden }, without(self, 'page'));
    });
  }
});

describe('pages use the helpers', () => {
  for (const [path, helper] of [['src/app/parts/page.tsx', 'partsLinks'], ['src/app/bikes/page.tsx', 'bikesLinks']]) {
    test(`${path} builds every link with ${helper}`, () => {
      const src = readFileSync(path, 'utf8');
      assert.match(src, new RegExp(`const links = ${helper}\\(query\\)`));
      assert.doesNotMatch(src, /href="\/(parts|bikes)"/, 'no bare reset link that drops the search');
      assert.doesNotMatch(src, /(partsHref|bikesHref)\(query/, 'no hand-built listing links');
      assert.match(src, /hiddenFields\((PARTS|BIKES)_FORM_FIELDS\)/);
    });
  }
});
