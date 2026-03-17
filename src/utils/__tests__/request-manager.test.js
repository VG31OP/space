import test from 'node:test';
import assert from 'node:assert/strict';
import { CacheManager, RequestManager } from '../api.js';

function createResponse(status, body, headers = {}) {
  const headerMap = new Map(Object.entries(headers));
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get(name) {
        return headerMap.get(String(name).toLowerCase()) || headerMap.get(name) || null;
      },
      forEach(callback) {
        for (const [key, value] of headerMap.entries()) callback(value, key);
      },
    },
    async json() { return body; },
    async text() { return typeof body === 'string' ? body : JSON.stringify(body); },
  };
}

test('RequestManager deduplicates identical in-flight requests', async () => {
  let calls = 0;
  const manager = new RequestManager({
    cache: new CacheManager(),
    fetchImpl: async () => {
      calls += 1;
      await new Promise((resolve) => setTimeout(resolve, 30));
      return createResponse(200, { ok: true });
    },
    maxConcurrentPerEndpoint: 5,
  });

  const results = await Promise.all(
    Array.from({ length: 10 }, () => manager.fetch('/api/test', { params: { q: 1 } })),
  );

  assert.equal(calls, 1);
  assert.equal(results.length, 10);
  assert.equal(results[0].data.ok, true);
});

test('RequestManager enforces per-endpoint queue concurrency', async () => {
  let active = 0;
  let maxActive = 0;
  const manager = new RequestManager({
    cache: new CacheManager(),
    maxConcurrentPerEndpoint: 2,
    fetchImpl: async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 25));
      active -= 1;
      return createResponse(200, { ok: true });
    },
  });

  await Promise.all(
    Array.from({ length: 8 }, (_, index) => manager.fetch('/api/queue', { params: { index } })),
  );

  assert.ok(maxActive <= 2);
});

test('RequestManager retries 429 with backoff and succeeds', async () => {
  let calls = 0;
  const manager = new RequestManager({
    cache: new CacheManager(),
    fetchImpl: async () => {
      calls += 1;
      if (calls < 3) {
        return createResponse(429, { error: 'rate limit' }, { 'retry-after': '0' });
      }
      return createResponse(200, { ok: true });
    },
    initialBackoffMs: 20,
    maxBackoffMs: 50,
    jitterRatio: 0,
    maxRetries: 3,
  });

  const started = Date.now();
  const result = await manager.fetch('/api/retry', { params: { p: 1 } });
  const elapsed = Date.now() - started;

  assert.equal(result.data.ok, true);
  assert.equal(calls, 3);
  assert.ok(elapsed >= 55);
});

test('RequestManager does not retry 400 errors', async () => {
  let calls = 0;
  const manager = new RequestManager({
    cache: new CacheManager(),
    fetchImpl: async () => {
      calls += 1;
      return createResponse(400, { error: 'bad request' });
    },
    initialBackoffMs: 20,
    jitterRatio: 0,
    maxRetries: 3,
  });

  await assert.rejects(
    () => manager.fetch('/api/bad', { params: { x: 1 } }),
    (error) => error.code === 400,
  );
  assert.equal(calls, 1);
});

