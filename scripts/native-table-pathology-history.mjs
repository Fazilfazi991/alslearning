import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { clients, ok } from "./pathology-client.mjs";
const { chromium } = await import(
  pathToFileURL(process.env.PLAYWRIGHT_MODULE).href
);
const { root } = await clients();
const origin = process.env.QA_ORIGIN || "http://localhost:3005";
const qa = JSON.parse(
  readFileSync(".local-qa/pathology-acceptance.json", "utf8"),
);
const browser = await chromium.launch({ headless: true, channel: "msedge" });
const results = [],
  errors = [];
try {
  for (const width of [1440, 390]) {
    const context = await browser.newContext({
        viewport: { width, height: width === 390 ? 844 : 1000 },
      }),
      page = await context.newPage();
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    const link = ok(
      await root.auth.admin.generateLink({
        type: "magiclink",
        email: qa.fixture.users.second.email,
      }),
    );
    await page.goto(
      `${origin}/auth/callback?token_hash=${link.properties.hashed_token}&type=magiclink`,
    );
    await page.goto(`${origin}/student/exams/${qa.test_slug}`);
    await page
      .getByRole("button", { name: "View result", exact: true })
      .first()
      .click();
    await page
      .getByRole("heading", { name: "Submitted result", exact: true })
      .waitFor();
    assert.ok(
      (await page.locator("body").innerText()).includes("Score: 10 / 10"),
    );
    assert.ok((await page.locator("sup").count()) >= 5);
    await page
      .locator('img[alt^="Solution image"]')
      .nth(3)
      .waitFor({ state: "attached" });
    for (const img of await page.locator('img[alt^="Solution image"]').all())
      await img.scrollIntoViewIfNeeded();
    await page.waitForFunction(() =>
      [...document.querySelectorAll('img[alt^="Solution image"]')].every(
        (i) => i.complete && i.naturalWidth > 0,
      ),
    );
    assert.equal(await page.locator('img[alt^="Solution image"]').count(), 4);
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    await page.screenshot({
      path: `.local-qa/native-pathology-history-${width}.png`,
    });
    results.push(
      `Pathology ${width}: existing historical 10/10 result, plain/rich text, superscripts and four active images preserved`,
    );
    await context.close();
  }
  assert.equal(errors.length, 0);
  writeFileSync(
    "docs/native-table-pathology-regression.json",
    JSON.stringify(
      { results, errors, client_content_modified: false },
      null,
      2,
    ),
  );
  console.log("PASS Pathology historical desktop/mobile regression");
} finally {
  await browser.close();
}
