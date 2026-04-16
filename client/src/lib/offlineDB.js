/**
 * IndexedDB abstraction for offline POS data.
 * No external dependencies — raw IndexedDB API.
 *
 * DB: multishop-offline  v2
 * Stores:
 *   pending_sales  — offline bills waiting to sync
 *   products_cache — product list for offline billing
 *   _cache_meta    — cache freshness metadata (TTL tracking)
 */

const DB_NAME    = 'multishop-offline';
const DB_VERSION = 2;                   // bump from 1 → adds _cache_meta store

const PRODUCT_TTL_MS = 5 * 60 * 1000;  // 5-minute product cache TTL

let _db = null;

function openDB() {
  if (_db) return Promise.resolve(_db);

  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db         = e.target.result;
      const oldVersion = e.oldVersion;

      // ── v1 stores (create if fresh install) ─────────────────────────────────
      if (oldVersion < 1) {
        if (!db.objectStoreNames.contains('pending_sales')) {
          const store = db.createObjectStore('pending_sales', { keyPath: 'offlineId' });
          store.createIndex('syncStatus', 'syncStatus', { unique: false });
          store.createIndex('shopId',     'shopId',     { unique: false });
          store.createIndex('createdAt',  'createdAt',  { unique: false });
        }

        if (!db.objectStoreNames.contains('products_cache')) {
          const store = db.createObjectStore('products_cache', { keyPath: '_id' });
          store.createIndex('shopId', 'shopId', { unique: false });
        }
      }

      // ── v2 stores ────────────────────────────────────────────────────────────
      if (oldVersion < 2) {
        // Per-shop cache metadata — tracks when products were last fetched
        if (!db.objectStoreNames.contains('_cache_meta')) {
          db.createObjectStore('_cache_meta', { keyPath: 'shopId' });
        }
      }
    };

    req.onsuccess = (e) => { _db = e.target.result; resolve(_db); };
    req.onerror   = ()  => reject(req.error);
  });
}

// ── Generic helpers ───────────────────────────────────────────────────────────

function tx(storeName, mode, fn) {
  return openDB().then((db) => new Promise((resolve, reject) => {
    const t = db.transaction(storeName, mode);
    const s = t.objectStore(storeName);
    let result;
    try { result = fn(s); } catch (err) { reject(err); return; }
    t.oncomplete = () => resolve(result?.result ?? result);
    t.onerror    = () => reject(t.error);
    t.onabort    = () => reject(new Error('Transaction aborted'));
  }));
}

