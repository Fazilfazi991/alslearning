import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { clients, ok } from "./pathology-client.mjs";
const { chromium } = await import(
  pathToFileURL(process.env.PLAYWRIGHT_MODULE).href
);
const { root } = await clients(),
  read = (p) => JSON.parse(readFileSync(p, "utf8")),
  qa = read(".local-qa/microbiology-acceptance.json"),
  manifest = read("docs/microbiology-import-manifest.json");
const browser = await chromium.launch({ headless: true, channel: "msedge" }),
  results = [],
  origin = process.env.QA_ORIGIN || "http://localhost:3007";
const scrollOnly = process.argv.includes("--mobile-scroll-only");
try {
  for (const width of scrollOnly ? [390] : [1440, 390])
    for (const role of scrollOnly ? ["second"] : ["admin", "second"]) {
      const context = await browser.newContext({
          viewport: { width, height: width === 390 ? 844 : 1000 },
        }),
        p = await context.newPage();
      const link = ok(
        await root.auth.admin.generateLink({
          type: "magiclink",
          email: qa.fixture.users[role].email,
        }),
      );
      await p.goto(
        `${origin}/auth/callback?token_hash=${link.properties.hashed_token}&type=magiclink`,
      );
      if (role === "admin") {
        await p.goto(`${origin}/admin/questions`);
        await p
          .getByRole("combobox", { name: /^Filter by subject/ })
          .selectOption(manifest.taxonomy.subject.id);
        for (const [micro, index] of [
          [2, 58],
          [5, 59],
        ]) {
          await p
            .getByRole("combobox", { name: /^Filter by chapter/ })
            .selectOption(manifest.taxonomy.chapters[micro - 1].id);
          await p
            .getByRole("textbox", { name: "Search", exact: true })
            .fill(`| Q${index} |`);
          await p.getByText("1 records", { exact: true }).waitFor();
          await p
            .getByRole("button", { name: "View / edit", exact: true })
            .click();
          const table = p.locator("table").last();
          await table.scrollIntoViewIfNeeded();
          assert.ok(await table.isVisible());
          assert.ok(
            await p.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth,
            ),
          );
          await p.screenshot({
            path: `.local-qa/microbiology-admin-table-${width}-${micro}-${index}.png`,
          });
          results.push(
            `Admin ${width}: MICRO ${micro} Q${index} table visible without page overflow`,
          );
          await p
            .getByRole("button", { name: "Close editor", exact: true })
            .click();
        }
      } else {
        await p.goto(`${origin}/student/exams/${qa.test_slug}`);
        await p
          .getByRole("button", { name: "View result", exact: true })
          .first()
          .click();
        await p
          .getByRole("heading", { name: "Submitted result", exact: true })
          .waitFor();
        for (const [label, table] of [
          ["simple", p.locator("table").first()],
          [
            "merged",
            p
              .locator("table")
              .filter({ has: p.locator('[colspan="3"]') })
              .first(),
          ],
          [
            "wide",
            p.locator("table").filter({ hasText: "Formal Name" }).first(),
          ],
        ]) {
          await table.scrollIntoViewIfNeeded();
          assert.ok(await table.isVisible());
          assert.ok(
            await p.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth,
            ),
          );
          await p.screenshot({
            path: `.local-qa/microbiology-student-table-${width}-${label}.png`,
          });
          results.push(
            `Student ${width}: ${label} table visible without page overflow`,
          );
          if (width === 390) {
            assert.ok(
              await table.evaluate((t) => {
                const c = t.parentElement;
                c.scrollLeft = c.scrollWidth;
                return (
                  c.scrollLeft > 0 &&
                  c.getBoundingClientRect().right <= innerWidth
                );
              }),
            );
            await p.screenshot({
              path: `.local-qa/microbiology-student-table-${width}-${label}-scrolled.png`,
            });
            results.push(
              `Student ${width}: ${label} table scrolls internally to final columns`,
            );
          }
        }
      }
      await context.close();
    }
  writeFileSync(
    scrollOnly
      ? "docs/microbiology-table-scroll-verification.json"
      : "docs/microbiology-table-visual-verification.json",
    JSON.stringify({ results }, null, 2) + "\n",
  );
  console.log(`PASS ${results.length} focused table visual checks`);
} finally {
  await browser.close();
}
