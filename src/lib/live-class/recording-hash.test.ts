import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { OrderedRecordingSha256 } from "./recording-hash-core";
import { hashRecordingBlob } from "./recording-hash";

class HashWorkerStub {
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  terminated = false;
  private hash: OrderedRecordingSha256 | null = null;

  postMessage(request: { id: number; type: string; sequence?: number; bytes?: ArrayBuffer }) {
    queueMicrotask(() => {
      try {
        if (request.type === "init") this.hash = new OrderedRecordingSha256();
        else if (request.type === "chunk") this.hash!.update(request.sequence!, new Uint8Array(request.bytes!));
        else if (request.type === "finish") {
          this.onmessage?.({ data: { id: request.id, digest: this.hash!.digest() } } as MessageEvent);
          return;
        }
        this.onmessage?.({ data: { id: request.id } } as MessageEvent);
      } catch (reason) {
        this.onmessage?.({ data: { id: request.id, error: String(reason) } } as MessageEvent);
      }
    });
  }

  terminate() { this.terminated = true; }
}

describe("recording full-file hash", () => {
  it("matches Node SHA-256 across irregular ordered chunks", () => {
    const bytes = new Uint8Array(5 * 1024 * 1024 + 37);
    for (let i = 0; i < bytes.length; i++) bytes[i] = (i * 73 + (i >>> 8)) & 255;
    const hash = new OrderedRecordingSha256();
    hash.update(0, bytes.subarray(0, 3));
    hash.update(1, bytes.subarray(3, 2 * 1024 * 1024 + 1));
    hash.update(2, bytes.subarray(2 * 1024 * 1024 + 1));
    expect(hash.digest()).toBe(createHash("sha256").update(bytes).digest("hex"));
    expect(() => hash.digest()).toThrow(/finalized/);
    expect(() => hash.update(3, bytes)).toThrow(/in order/);
  });

  it("rejects skipped and duplicate chunks", () => {
    const hash = new OrderedRecordingSha256();
    expect(() => hash.update(1, new Uint8Array([1]))).toThrow(/in order/);
    hash.update(0, new Uint8Array([1]));
    expect(() => hash.update(0, new Uint8Array([2]))).toThrow(/in order/);
    expect(() => hash.update(1, new Uint8Array())).toThrow(/nonempty/);
  });

  it("streams bounded slices and reports progress without dropping bytes", async () => {
    const bytes = new Uint8Array(5 * 1024 * 1024 + 7).fill(42);
    const worker = new HashWorkerStub();
    const progress: number[] = [];
    const digest = await hashRecordingBlob(new Blob([bytes]), {
      createWorker: () => worker as unknown as Worker,
      onProgress: value => progress.push(value),
    });
    expect(digest).toBe(createHash("sha256").update(bytes).digest("hex"));
    expect(progress).toEqual([2 * 1024 * 1024, 4 * 1024 * 1024, bytes.length]);
    expect(worker.terminated).toBe(true);
  });

  it("cancels before reading the next slice and terminates the worker", async () => {
    const controller = new AbortController();
    const worker = new HashWorkerStub();
    const blob = new Blob([new Uint8Array(5 * 1024 * 1024)]);
    await expect(hashRecordingBlob(blob, {
      createWorker: () => worker as unknown as Worker,
      signal: controller.signal,
      onProgress: () => controller.abort(),
    })).rejects.toMatchObject({ name: "AbortError" });
    expect(worker.terminated).toBe(true);
    expect(blob.size).toBe(5 * 1024 * 1024);
  });

  it("surfaces a worker error without consuming the source Blob", async () => {
    const worker = new HashWorkerStub();
    worker.postMessage = request => queueMicrotask(() => worker.onmessage?.({
      data: { id: request.id, error: "hash failure" },
    } as MessageEvent));
    const blob = new Blob([new Uint8Array([1, 2, 3])]);
    await expect(hashRecordingBlob(blob, { createWorker: () => worker as unknown as Worker })).rejects.toThrow("hash failure");
    expect(worker.terminated).toBe(true);
    expect(new Uint8Array(await blob.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
  });
});
