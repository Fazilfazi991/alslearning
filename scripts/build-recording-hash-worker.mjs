import { createRequire } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { webpack } = require("next/dist/compiled/webpack/webpack");
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

await new Promise((resolveBuild, rejectBuild) => {
  webpack({
    mode: "none",
    target: "webworker",
    entry: resolve(root, "scripts/recording-hash.worker.entry.mjs"),
    output: {
      path: resolve(root, "public"),
      filename: "recording-hash.worker.js",
    },
    optimization: { minimize: false, splitChunks: false, runtimeChunk: false },
  }, (error, stats) => {
    if (error || !stats || stats.hasErrors()) {
      rejectBuild(error || new Error(stats?.toString({ all: false, errors: true }) || "Worker bundle failed"));
      return;
    }
    resolveBuild();
  });
});
const output = resolve(root, "public/recording-hash.worker.js");
writeFileSync(output, readFileSync(output, "utf8").replace(/[\t ]+$/gm, ""));
console.log("Bundled public recording hash Worker");
