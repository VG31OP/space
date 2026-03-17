/**
 * @typedef {{ data: any, timestamp: number, ttl: number, headers?: Record<string, string> }} CacheEntry
 * @typedef {{ type: string, endpoint?: string, status?: number, attempt?: number, queueLength?: number, message?: string, retryAfter?: number }} RequestEvent
 */

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sanitizeForLog(value) {
  if (!value || typeof value !== 'object') return value;
  const clone = { ...value };
  const secretLike = /(authorization|token|api[_-]?key|password|secret|cookie)/i;
  Object.keys(clone).forEach((key) => {
    if (secretLike.test(key)) clone[key] = '[REDACTED]';
  });
  return clone;
}

function buildCacheKey(endpoint, params = {}) {
  return `${endpoint}:${JSON.stringify(params)}`;
}

function toRetryAfterSeconds(retryAfterHeader) {
  if (!retryAfterHeader) return null;
  const numeric = Number.parseInt(retryAfterHeader, 10);
  if (Number.isFinite(numeric) && numeric >= 0) return numeric;
  const dateMs = Date.parse(retryAfterHeader);
  if (Number.isNaN(dateMs)) return null;
  return Math.max(0, Math.ceil((dateMs - Date.now()) / 1000));
}

export class CacheManager {
  constructor() {
    this.entries = new Map();
    this.metrics = {
      hits: 0,
      misses: 0,
      expiries: 0,
      stalenessReturns: 0,
      ageTotalMs: 0,
      ageSamples: 0,
    };
    this.defaultTtls = {
      adsbfi: 10000,
      opensky: 10000,
      satellites: 15000,
      celestrak: 15000,
      ships: 20000,
      maritime: 20000,
      news: 30000,
      default: 10000,
    };
  }

  resolveTtl(endpoint, ttlOverride) {
    if (typeof ttlOverride === 'number' && ttlOverride > 0) return ttlOverride;
    const path = String(endpoint || '').toLowerCase();
    if (path.includes('adsbfi') || path.includes('opensky')) return this.defaultTtls.adsbfi;
    if (path.includes('satellite') || path.includes('celestrak')) return this.defaultTtls.satellites;
    if (path.includes('ship') || path.includes('maritime') || path.includes('ais')) return this.defaultTtls.ships;
    if (path.includes('news')) return this.defaultTtls.news;
    return this.defaultTtls.default;
  }

  getEntry(key) {
    return this.entries.get(key) || null;
  }

  get(key) {
    const entry = this.entries.get(key);
    if (!entry) {
      this.metrics.misses += 1;
      return null;
    }

    const ageMs = Date.now() - entry.timestamp;
    if (ageMs > entry.ttl) {
      this.metrics.expiries += 1;
      this.metrics.misses += 1;
      return null;
    }

    this.metrics.hits += 1;
    this.metrics.ageTotalMs += ageMs;
    this.metrics.ageSamples += 1;
    return entry.data;
  }

  getStale(key, maxStaleMs = 120000) {
    const entry = this.entries.get(key);
    if (!entry) return null;
    const ageMs = Date.now() - entry.timestamp;
    if (ageMs <= entry.ttl) return entry.data;
    if (ageMs > maxStaleMs) return null;
    this.metrics.stalenessReturns += 1;
    this.metrics.ageTotalMs += ageMs;
    this.metrics.ageSamples += 1;
    return entry.data;
  }

  set(key, data, ttl, headers) {
    const safeTtl = Math.max(1000, Number(ttl || this.defaultTtls.default));
    this.entries.set(key, {
      data,
      timestamp: Date.now(),
      ttl: safeTtl,
      headers: headers || {},
    });
    this.prune();
  }

  isStale(key) {
    const entry = this.entries.get(key);
    if (!entry) return false;
    return Date.now() - entry.timestamp > entry.ttl;
  }

  clear(pattern) {
    if (!pattern) {
      this.entries.clear();
      return;
    }

    const matcher = pattern instanceof RegExp
      ? (key) => pattern.test(key)
      : (key) => key.includes(String(pattern));

    for (const key of this.entries.keys()) {
      if (matcher(key)) this.entries.delete(key);
    }
  }

  prune(maxStaleMs = 120000) {
    const now = Date.now();
    for (const [key, entry] of this.entries.entries()) {
      if (now - entry.timestamp > Math.max(maxStaleMs, entry.ttl)) {
        this.entries.delete(key);
      }
    }
  }

