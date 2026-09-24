"use client";

export type StoredRecordingChunk = {
  id: string;
  segmentId: string;
  recordingId: string;
  sequence: number;
  mimeType: string;
  bytes: Blob;
  createdAt: string;
};
export type StoredRecordingRecovery = {
  segmentId: string;
  recordingId: string;
  classId: string;
  title: string;
  mimeType: string;
  partSize: number;
  status: "recording" | "uploading" | "interrupted" | "validating" | "failed";
  updatedAt: string;
};

const DB_NAME = "als-live-recording-v1";
const DB_VERSION = 1;

function database() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error || new Error("Recording storage could not be opened"));
    request.onupgradeneeded = () => {
      const db = request.result;
      const chunks = db.createObjectStore("chunks", { keyPath: "id" });
      chunks.createIndex("segment", "segmentId", { unique: false });
      db.createObjectStore("recoveries", { keyPath: "segmentId" });
    };
    request.onsuccess = () => resolve(request.result);
  });
}

async function transaction<T>(storeName: "chunks" | "recoveries", mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>) {
  const db = await database();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const request = action(tx.objectStore(storeName));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Recording storage operation failed"));
    tx.oncomplete = () => db.close();
    tx.onerror = () => reject(tx.error || new Error("Recording storage transaction failed"));
  });
}

export function saveRecordingChunk(chunk: StoredRecordingChunk) {
  return transaction("chunks", "readwrite", store => store.put(chunk));
}

export function saveRecordingRecovery(recovery: StoredRecordingRecovery) {
  return transaction("recoveries", "readwrite", store => store.put(recovery));
}

export function listRecordingRecoveries() {
  return transaction<StoredRecordingRecovery[]>("recoveries", "readonly", store => store.getAll());
}

export async function listRecordingChunks(segmentId: string) {
  const db = await database();
  return new Promise<StoredRecordingChunk[]>((resolve, reject) => {
    const tx = db.transaction("chunks", "readonly");
    const request = tx.objectStore("chunks").index("segment").getAll(IDBKeyRange.only(segmentId));
    request.onsuccess = () => resolve((request.result as StoredRecordingChunk[]).sort((a, b) => a.sequence - b.sequence));
    request.onerror = () => reject(request.error || new Error("Recovery chunks could not be read"));
    tx.oncomplete = () => db.close();
  });
}

export async function downloadRecoveredSegment(segmentId: string) {
  const chunks = await listRecordingChunks(segmentId);
  if (!chunks.length) throw new Error("No recoverable recording data was found");
  const blob = new Blob(chunks.map(chunk => chunk.bytes), { type: chunks[0].mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `als-recovered-${segmentId}.${chunks[0].mimeType.includes("mp4") ? "mp4" : "webm"}`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

export async function deleteRecordingRecovery(segmentId: string) {
  const db = await database();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(["chunks", "recoveries"], "readwrite");
    const chunkStore = tx.objectStore("chunks");
    const cursor = chunkStore.index("segment").openKeyCursor(IDBKeyRange.only(segmentId));
    cursor.onsuccess = () => {
      const value = cursor.result;
      if (value) { chunkStore.delete(value.primaryKey); value.continue(); }
    };
    tx.objectStore("recoveries").delete(segmentId);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error || new Error("Recording recovery cleanup failed")); };
  });
}

export function acquireRecordingOwnership(classId: string) {
  const locks = navigator.locks;
  if (!locks) return Promise.resolve({ acquired: false, release: () => undefined });
  let release!: () => void;
  let settle!: (value: boolean) => void;
  const acquired = new Promise<boolean>(resolve => { settle = resolve; });
  const hold = new Promise<void>(resolve => { release = resolve; });
  const completion = locks.request(`als-recording:${classId}`, { ifAvailable: true }, async lock => {
    settle(Boolean(lock));
    if (lock) await hold;
  });
  return acquired.then(value => ({ acquired: value, release: () => { release(); void completion; } }));
}
