const DB_NAME = 'calendar-offline';
const DB_VERSION = 1;

export const IDB_STORES = {
  snapshots: 'snapshots',
  syncQueue: 'syncQueue',
  detoxPlan: 'detoxPlan',
} as const;

type StoreName = (typeof IDB_STORES)[keyof typeof IDB_STORES];

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error ?? new Error('Failed to open IndexedDB'));
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(IDB_STORES.snapshots)) {
        db.createObjectStore(IDB_STORES.snapshots);
      }

      if (!db.objectStoreNames.contains(IDB_STORES.syncQueue)) {
        db.createObjectStore(IDB_STORES.syncQueue, { keyPath: 'id', autoIncrement: true });
      }

      if (!db.objectStoreNames.contains(IDB_STORES.detoxPlan)) {
        db.createObjectStore(IDB_STORES.detoxPlan);
      }
    };
  });
}

export async function idbGet<T>(storeName: StoreName, key: IDBValidKey): Promise<T | undefined> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.get(key);

    request.onerror = () => reject(request.error ?? new Error(`idbGet failed: ${storeName}`));
    request.onsuccess = () => resolve(request.result as T | undefined);
    transaction.oncomplete = () => db.close();
    transaction.onerror = () => reject(transaction.error ?? new Error(`idbGet transaction failed: ${storeName}`));
  });
}

export async function idbPut<T>(storeName: StoreName, value: T, key?: IDBValidKey): Promise<void> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = key === undefined ? store.put(value) : store.put(value, key);

    request.onerror = () => reject(request.error ?? new Error(`idbPut failed: ${storeName}`));
    request.onsuccess = () => resolve();
    transaction.oncomplete = () => db.close();
    transaction.onerror = () => reject(transaction.error ?? new Error(`idbPut transaction failed: ${storeName}`));
  });
}

export async function idbDelete(storeName: StoreName, key: IDBValidKey): Promise<void> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.delete(key);

    request.onerror = () => reject(request.error ?? new Error(`idbDelete failed: ${storeName}`));
    request.onsuccess = () => resolve();
    transaction.oncomplete = () => db.close();
    transaction.onerror = () => reject(transaction.error ?? new Error(`idbDelete transaction failed: ${storeName}`));
  });
}

export async function idbGetAll<T>(storeName: StoreName): Promise<T[]> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.getAll();

    request.onerror = () => reject(request.error ?? new Error(`idbGetAll failed: ${storeName}`));
    request.onsuccess = () => resolve((request.result ?? []) as T[]);
    transaction.oncomplete = () => db.close();
    transaction.onerror = () => reject(transaction.error ?? new Error(`idbGetAll transaction failed: ${storeName}`));
  });
}

export async function idbClear(storeName: StoreName): Promise<void> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.clear();

    request.onerror = () => reject(request.error ?? new Error(`idbClear failed: ${storeName}`));
    request.onsuccess = () => resolve();
    transaction.oncomplete = () => db.close();
    transaction.onerror = () => reject(transaction.error ?? new Error(`idbClear transaction failed: ${storeName}`));
  });
}
