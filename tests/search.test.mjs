// Fix Phase 6 (ISS-11): search terms, escaping and query construction.
// Run: npm test

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  MAX_TERMS,
  MAX_TERM_LENGTH,
  applyBikesQuery,
  applyPartsQuery,
  applySearch,
  containsPattern,
  searchTerms,
} from '../src/lib/catalog/query.ts';

/** Records every builder call. .or() throws: search must never build an .or() string. */
function mockBuilder() {
  const calls = [];
  const builder = {};
  for (const method of ['eq', 'gte', 'lte', 'ilike', 'contains', 'order']) {
    builder[method] = (...args) => {
      calls.push([method, ...args]);
      return builder;
    };
  }
  builder.or = () => {
    throw new Error('.or() must never be used for search');
  };
  return { builder, calls };
}

const partsQuery = (over = {}) => ({ inStock: false, sort: 'name', page: 1, ...over });
const bikesQuery = (over = {}) => ({ sort: 'price_asc', page: 1, ...over });

describe('searchTerms', () => {
  test('empty and whitespace-only queries give no terms', () => {
    for (const q of [undefined, null, '', ' ', '\t\n ', ' 　']) assert.deepEqual(searchTerms(q), [], JSON.stringify(q));
  });

  test('splits on any whitespace and trims', () => {
    assert.deepEqual(searchTerms('  honda   cb\tshine\nred '), ['honda', 'cb', 'shine', 'red']);
    assert.deepEqual(searchTerms('honda cb'), ['honda', 'cb']);
  });

  test('at most 5 terms', () => {
    assert.equal(MAX_TERMS, 5);
    assert.deepEqual(searchTerms('a b c d e f g'), ['a', 'b', 'c', 'd', 'e']);
  });

  test('each term at most 30 characters, cut by code points', () => {
    assert.equal(MAX_TERM_LENGTH, 30);
    assert.equal(searchTerms('x'.repeat(100))[0].length, 30);
    const emoji = searchTerms('\u{1F3CD}'.repeat(40))[0];
    assert.equal(Array.from(emoji).length, 30);
    assert.ok(!/[\uD800-\uDBFF]$/.test(emoji), 'no half surrogate pair');
  });

  test('duplicates (any case) are dropped', () => {
    assert.deepEqual(searchTerms('Honda honda HONDA cb'), ['Honda', 'cb']);
  });

  test('Unicode letters are kept as typed (ILIKE is case-insensitive)', () => {
    assert.deepEqual(searchTerms('Pneu Été'), ['Pneu', 'Été']);
  });

  test('wildcard-only terms are kept as plain text', () => {
    assert.deepEqual(searchTerms('% _ *'), ['%', '_', '*']);
  });
});

describe('containsPattern', () => {
  test('wraps the term for a contains match', () => {
    assert.equal(containsPattern('yamaha'), '%yamaha%');
  });

  test('escapes LIKE wildcards and the escape character', () => {
    assert.equal(containsPattern('%'), '%\\%%');
    assert.equal(containsPattern('_'), '%\\_%');
    assert.equal(containsPattern('a\\b'), '%a\\\\b%');
    assert.equal(containsPattern('*'), '%_%');
  });

  test('caps the term length', () => {
    assert.equal(containsPattern('y'.repeat(80)), `%${'y'.repeat(30)}%`);
  });
});

describe('query construction', () => {
  test('one parameterised ILIKE on search_text per term, nothing else for search', () => {
    const { builder, calls } = mockBuilder();
    applySearch(builder, 'honda cb red');
    assert.deepEqual(calls, [
      ['ilike', 'search_text', '%honda%'],
      ['ilike', 'search_text', '%cb%'],
      ['ilike', 'search_text', '%red%'],
    ]);
  });

  test('no search filter for an empty query', () => {
    const { builder, calls } = mockBuilder();
    applySearch(builder, '   ');
    assert.deepEqual(calls, []);
  });

  test('hostile input stays a single escaped value per term (no .or(), no column injection)', () => {
    const { builder, calls } = mockBuilder();
    applySearch(builder, 'x,part_name.eq.y or(id.gt.0) %');
    assert.ok(calls.every(([m, col]) => m === 'ilike' && col === 'search_text'));
    assert.deepEqual(calls.map((c) => c[2]), ['%x,part\\_name.eq.y%', '%or(id.gt.0)%', '%\\%%']);
  });

  test('parts: filters, search and sort combine', () => {
    const { builder, calls } = mockBuilder();
    applyPartsQuery(builder, partsQuery({ q: 'yamaha plug', category: 2, brand: 3, inStock: true, min: 100, max: 900, sort: 'price_desc' }));
    assert.deepEqual(calls, [
      ['eq', 'category_id', 2],
      ['eq', 'brand_id', 3],
      ['eq', 'in_stock', true],
      ['gte', 'max_price', 100],
      ['lte', 'min_price', 900],
      ['ilike', 'search_text', '%yamaha%'],
      ['ilike', 'search_text', '%plug%'],
      ['order', 'max_price', { ascending: false }],
      ['order', 'part_name', { ascending: true }],
      ['order', 'brand', { ascending: true }],
      ['order', 'part_id', { ascending: true }],
      ['order', 'brand_id', { ascending: true }],
    ]);
  });

  test('parts: no part_name filter any more (the old single-field search)', () => {
    const { builder, calls } = mockBuilder();
    applyPartsQuery(builder, partsQuery({ q: 'honda' }));
    assert.ok(!calls.some(([m, col]) => m === 'ilike' && col !== 'search_text'));
  });

  test('bikes: filters, search and default price sort', () => {
    const { builder, calls } = mockBuilder();
    applyBikesQuery(builder, bikesQuery({ q: 'red 150', brand: 4, fuel: 'Petrol', transmission: 'Manual', min: 50000 }));
    assert.deepEqual(calls, [
      ['eq', 'brand_id', 4],
      ['contains', 'fuel_types', ['Petrol']],
      ['contains', 'transmissions', ['Manual']],
      ['gte', 'max_price', 50000],
      ['ilike', 'search_text', '%red%'],
      ['ilike', 'search_text', '%150%'],
      ['order', 'min_price', { ascending: true }],
      ['order', 'brand', { ascending: true }],
      ['order', 'model', { ascending: true }],
      ['order', 'model_id', { ascending: true }],
    ]);
  });

  test('bikes: name sort has no price order; price_desc orders by max price', () => {
    let m = mockBuilder();
    applyBikesQuery(m.builder, bikesQuery({ sort: 'name' }));
    assert.equal(m.calls[0][1], 'brand');
    m = mockBuilder();
    applyBikesQuery(m.builder, bikesQuery({ sort: 'price_desc' }));
    assert.deepEqual(m.calls[0], ['order', 'max_price', { ascending: false }]);
  });
});
