import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { clients, ok } from "./pathology-client.mjs";
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const { root } = await clients();
const qa = JSON.parse(readFileSync(".local-qa/pathology-acceptance.json", "utf8"));
const manifest = JSON.parse(readFileSync("docs/pathology-import-manifest.json", "utf8"));
const browser = await chromium.launch({ headless: true, channel: "msedge" });
const results = [];
const origin = process.env.QA_ORIGIN || "http://localhost:3004";
try {
  for (const width of [1440, 390]) {
    const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 1000 } });
    const page = await context.newPage();
    const link = ok(await root.auth.admin.generateLink({ type: "magiclink", email: qa.fixture.users.admin.email }));
    await page.goto(`${origin}/auth/callback?token_hash=${link.properties.hashed_token}&type=magiclink`);
    await page.goto(`${origin}/admin/questions`);
    for (const record of manifest.records.filter(r => r.media_ids?.length || (r.subhead === 2 && r.source_sequence === 126) || (r.subhead === 4 && r.source_sequence === 68))) {
      await page.getByRole("combobox", { name: /^Filter by subject/ }).selectOption(manifest.taxonomy.subject.id);
      await page.getByRole("combobox", { name: /^Filter by chapter/ }).selectOption(manifest.taxonomy.chapters[record.subhead - 1].id);
      await page.getByRole("textbox", { name: "Search", exact: true }).fill(`| Q${record.source_sequence} |`);
      await page.getByText("1 records", { exact: true }).waitFor();
      await page.getByRole("button", { name: "View / edit", exact: true }).click();
      await page.getByRole("button", { name: "Save question", exact: true }).waitFor();
      if (record.media_ids.length) {
        for (const summary of await page.locator("summary").all()) if ((await summary.innerText()).includes("preview")) await summary.click();
        await page.locator('img[alt^="Solution images"]').nth(record.media_ids.length - 1).waitFor({state: "attached"});
        for (const img of await page.locator('img[alt^="Solution images"]').all()) await img.scrollIntoViewIfNeeded();
        await page.waitForFunction(n => {
          const images = [...document.querySelectorAll('img[alt^="Solution images"]')];
          return images.length === n && images.every(i => i.complete && i.naturalWidth > 0);
        }, record.media_ids.length);
        const paths = await page.locator('img[alt^="Solution images"]').evaluateAll(images => images.map(i => decodeURIComponent(new URL(i.src).pathname)));
        const expected = manifest.images.filter(i => i.question_id === record.question_id).sort((a, b) => a.position - b.position);
        assert.ok(paths.every((path, i) => path.endsWith(expected[i].storage_path)));
        await page.locator('img[alt^="Solution images"]').last().scrollIntoViewIfNeeded();
      } else {
        await page.locator("sup").first().scrollIntoViewIfNeeded();
      }
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.screenshot({ path: `.local-qa/pathology-detail-${width}-${record.subhead}-${record.source_sequence}.png` });
      results.push(`Admin ${width}: PATHO ${record.subhead} Q${record.source_sequence} original ordered media/rich detail fits`);
      await page.getByRole("button", { name: "Close editor", exact: true }).click();
    }
    await context.close();
  }
  writeFileSync("docs/pathology-media-browser-verification.json", JSON.stringify({ results }, null, 2));
  console.log(`PASS ${results.length} Admin detail checks`);
} finally { await browser.close(); }
