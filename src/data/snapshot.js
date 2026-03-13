// Simple IndexedDB wrapper for caching WorldView states

const DB_NAME = 'WorldViewDB';
const DB_VERSION = 1;
const STORE_NAME = 'snapshots';

let db;

export async function initDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = (event) => reject(event.target.error);

        request.onsuccess = (event) => {
            db = event.target.result;
            resolve(db);
        };

        request.onupgradeneeded = (event) => {
            const database = event.target.result;
            if (!database.objectStoreNames.contains(STORE_NAME)) {
                database.createObjectStore(STORE_NAME, { keyPath: 'timestamp' });
            }
        };
    });
}

// Save a snapshot of flights and stats
export async function saveSnapshot(timestamp, data) {
    if (!db) await initDatabase();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);

        const request = store.put({
            timestamp: timestamp,
            state: data
        });

        request.onsuccess = () => resolve();
        request.onerror = (e) => reject(e.target.error);
    });
}

// Retrieve snapshots between two times
export async function getSnapshots(startTime, endTime) {
    if (!db) await initDatabase();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const range = IDBKeyRange.bound(startTime, endTime);

        const request = store.getAll(range);

        request.onsuccess = (event) => resolve(event.target.result);
        request.onerror = (e) => reject(e.target.error);
    });
}
