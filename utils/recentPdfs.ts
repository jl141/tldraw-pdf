import type { PdfFileHandle, RecentPdf } from "../types/pdfTypes";

const DB_NAME = "pdf-editor-recent";
const STORE = "recent";
const TLDRAW_DB_PREFIX = "TLDRAW_DOCUMENT_v2";

export const canPersistFiles = "showOpenFilePicker" in window;

export async function pickPdfHandle(): Promise<PdfFileHandle | null> {
  try {
    const [handle] = await (window as any).showOpenFilePicker({
      types: [{ description: "PDF", accept: { "application/pdf": [".pdf"] } }],
    });
    return handle;
  } catch (e) {
    if ((e as DOMException).name === "AbortError") return null;
    throw e;
  }
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () =>
      req.result.createObjectStore(STORE, { keyPath: "id" });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
) {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const req = run(db.transaction(STORE, mode).objectStore(STORE));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

export async function listRecentPdfs(): Promise<RecentPdf[]> {
  const all = await tx<RecentPdf[]>("readonly", (s) => s.getAll());
  return all.sort((a, b) => b.lastOpened - a.lastOpened);
}

// Reuses the existing id when the same file was opened before, so its annotations are found again.
export async function saveRecentPdf(handle: PdfFileHandle): Promise<string> {
  let id: string = crypto.randomUUID();
  for (const recent of await listRecentPdfs()) {
    if (await recent.handle.isSameEntry(handle)) {
      id = recent.id;
      break;
    }
  }
  await tx("readwrite", (s) =>
    s.put({
      id,
      name: handle.name,
      handle,
      lastOpened: Date.now(),
    } satisfies RecentPdf),
  );
  return id;
}

export async function forgetRecentPdf(id: string) {
  await tx("readwrite", (s) => s.delete(id));
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase(TLDRAW_DB_PREFIX + id);
    req.onsuccess = req.onerror = req.onblocked = () => resolve();
  });
}
