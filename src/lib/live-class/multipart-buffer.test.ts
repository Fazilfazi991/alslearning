import { describe, expect, it } from "vitest";
import { FixedPartAssembler } from "./multipart-buffer";

const MiB = 1024 * 1024;

describe("FixedPartAssembler", () => {
  it("assembles irregular recorder chunks without changing byte order", () => {
    const assembler = new FixedPartAssembler(5 * MiB);
    const input = [new Uint8Array(2 * MiB).fill(1), new Uint8Array(4 * MiB).fill(2), new Uint8Array(3).fill(3)];
    const parts = input.flatMap(chunk => assembler.push(chunk)).concat(assembler.finish());
    expect(parts.map(part => part.bytes.byteLength)).toEqual([5 * MiB, MiB + 3]);
    expect(parts.map(part => part.partNumber)).toEqual([1, 2]);
    expect(parts[0].bytes[2 * MiB - 1]).toBe(1);
    expect(parts[0].bytes[2 * MiB]).toBe(2);
    expect([...parts[1].bytes.slice(-3)]).toEqual([3, 3, 3]);
  });

  it("emits exact full parts and a smaller final part", () => {
    const assembler = new FixedPartAssembler(5 * MiB);
    const ready = assembler.push(new Uint8Array(10 * MiB + 17));
    expect(ready.map(part => [part.partNumber, part.bytes.byteLength, part.final])).toEqual([
      [1, 5 * MiB, false], [2, 5 * MiB, false],
    ]);
    expect(assembler.finish().map(part => [part.partNumber, part.bytes.byteLength, part.final])).toEqual([[3, 17, true]]);
  });

  it("does not create an empty terminal part", () => {
    const assembler = new FixedPartAssembler(5 * MiB);
    expect(assembler.push(new Uint8Array(5 * MiB))).toHaveLength(1);
    expect(assembler.finish()).toEqual([]);
  });
});
