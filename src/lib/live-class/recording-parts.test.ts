import { describe, expect, it } from "vitest";
import { reconcileMultipartState, validateMultipartCompletion } from "./recording-parts";

const size = 8 * 1024 * 1024;
const sha = "a".repeat(64);

describe("validateMultipartCompletion", () => {
  it("accepts out-of-order acknowledgements while preserving ordered completion", () => {
    const value = validateMultipartCompletion([
      { partNumber: 2, etag: '"two"', byteLength: 17, sha256: sha },
      { partNumber: 1, etag: '"one"', byteLength: size, sha256: sha },
    ], [
      { partNumber: 1, etag: '"one"', byteLength: size },
      { partNumber: 2, etag: '"two"', byteLength: 17 },
    ], size);
    expect(value.ordered.map(part => part.partNumber)).toEqual([1, 2]);
    expect(value.totalBytes).toBe(size + 17);
  });

  it("rejects a small non-final part", () => {
    expect(() => validateMultipartCompletion([
      { partNumber: 1, etag: '"one"', byteLength: 12, sha256: sha },
      { partNumber: 2, etag: '"two"', byteLength: 12, sha256: sha },
    ], [
      { partNumber: 1, etag: '"one"', byteLength: 12 },
      { partNumber: 2, etag: '"two"', byteLength: 12 },
    ], size)).toThrow("non-final");
  });

  it("rejects missing, duplicate, or mismatched provider parts", () => {
    expect(() => validateMultipartCompletion([
      { partNumber: 1, etag: '"one"', byteLength: size, sha256: sha },
      { partNumber: 1, etag: '"one"', byteLength: 1, sha256: sha },
    ], [{ partNumber: 1, etag: '"one"', byteLength: size }], size)).toThrow();
    expect(() => validateMultipartCompletion([
      { partNumber: 1, etag: '"one"', byteLength: 1, sha256: sha },
    ], [{ partNumber: 1, etag: '"different"', byteLength: 1 }], size)).toThrow("does not match");
  });
});

describe("reconcileMultipartState", () => {
  it("recovers an R2 ETag when PUT succeeded before local acknowledgement", () => {
    const result = reconcileMultipartState([
      { partNumber: 1, etag: null, byteLength: size, sha256: sha },
    ], [{ partNumber: 1, etag: '"remote"', byteLength: size }]);
    expect(result.recovered).toEqual([{ partNumber: 1, etag: '"remote"' }]);
    expect(result.parts[0].present).toBe(true);
  });

  it("rejects unknown provider parts and conflicting acknowledged ETags", () => {
    expect(() => reconcileMultipartState([], [{ partNumber: 1, etag: '"remote"', byteLength: size }])).toThrow("not signed");
    expect(() => reconcileMultipartState([
      { partNumber: 1, etag: '"local"', byteLength: size, sha256: sha },
    ], [{ partNumber: 1, etag: '"remote"', byteLength: size }])).toThrow("ETag");
  });
});
