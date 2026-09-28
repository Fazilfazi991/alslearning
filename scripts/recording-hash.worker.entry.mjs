import { sha256 } from "@noble/hashes/sha2.js";

// This is bundled into one public asset because the hosting platform does not
// serve webpack's separately emitted Worker chunk.
let hash = null;
let nextSequence = 0;

self.onmessage = ({ data }) => {
  try {
    if (data.type === "init") {
      hash = sha256.create();
      nextSequence = 0;
    } else if (!hash) {
      throw new Error("Recording hash was not initialized");
    } else if (data.type === "chunk") {
      const bytes = new Uint8Array(data.bytes);
      if (data.sequence !== nextSequence || !bytes.byteLength) {
        throw new Error("Recording hash chunks must be nonempty and in order");
      }
      hash.update(bytes);
      nextSequence += 1;
    } else if (data.type === "finish") {
      const digest = Array.from(hash.digest(), value => value.toString(16).padStart(2, "0")).join("");
      hash = null;
      self.postMessage({ id: data.id, digest });
      return;
    } else {
      throw new Error("Unknown recording hash request");
    }
    self.postMessage({ id: data.id });
  } catch (reason) {
    self.postMessage({ id: data.id, error: reason instanceof Error ? reason.message : "Recording hash failed" });
  }
};