  getMetrics() {
    return {
      hits: this.metrics.hits,
      misses: this.metrics.misses,
      expiries: this.metrics.expiries,
      stalenessReturns: this.metrics.stalenessReturns,
      avgAge: this.metrics.ageSamples > 0
        ? Math.round(this.metrics.ageTotalMs / this.metrics.ageSamples)
        : 0,
      size: this.entries.size,
    };
  }
}

export const HealthMonitor = {
  status: 'nominal',
  total: 0,
  failed: 0,
  listeners: [],

  subscribe(callback) {
    this.listeners.push(callback);
    callback(this.status);
  },

  notify() {
    this.listeners.forEach((cb) => cb(this.status));
  },

  reportSuccess() {
    this.total += 1;
    this.refreshStatus();
  },

  reportFailure() {
    this.total += 1;
    this.failed += 1;
    this.refreshStatus();
  },

  refreshStatus() {
    const successRate = this.total > 0 ? (this.total - this.failed) / this.total : 1;
    const next = successRate < 0.7 ? 'critical' : successRate < 0.9 ? 'degraded' : 'nominal';
    if (next !== this.status) {
      this.status = next;
      this.notify();
    }
  },
};

export class RequestManager {
  constructor(config = {}) {
    this.cache = config.cache || new CacheManager();
    this.fetchImpl = config.fetchImpl || fetch;
    this.maxConcurrentPerEndpoint = Number(config.maxConcurrentPerEndpoint || 5);
    this.maxRetries = Number(config.maxRetries || 3);
    this.initialBackoffMs = Number(config.initialBackoffMs || 1000);
    this.maxBackoffMs = Number(config.maxBackoffMs || 30000);
    this.jitterRatio = Number(config.jitterRatio || 0.2);
    this.timeoutMs = Number(config.timeoutMs || 15000);
    this.circuitFailureThreshold = Number(config.circuitFailureThreshold || 5);
    this.circuitCooldownMs = Number(config.circuitCooldownMs || 60000);
    this.pendingRequests = new Map();
    this.endpointQueues = new Map();
    this.endpointState = new Map();
    this.listeners = new Set();
    this.metrics = {
      success: 0,
      failed: 0,
      cached: 0,
      retried: 0,
      deduped: 0,
      queued: 0,
      throttled: 0,
      fallback: 0,
    };
    this.rateLimits = {
      opensky: { maxRequests: 400, windowMs: 60 * 60 * 1000 },
      adsbfi: { maxRequests: 100, windowMs: 60 * 1000 },
    };
  }

  on(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(event) {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {
        // listener failures are non-fatal
      }
    }
  }

  endpointKey(endpoint) {
    return String(endpoint).split('?')[0];
  }

  getEndpointState(endpoint) {
    const key = this.endpointKey(endpoint);
    if (!this.endpointState.has(key)) {
      this.endpointState.set(key, {
        consecutiveFailures: 0,
        circuitOpenUntil: 0,
        retryAfterUntil: 0,
        requestTimes: [],
      });
    }
    return this.endpointState.get(key);
  }

  getRateLimitPolicy(endpoint) {
    const key = String(endpoint).toLowerCase();
    if (key.includes('opensky')) return this.rateLimits.opensky;
    if (key.includes('adsbfi')) return this.rateLimits.adsbfi;
    return null;
  }

