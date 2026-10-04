import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";

test("public Worker hashes ordered slices and rejects out-of-order input", () => {
  const messages = [];
  const scope = { postMessage: message => messages.push(message) };
  runInNewContext(readFileSync(new URL("../public/recording-hash.worker.js", import.meta.url), "utf8"), { self: scope });
  const send = data => { scope.onmessage({ data }); return messages.at(-1); };

  assert.equal(send({ id: 1, type: "init" }).id, 1);
  assert.equal(send({ id: 2, type: "chunk", sequence: 0, bytes: Uint8Array.of(97).buffer }).id, 2);
  assert.match(send({ id: 3, type: "chunk", sequence: 2, bytes: Uint8Array.of(120).buffer }).error, /in order/);
  assert.equal(send({ id: 4, type: "chunk", sequence: 1, bytes: Uint8Array.of(98, 99).buffer }).id, 4);
  assert.equal(send({ id: 5, type: "finish" }).digest, "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  assert.match(send({ id: 6, type: "finish" }).error, /not initialized/);
});
