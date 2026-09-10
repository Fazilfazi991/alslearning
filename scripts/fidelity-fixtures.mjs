import { readFileSync } from "node:fs";
// Synthetic 180 x 110 solid-color images, unrelated to client question content.
export const fixturesBytes = Object.fromEntries(
  ["png", "jpeg", "gif"].map((ext) => [ext, readFileSync(new URL(`./fixtures/fidelity.${ext}`, import.meta.url))]),
);
