/**
 * Minimal in-memory TTL cache.
 * No external deps — uses a plain Map with per-entry expiry timestamps.
 * For multi-process deployments replace with Redis; the interface is identical.
 */
const store = new Map();

const get = (key) => {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) { store.delete(key); return null; }
  return entry.value;
};

const set = (key, value, ttlSeconds = 60) => {
  store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
};

const del = (key) => store.delete(key);

// Invalidate all keys that start with a given prefix (e.g. "dashboard:")
const delByPrefix = (prefix) => {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
};

// Evict expired entries — call from a low-frequency interval if needed
const purgeExpired = () => {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (now > entry.expiresAt) store.delete(key);
  }
};

module.exports = { get, set, del, delByPrefix, purgeExpired };
