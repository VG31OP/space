import test from 'node:test';
import assert from 'node:assert/strict';
import { CacheManager } from '../api.js';

test('CacheManager returns fresh entries and tracks hits', () => {
  const cache = new CacheManager();
  cache.set('k1', { value: 42 }, 1000);
  const value = cache.get('k1');
  assert.deepEqual(value, { value: 42 });
  const metrics = cache.getMetrics();
  assert.equal(metrics.hits, 1);
});

test('CacheManager treats expired entries as misses and supports stale fallback', () => {
  const cache = new CacheManager();
  cache.set('k2', { value: 7 }, 10);
  const entry = cache.getEntry('k2');
  entry.timestamp = Date.now() - 40000;

  const fresh = cache.get('k2');
  assert.equal(fresh, null);
  const stale = cache.getStale('k2', 120000);
  assert.deepEqual(stale, { value: 7 });
  assert.equal(cache.isStale('k2'), true);
});

