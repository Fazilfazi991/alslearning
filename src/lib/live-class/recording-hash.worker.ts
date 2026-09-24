import { OrderedRecordingSha256 } from "./recording-hash-core";

type Request =
  | { id: number; type: "init" }
  | { id: number; type: "chunk"; sequence: number; bytes: ArrayBuffer }
  | { id: number; type: "finish" };

const scope = self as unknown as Worker;
let hasher: OrderedRecordingSha256 | null = null;
scope.onmessage = (event: MessageEvent<Request>) => {
  const request = event.data;
  try {
    if (request.type === "init") hasher = new OrderedRecordingSha256();
    else if (!hasher) throw new Error("Recording hash was not initialized");
    else if (request.type === "chunk") hasher.update(request.sequence, new Uint8Array(request.bytes));
    else {
      const digest = hasher.digest();
      hasher = null;
      scope.postMessage({ id: request.id, digest });
      return;
    }
    scope.postMessage({ id: request.id });
  } catch (reason) {
    scope.postMessage({ id: request.id, error: reason instanceof Error ? reason.message : "Recording hash failed" });
  }
};
