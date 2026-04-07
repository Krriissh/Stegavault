/**
 * StegaVault – IndexedDB Storage
 *
 * Persists operation history locally.  No sensitive data (keys, plaintext)
 * is ever stored – only metadata and the output stego image blob.
 *
 * Schema:
 *   DB name : "StegaVaultDB"
 *   Version : 1
 *   Store   : "history"
 *     id         : auto-increment
 *     filename   : string
 *     operation  : 'embed' | 'extract' | 'analyze'
 *     timestamp  : ISO-8601 string
 *     status     : 'success' | 'error'
 *     stegoBlob  : Blob | null   (only for embed operations)
 *     meta       : object        (operation-specific metadata)
 */

const DB_NAME    = 'StegaVaultDB';
const DB_VERSION = 1;
const STORE_NAME = 'history';

// ─── Internal helpers ─────────────────────────────────────────────────────────

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (event) => {
      const db    = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
        store.createIndex('timestamp', 'timestamp', { unique: false });
        store.createIndex('operation', 'operation', { unique: false });
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

function withStore(mode, fn) {
  return openDB().then(db =>
    new Promise((resolve, reject) => {
      const tx    = db.transaction(STORE_NAME, mode);
      const store = tx.objectStore(STORE_NAME);
      const req   = fn(store);
      if (req) {
        req.onsuccess = () => resolve(req.result);
        req.onerror   = () => reject(req.error);
      }
      tx.oncomplete = () => { if (!req) resolve(); };
      tx.onerror    = () => reject(tx.error);
    })
  );
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Saves an operation entry to history.
 *
 * @param {{
 *   filename  : string,
 *   operation : 'embed'|'extract'|'analyze',
 *   status    : 'success'|'error',
 *   stegoBlob : Blob|null,
 *   meta      : object,
 * }} entry
 * @returns {Promise<number>}  The auto-generated id
 */
export async function saveHistory(entry) {
  return withStore('readwrite', store =>
    store.add({ ...entry, timestamp: new Date().toISOString() })
  );
}

/**
 * Retrieves all history entries, sorted newest-first.
 * @returns {Promise<Array>}
 */
export async function getAllHistory() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx      = db.transaction(STORE_NAME, 'readonly');
    const store   = tx.objectStore(STORE_NAME);
    const index   = store.index('timestamp');
    const req     = index.getAll();
    req.onsuccess = () => resolve((req.result ?? []).reverse());
    req.onerror   = () => reject(req.error);
  });
}

/**
 * Deletes a single history entry by id.
 * @param {number} id
 */
export async function deleteHistory(id) {
  return withStore('readwrite', store => store.delete(id));
}

/**
 * Clears all history.
 */
export async function clearHistory() {
  return withStore('readwrite', store => store.clear());
}

/**
 * Retrieves a single entry by id.
 * @param {number} id
 */
export async function getHistoryEntry(id) {
  return withStore('readonly', store => store.get(id));
}
