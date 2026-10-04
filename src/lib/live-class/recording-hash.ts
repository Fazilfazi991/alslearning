const HASH_CHUNK_BYTES = 2 * 1024 * 1024;

type Response = { id: number; digest?: string; error?: string };
type Request =
  | { id: number; type: "init" }
  | { id: number; type: "chunk"; sequence: number; bytes: ArrayBuffer }
  | { id: number; type: "finish" };

export function hashRecordingBlob(
  blob: Blob,
  options: { signal?: AbortSignal; onProgress?: (bytes: number) => void; createWorker?: () => Worker } = {},
) {
  const worker = options.createWorker?.() || new Worker("/recording-hash.worker.js");
  let nextId = 0;
  let pending: { id: number; resolve: (response: Response) => void; reject: (error: Error) => void } | null = null;
  const aborted = () => new DOMException("Recording hash cancelled", "AbortError");
  const onAbort = () => pending?.reject(aborted());
  options.signal?.addEventListener("abort", onAbort, { once: true });
  worker.onmessage = (event: MessageEvent<Response>) => {
    if (!pending || event.data.id !== pending.id) return;
    const current = pending;
    pending = null;
    if (event.data.error) current.reject(new Error(event.data.error));
    else current.resolve(event.data);
  };
  worker.onerror = () => pending?.reject(new Error("Recording hash worker failed"));

  const exchange = (message: Request, transfer: Transferable[] = []) => new Promise<Response>((resolve, reject) => {
    if (options.signal?.aborted) return reject(aborted());
    pending = { id: message.id, resolve, reject };
    try { worker.postMessage(message, transfer); }
    catch (reason) { pending = null; reject(reason); }
  });

  return (async () => {
    try {
      await exchange({ id: nextId++, type: "init" });
      let sequence = 0;
      for (let offset = 0; offset < blob.size; offset += HASH_CHUNK_BYTES) {
        if (options.signal?.aborted) throw aborted();
        const bytes = await blob.slice(offset, offset + HASH_CHUNK_BYTES).arrayBuffer();
        if (options.signal?.aborted) throw aborted();
        await exchange({ id: nextId++, type: "chunk", sequence: sequence++, bytes }, [bytes]);
        options.onProgress?.(Math.min(offset + HASH_CHUNK_BYTES, blob.size));
      }
      const result = await exchange({ id: nextId++, type: "finish" });
      if (!/^[0-9a-f]{64}$/.test(result.digest || "")) throw new Error("Recording hash worker returned an invalid digest");
      return result.digest!;
    } finally {
      options.signal?.removeEventListener("abort", onAbort);
      worker.terminate();
    }
  })();
}
