// utils/contextCache.ts
const cache = new Map();
// key: `${agentId}:${clientId}` => { value: string, ts: number }

export async function getCachedClientContext(agentId, clientId, fetcher) {
  if (!clientId) return "";
  const key = `${agentId}:${clientId}`;
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && now - hit.ts < 120_000) return hit.value;
  const value = await fetcher();
  cache.set(key, { value, ts: now });
  return value;
}
