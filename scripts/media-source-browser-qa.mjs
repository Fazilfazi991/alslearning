// Local-only real source previews: no Supabase connection or uploads.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import path from "node:path";
const { chromium } = await import(
  pathToFileURL(process.env.PLAYWRIGHT_MODULE).href
);
const rows = JSON.parse(
  readFileSync("docs/emf-conversion-verification.json", "utf8"),
);
const q = JSON.parse(readFileSync(".local-qa/image-only-source.json", "utf8"));
const escape = (s) =>
  s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll('"', "&quot;");
const cards = rows.map(
  (r) =>
    `<article><h2>MICRO ${r.micro} Q${r.source_index}</h2><a href="${pathToFileURL(path.resolve(r.display.local_path))}" target="_blank"><img src="${pathToFileURL(path.resolve(r.display.local_path))}" alt="Solution image" data-width="${r.display.width}" data-height="${r.display.height}"></a></article>`,
);
cards.push(
  `<article><h2>MICRO 4 Q71</h2><img src="${pathToFileURL(path.resolve(".local-qa/micro-4-q71.jpeg"))}" alt="${escape(q.media.find((m) => m.kind === "stem").alt_text)}"><fieldset><legend>Select one answer</legend>${q.options.map((o) => `<label><input type="radio" name="answer">${escape(o.content)}</label>`).join("")}</fieldset></article>`,
);
writeFileSync(
  ".local-qa/media-source-preview.html",
  `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Local source fidelity preview</title><style>*{box-sizing:border-box}body{margin:0;padding:16px;font:16px system-ui;color:#18223a}article{max-width:900px;margin:0 auto 32px;border:1px solid #ddd;padding:16px;border-radius:12px}img{max-width:100%;height:auto;display:block}label{display:flex;gap:8px;padding:12px}fieldset{margin-top:16px}</style>${cards.join("")}`,
);
const browser = await chromium.launch({ headless: true, channel: "msedge" }),
  results = [];
try {
  for (const width of [1440, 390]) {
    const page = await browser.newPage({
      viewport: { width, height: width === 390 ? 844 : 1000 },
    });
    await page.goto(
      pathToFileURL(path.resolve(".local-qa/media-source-preview.html")).href,
    );
    await page.waitForFunction(
      () =>
        [...document.images].length === 12 &&
        [...document.images].every((i) => i.complete && i.naturalWidth > 0),
    );
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    assert.ok(
      await page.evaluate(() =>
        [...document.querySelectorAll("img[data-width]")].every(
          (i) =>
            i.naturalWidth === Number(i.dataset.width) &&
            i.naturalHeight === Number(i.dataset.height),
        ),
      ),
    );
    const last = page.locator("article").last();
    await last.scrollIntoViewIfNeeded();
    await last.screenshot({ path: `.local-qa/source-q71-${width}.png` });
    results.push(
      `All 11 real derivatives and Q71 source JPEG load at ${width}; exact PNG dimensions and no page overflow`,
    );
    await page.close();
  }
} finally {
  await browser.close();
}
writeFileSync(
  "docs/media-source-browser-verification.json",
  JSON.stringify({ results, database_writes: 0, uploads: 0 }, null, 2) + "\n",
);
console.log("PASS local real-source browser checks at both viewports");