function idbGetAll(store, indexName, query) {
  return new Promise((resolve, reject) => {
    const src = indexName ? store.index(indexName) : store;
    const req  = query !== undefined ? src.getAll(query) : src.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

function idbCount(store, indexName, query) {
  return new Promise((resolve, reject) => {
    const src = indexName ? store.index(indexName) : store;
    const req  = query !== undefined ? src.count(query) : src.count();
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

// ── pending_sales ─────────────────────────────────────────────────────────────

/** Save a new offline sale. Must include offlineId. */
export async function addPendingSale(sale) {
  return tx('pending_sales', 'readwrite', (s) => s.add(sale));
}

/** All sales with syncStatus === 'pending', sorted oldest-first (FIFO). */
export async function getPendingSales() {
  return openDB().then((db) => new Promise((resolve, reject) => {
    const t = db.transaction('pending_sales', 'readonly');
    idbGetAll(t.objectStore('pending_sales'), 'syncStatus', 'pending')
      .then((rows) => {
        // FIFO: oldest createdAt first — critical for stock consistency
        rows.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        resolve(rows);
      })
      .catch(reject);
  }));
}

/** All sales regardless of status — used by the sync status panel. */
export async function getAllPendingSales() {
  const rows = await tx('pending_sales', 'readonly', (s) => s.getAll());
  rows.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  return rows;
}

/** Merge updates into an existing record. */
export async function updatePendingSale(offlineId, updates) {
  return openDB().then((db) => new Promise((resolve, reject) => {
    const t   = db.transaction('pending_sales', 'readwrite');
    const s   = t.objectStore('pending_sales');
    const get = s.get(offlineId);
    get.onsuccess = () => {
      if (!get.result) { resolve(null); return; }
      const merged = { ...get.result, ...updates };
      const put    = s.put(merged);
      put.onsuccess = () => resolve(merged);
      put.onerror   = () => reject(put.error);
    };
    get.onerror = () => reject(get.error);
  }));
}

/** Hard-delete a sale from local DB (after confirmed sync). */
export async function deletePendingSale(offlineId) {
  return tx('pending_sales', 'readwrite', (s) => s.delete(offlineId));
}

/** Count of pending (not-yet-synced) sales. */
export async function countPendingSales() {
  return openDB().then((db) => new Promise((resolve, reject) => {
    const t = db.transaction('pending_sales', 'readonly');
    idbCount(t.objectStore('pending_sales'), 'syncStatus', 'pending')
      .then(resolve).catch(reject);
  }));
}

/** Count of sales that permanently failed (3+ attempts). */
export async function countFailedSales() {
  return openDB().then((db) => new Promise((resolve, reject) => {
    const t = db.transaction('pending_sales', 'readonly');
    idbCount(t.objectStore('pending_sales'), 'syncStatus', 'failed')
      .then(resolve).catch(reject);
  }));
}

/**
 * Reset failed sales back to 'pending' with attempts = 0 for a retry.
 * Returns the count of records reset.
 */
export async function resetFailedSales() {
  return openDB().then((db) => new Promise((resolve, reject) => {
    const t       = db.transaction('pending_sales', 'readwrite');
    const store   = t.objectStore('pending_sales');
    const index   = store.index('syncStatus');
    const req     = index.openCursor('failed');
    let   count   = 0;

    req.onsuccess = (e) => {
      const cursor = e.target.result;
      if (!cursor) { resolve(count); return; }
      cursor.update({ ...cursor.value, syncStatus: 'pending', attempts: 0 });
      count++;
      cursor.continue();
    };
    req.onerror = () => reject(req.error);
  }));
}

/**
 * Compute offline analytics for a given shop from local data.
 * Used to show real-time stats while offline.
 */
export async function getLocalAnalytics(shopId) {
  const all = await getAllPendingSales();
  const shopSales = shopId ? all.filter((s) => s.shopId === shopId) : all;

  const pending = shopSales.filter((s) => s.syncStatus === 'pending');
  const failed  = shopSales.filter((s) => s.syncStatus === 'failed');
  const synced  = shopSales.filter((s) => s.syncStatus === 'synced');

  // Daily revenue (today, local time)
  const todayKey = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD
  const todaySales = shopSales.filter((s) => {
    const day = new Date(s.createdAt).toLocaleDateString('en-CA');
    return day === todayKey;
  });

  const totalItems   = pending.reduce((sum, s) => sum + (s.items?.length || 0), 0);
  const totalRevenue = pending.reduce((sum, s) => sum + (s.totalAmount || 0), 0);
  const todayRevenue = todaySales.reduce((sum, s) => sum + (s.totalAmount || 0), 0);

  return {
    pendingCount: pending.length,
    failedCount:  failed.length,
    syncedCount:  synced.length,
    totalItems,
    totalRevenue: +totalRevenue.toFixed(2),
    todayRevenue: +todayRevenue.toFixed(2),
    todaySalesCount: todaySales.length,
  };
}

/**
 * Export all offline data as a plain JS object.
 * Used for the "Download backup" safety feature.
 */
export async function exportAllData() {
  const [sales, products] = await Promise.all([
    getAllPendingSales(),
    tx('products_cache', 'readonly', (s) => s.getAll()),
  ]);
  return {
    exportedAt: new Date().toISOString(),
    version:    DB_VERSION,
    sales,
    products,
  };
}

// ── products_cache ────────────────────────────────────────────────────────────

/**
 * Write products + update cache metadata timestamp.
 * Existing products for the shop are wiped first (replace, not merge).
 */
export async function cacheProducts(shopId, products) {
  return openDB().then((db) => new Promise((resolve, reject) => {
    // Two-store transaction: products_cache + _cache_meta
    const t = db.transaction(['products_cache', '_cache_meta'], 'readwrite');
    const ps = t.objectStore('products_cache');
    const ms = t.objectStore('_cache_meta');

    // Clear existing cached products for this shop
    const index   = ps.index('shopId');
    const delReq  = index.openCursor(shopId);
    delReq.onsuccess = (e) => {
      const cursor = e.target.result;
      if (cursor) { cursor.delete(); cursor.continue(); }
    };

    // Re-write all products
    products.forEach((p) => ps.put({ ...p, shopId: p.shopId || shopId }));

    // Update TTL metadata
    ms.put({ shopId, cachedAt: Date.now(), count: products.length });

    t.oncomplete = () => resolve();
    t.onerror    = () => reject(t.error);
  }));
}

/** Read cached products for a shop. Returns [] if none. */
export async function getCachedProducts(shopId) {
  return openDB().then((db) => new Promise((resolve, reject) => {
    const t = db.transaction('products_cache', 'readonly');
    idbGetAll(t.objectStore('products_cache'), 'shopId', shopId)
      .then(resolve).catch(reject);
  }));
}

/**
 * Check if the product cache for a shop is stale.
 * Returns { isStale, ageMs, cachedAt }.
 */
export async function getProductCacheStatus(shopId) {
  return openDB().then((db) => new Promise((resolve) => {
    const t   = db.transaction('_cache_meta', 'readonly');
    const req = t.objectStore('_cache_meta').get(shopId);
    req.onsuccess = () => {
      const meta  = req.result;
      if (!meta) { resolve({ isStale: true, ageMs: Infinity, cachedAt: null }); return; }
      const ageMs = Date.now() - meta.cachedAt;
      resolve({ isStale: ageMs > PRODUCT_TTL_MS, ageMs, cachedAt: new Date(meta.cachedAt) });
    };
    req.onerror = () => resolve({ isStale: true, ageMs: Infinity, cachedAt: null });
  }));
}

/** Wipe the entire product cache for a shop. */
export async function clearProductCache(shopId) {
  return openDB().then((db) => new Promise((resolve, reject) => {
    const t  = db.transaction(['products_cache', '_cache_meta'], 'readwrite');
    const ps = t.objectStore('products_cache');
    const ms = t.objectStore('_cache_meta');

    const index  = ps.index('shopId');
    const delReq = index.openCursor(shopId);
    delReq.onsuccess = (e) => {
      const cursor = e.target.result;
      if (cursor) { cursor.delete(); cursor.continue(); }
    };

    if (shopId) ms.delete(shopId); else ms.clear();

    t.oncomplete = () => resolve();
    t.onerror    = () => reject(t.error);
  }));
}
