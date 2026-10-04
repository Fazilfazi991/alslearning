import { sha256 } from "@noble/hashes/sha2.js";

/** Incremental full-file digest; rejects missing, duplicated, or reordered pieces. */
export class OrderedRecordingSha256 {
  private readonly hash = sha256.create();
  private nextSequence = 0;
  private finished = false;

  update(sequence: number, bytes: Uint8Array) {
    if (this.finished || sequence !== this.nextSequence || !bytes.byteLength) {
      throw new Error("Recording hash chunks must be nonempty and in order");
    }
    this.hash.update(bytes);
    this.nextSequence += 1;
  }

  digest() {
    if (this.finished) throw new Error("Recording hash was already finalized");
    this.finished = true;
    return Array.from(this.hash.digest(), value => value.toString(16).padStart(2, "0")).join("");
  }
}
