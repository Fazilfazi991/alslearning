export type RecordingPart = { partNumber: number; bytes: Uint8Array; final: boolean };

/**
 * Converts irregular MediaRecorder byte events into fixed-size R2 parts while
 * preserving the byte stream exactly. Only the final part may be smaller.
 */
export class FixedPartAssembler {
  private chunks: Uint8Array[] = [];
  private bufferedBytes = 0;
  private nextPartNumber = 1;

  constructor(readonly partSize: number) {
    if (!Number.isSafeInteger(partSize) || partSize < 5 * 1024 * 1024) throw new Error("Multipart part size must be at least 5 MiB");
  }

  get pendingBytes() { return this.bufferedBytes; }

  push(bytes: Uint8Array): RecordingPart[] {
    if (bytes.byteLength) {
      this.chunks.push(bytes.slice());
      this.bufferedBytes += bytes.byteLength;
    }
    const ready: RecordingPart[] = [];
    while (this.bufferedBytes >= this.partSize) ready.push(this.take(this.partSize, false));
    return ready;
  }

  finish(): RecordingPart[] {
    return this.bufferedBytes ? [this.take(this.bufferedBytes, true)] : [];
  }

  private take(length: number, final: boolean): RecordingPart {
    const output = new Uint8Array(length);
    let offset = 0;
    while (offset < length) {
      const source = this.chunks[0];
      const count = Math.min(source.byteLength, length - offset);
      output.set(source.subarray(0, count), offset);
      offset += count;
      if (count === source.byteLength) this.chunks.shift();
      else this.chunks[0] = source.slice(count);
    }
    this.bufferedBytes -= length;
    return { partNumber: this.nextPartNumber++, bytes: output, final };
  }
}

export async function sha256Hex(bytes: Uint8Array) {
  const digest = await crypto.subtle.digest("SHA-256", bytes as BufferSource);
  return [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, "0")).join("");
}
