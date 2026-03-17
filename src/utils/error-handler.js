function parseRetryAfter(headers) {
  const retryAfter = headers?.['retry-after'] || headers?.retryAfter || null;
  if (!retryAfter) return null;
  const asNumber = Number.parseInt(retryAfter, 10);
  if (Number.isFinite(asNumber) && asNumber >= 0) return asNumber;
  const asDate = Date.parse(retryAfter);
  if (Number.isNaN(asDate)) return null;
  return Math.max(0, Math.ceil((asDate - Date.now()) / 1000));
}

export function categorizeError(error) {
  const code = error?.code ?? error?.status ?? 'NETWORK';
  if (code === 429) return 'RATE_LIMIT';
  if (code >= 400 && code <= 499) return 'CLIENT';
  if (code >= 500 && code <= 599) return 'SERVER';
  if (code === 'TIMEOUT') return 'TIMEOUT';
  if (code === 'NETWORK') return 'NETWORK';
  return 'UNKNOWN';
}

export function handleError(error, cachedData = null, extra = {}) {
  const category = categorizeError(error);
  const retryAfter = error?.retryAfter ?? parseRetryAfter(error?.headers) ?? null;
  const fallbackAllowed = cachedData !== null && cachedData !== undefined;
  let message = 'Data temporarily unavailable';

  if (category === 'CLIENT') message = 'Request rejected by data provider';
  if (category === 'RATE_LIMIT') message = 'Rate limit reached, retrying shortly';
  if (category === 'SERVER') message = 'Data provider is currently unavailable';
  if (category === 'TIMEOUT') message = 'Request timed out, retrying';
  if (category === 'NETWORK') message = 'Network error while loading data';

  return {
    status: fallbackAllowed ? 'cached_fallback' : 'error',
    code: error?.code ?? error?.status ?? 'NETWORK',
    message,
    retryAfter,
    data: fallbackAllowed ? cachedData : null,
    timestamp: new Date().toISOString(),
    category,
    endpoint: extra.endpoint || null,
  };
}

export function getFreshnessState(timestamp, isCached, isError) {
  if (!timestamp) {
    return { color: 'red', label: isError ? 'Data temporarily unavailable' : 'Loading...' };
  }
  const ageSeconds = Math.max(0, Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000));
  if (isError) return { color: 'red', label: 'Data temporarily unavailable', ageSeconds };
  if (isCached || ageSeconds > 30) return { color: 'yellow', label: `Updated ${ageSeconds}s ago (cached)`, ageSeconds };
  if (ageSeconds < 5) return { color: 'green', label: `Updated ${ageSeconds}s ago`, ageSeconds };
  return { color: 'green', label: `Updated ${ageSeconds}s ago`, ageSeconds };
}