  computeBackoffMs(attempt, retryAfterSeconds) {
    if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
      return Math.min(this.maxBackoffMs, retryAfterSeconds * 1000);
    }
    const base = Math.min(this.maxBackoffMs, this.initialBackoffMs * (2 ** attempt));
    const jitter = base * this.jitterRatio;
    const random = (Math.random() * jitter * 2) - jitter;
    return Math.max(0, Math.round(base + random));
  }

  shouldRetry(status, category) {
    if (status === 400) return false;
    if (status === 429) return true;
    if (status >= 500 && status <= 599) return true;
    if (category === 'TIMEOUT' || category === 'NETWORK') return true;
    return false;
  }

  parseHeaders(headers) {
    const parsed = {};
    if (!headers || typeof headers.forEach !== 'function') return parsed;
    headers.forEach((value, key) => {
      parsed[key] = value;
    });
    return parsed;
  }

  parseError(error, response) {
    const retryAfterHeader = response?.headers?.get?.('retry-after');
    const retryAfterAltHeader = response?.headers?.get?.('x-rate-limit-retry-after-seconds');
    const retryAfter = toRetryAfterSeconds(retryAfterHeader || retryAfterAltHeader);
    const status = response?.status;
    let code = status || 'NETWORK';
    let category = 'UNKNOWN';
    let message = error?.message || `HTTP ${status || 'UNKNOWN'}`;

    if (status >= 400 && status <= 499) category = 'CLIENT';
    if (status === 429) category = 'RATE_LIMIT';
    if (status >= 500 && status <= 599) category = 'SERVER';
    if (error?.name === 'AbortError') {
      code = 'TIMEOUT';
      category = 'TIMEOUT';
      message = 'Request timed out';
    } else if (!status) {
      code = 'NETWORK';
      category = 'NETWORK';
      message = 'Network error while reaching API';
    }

    return {
      status: 'error',
      code,
      category,
      message,
      retryAfter,
      timestamp: new Date().toISOString(),
      data: null,
    };
  }

  getQueue(endpoint) {
    const key = this.endpointKey(endpoint);
    if (!this.endpointQueues.has(key)) {
      this.endpointQueues.set(key, { active: 0, items: [] });
    }
    return this.endpointQueues.get(key);
  }

  enqueue(endpoint, task) {
    const key = this.endpointKey(endpoint);
    const queue = this.getQueue(key);
    return new Promise((resolve, reject) => {
      queue.items.push({ task, resolve, reject });
      this.metrics.queued += 1;
      if (queue.items.length > 10) {
        this.emit({ type: 'queue_warning', endpoint: key, queueLength: queue.items.length });
      }
      this.drainQueue(key);
    });
  }

  drainQueue(endpoint) {
    const queue = this.getQueue(endpoint);
    while (queue.active < this.maxConcurrentPerEndpoint && queue.items.length > 0) {
      const next = queue.items.shift();
      queue.active += 1;
      Promise.resolve()
        .then(next.task)
        .then(next.resolve)
        .catch(next.reject)
        .finally(() => {
          queue.active -= 1;
          this.drainQueue(endpoint);
        });
    }
  }

  async enforceRateLimit(endpoint) {
    const state = this.getEndpointState(endpoint);
    const policy = this.getRateLimitPolicy(endpoint);
    const now = Date.now();

    if (state.retryAfterUntil > now) {
      const delay = state.retryAfterUntil - now;
      this.metrics.throttled += 1;
      await sleep(delay);
    }

    if (!policy) return;
    state.requestTimes = state.requestTimes.filter((time) => now - time < policy.windowMs);
    if (state.requestTimes.length >= policy.maxRequests) {
      const earliest = state.requestTimes[0];
      const delay = Math.max(50, policy.windowMs - (now - earliest));
      this.metrics.throttled += 1;
      await sleep(delay);
      return this.enforceRateLimit(endpoint);
    }

    const safeInterval = Math.ceil(policy.windowMs / policy.maxRequests);
    const last = state.requestTimes[state.requestTimes.length - 1];
    if (last && (now - last) < safeInterval) {
      const delay = safeInterval - (now - last);
      this.metrics.throttled += 1;
      await sleep(delay);
    }
  }

  async performFetch(endpoint, options, cacheKey) {
    const endpointState = this.getEndpointState(endpoint);
    const now = Date.now();
    if (endpointState.circuitOpenUntil > now) {
      const fallback = this.cache.getStale(cacheKey, 120000);
      if (fallback != null) {
        this.metrics.cached += 1;
        this.metrics.fallback += 1;
        return {
          status: 'cached_fallback',
          code: 'CIRCUIT_OPEN',
          message: 'Endpoint temporarily unavailable. Serving cached data.',
          retryAfter: Math.ceil((endpointState.circuitOpenUntil - now) / 1000),
          data: fallback,
          isCached: true,
          timestamp: new Date().toISOString(),
        };
      }
      throw {
        status: 'error',
        code: 'CIRCUIT_OPEN',
        message: 'Endpoint temporarily unavailable',
        retryAfter: Math.ceil((endpointState.circuitOpenUntil - now) / 1000),
        data: null,
        timestamp: new Date().toISOString(),
      };
    }

    const retries = this.maxRetries;
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      await this.enforceRateLimit(endpoint);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
      let response;

      try {
        this.emit({ type: 'request_start', endpoint, attempt });
        response = await this.fetchImpl(endpoint, {
          ...options,
          signal: options.signal || controller.signal,
        });
        clearTimeout(timeout);

        if (!response.ok) {
          const error = this.parseError(new Error(`HTTP ${response.status}`), response);
          this.emit({
            type: 'request_failure',
            endpoint,
            status: response.status,
            attempt,
            retryAfter: error.retryAfter,
            message: error.message,
          });
          throw { parsedError: error, response };
        }

        const headers = this.parseHeaders(response.headers);
        const parsedData = options.dataType === 'text'
          ? await response.text()
          : await response.json();

        endpointState.consecutiveFailures = 0;
        endpointState.requestTimes.push(Date.now());
        this.cache.set(cacheKey, parsedData, options.ttlMs, headers);
        this.metrics.success += 1;
        HealthMonitor.reportSuccess();
        this.emit({ type: 'request_success', endpoint, status: response.status, attempt });

        return {
          status: 'success',
          code: response.status,
          message: 'OK',
          retryAfter: null,
          data: parsedData,
          isCached: false,
          timestamp: new Date().toISOString(),
          headers,
        };
      } catch (error) {
        clearTimeout(timeout);
        const parsed = error?.parsedError || this.parseError(error, response);
        const statusCode = Number(parsed.code);
        const canRetry = attempt < retries && this.shouldRetry(statusCode, parsed.category);

        endpointState.consecutiveFailures += 1;
        this.metrics.failed += 1;
        HealthMonitor.reportFailure();

        if (endpointState.consecutiveFailures >= this.circuitFailureThreshold) {
          endpointState.circuitOpenUntil = Date.now() + this.circuitCooldownMs;
          this.emit({ type: 'circuit_open', endpoint });
        }

        if (parsed.retryAfter) {
          endpointState.retryAfterUntil = Date.now() + (parsed.retryAfter * 1000);
        }

        if (canRetry) {
          this.metrics.retried += 1;
          const waitMs = this.computeBackoffMs(attempt, parsed.retryAfter);
          await sleep(waitMs);
          continue;
        }

        const fallback = this.cache.getStale(cacheKey, 120000);
        if (fallback != null) {
          this.metrics.cached += 1;
          this.metrics.fallback += 1;
          return {
            status: 'cached_fallback',
            code: parsed.code,
            message: `${parsed.message}. Using cached data.`,
            retryAfter: parsed.retryAfter,
            data: fallback,
            isCached: true,
            timestamp: new Date().toISOString(),
          };
        }

        throw parsed;
      }
    }

    throw {
      status: 'error',
      code: 'UNKNOWN',
      message: 'Request failed unexpectedly',
      retryAfter: null,
      data: null,
      timestamp: new Date().toISOString(),
    };
  }

  fetch(endpoint, options = {}) {
    const method = (options.method || 'GET').toUpperCase();
    const params = options.params || {};
    const headers = options.headers || {};
    const ttlMs = this.cache.resolveTtl(endpoint, options.ttlMs);
    const cacheKey = options.cacheKey || buildCacheKey(endpoint, params);
    const dedupeKey = `${method}:${cacheKey}:${options.body ? JSON.stringify(options.body) : ''}`;
    const safeLog = {
      endpoint,
      method,
      params: sanitizeForLog(params),
      headers: sanitizeForLog(headers),
    };

    const fresh = options.noCache ? null : this.cache.get(cacheKey);
    if (fresh != null) {
      this.metrics.cached += 1;
      this.emit({ type: 'cache_hit', endpoint });
      return Promise.resolve({
        status: 'success',
        code: 200,
        message: 'CACHE_HIT',
        retryAfter: null,
        data: fresh,
        isCached: true,
        timestamp: new Date().toISOString(),
      });
    }

    if (this.pendingRequests.has(dedupeKey)) {
      this.metrics.deduped += 1;
      this.emit({ type: 'request_deduped', endpoint });
      return this.pendingRequests.get(dedupeKey);
    }

    const queuedPromise = this.enqueue(endpoint, () => this.performFetch(endpoint, {
      ...options,
      method,
      headers,
      ttlMs,
      dataType: options.dataType || 'json',
    }, cacheKey));

    const trackedPromise = queuedPromise
      .catch((error) => {
        this.emit({
          type: 'request_error',
          endpoint,
          status: Number(error.code) || undefined,
          message: error.message || 'Request failed',
        });
        throw error;
      })
      .finally(() => {
        this.pendingRequests.delete(dedupeKey);
      });

    this.pendingRequests.set(dedupeKey, trackedPromise);
    return trackedPromise;
  }

  getQueueLength(endpoint) {
    if (endpoint) return this.getQueue(endpoint).items.length;
    let total = 0;
    for (const queue of this.endpointQueues.values()) total += queue.items.length;
    return total;
  }

  getMetrics() {
    return {
      ...this.metrics,
      queueLength: this.getQueueLength(),
      cache: this.cache.getMetrics(),
    };
  }

  clearCache(pattern) {
    this.cache.clear(pattern);
  }
}

export const cacheManager = new CacheManager();
export const requestManager = new RequestManager({ cache: cacheManager });

export async function robustFetch(url, options = {}, ttlMs = 0, dataType = 'json') {
  const result = await requestManager.fetch(url, {
    ...options,
    ttlMs: ttlMs || undefined,
    dataType,
    params: options.params || {},
  });
  return result.data;
}
