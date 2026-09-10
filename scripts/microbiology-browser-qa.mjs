import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { clients, ok } from "./pathology-client.mjs";
const { chromium } = await import(
  pathToFileURL(process.env.PLAYWRIGHT_MODULE).href
);
const { root } = await clients(),
  read = (p) => JSON.parse(readFileSync(p, "utf8"));
const qa = read(".local-qa/microbiology-acceptance.json"),
  manifest = read("docs/microbiology-import-manifest.json"),
  input = read(".local-qa/microbiology-preflight-records.json");
const origin = process.env.QA_ORIGIN || "http://localhost:3007",
  results = [],
  errors = [],
  attempts = [];
const browser = await chromium.launch({ headless: true, channel: "msedge" });
const check = (name, value) => {
  assert.ok(value, name);
  results.push(name);
  console.log("PASS", name);
};
const source = (s) =>
  input.find(
    (q) => q.micro === s.subhead && q.source_sequence === s.source_sequence,
  );
async function session(role, width) {
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
      email: qa.fixture.users[role].email,
    }),
  );
  await page.goto(
    `${origin}/auth/callback?token_hash=${link.properties.hashed_token}&type=magiclink`,
  );
  return { context, page };
}
const filter = (p, label) =>
  p.getByRole("combobox", { name: new RegExp(`^${label}`) });
const count = (p, n) => p.getByText(`${n} records`, { exact: true }).waitFor();
const fits = (p) =>
  p.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
async function images(p, n, adminPreview = false) {
  // Admin also shows inline rich-editor previews; count the canonical media gallery separately.
  const imgs = p.locator(
    `${adminPreview ? 'details:has(> summary:text-matches("— preview$")) ' : ""}a[aria-label^="Open full-size"] img`,
  );
  if (n) await imgs.nth(n - 1).waitFor({ state: "attached", timeout: 60000 });
  assert.equal(await imgs.count(), n);
  for (const img of await imgs.all()) {
    await img.scrollIntoViewIfNeeded();
    await p.waitForFunction(
      (el) => el.complete && el.naturalWidth > 0,
      await img.elementHandle(),
      { timeout: 90000 },
    );
  }
}

async function open(p, s) {
  await filter(p, "Filter by chapter").selectOption(
    manifest.taxonomy.chapters[s.subhead - 1].id,
  );
  await p
    .getByRole("textbox", { name: "Search", exact: true })
    .fill(`| Q${s.source_sequence} |`);
  await count(p, 1);
  await p.getByRole("button", { name: "View / edit", exact: true }).click();
  await p.getByRole("button", { name: "Save question", exact: true }).waitFor();
}
async function save(p) {
  await p.getByRole("button", { name: "Save question", exact: true }).click();
  await p
    .getByRole("heading", { name: "Edit question", exact: true })
    .waitFor({ state: "hidden", timeout: 90000 });
}
try {
  for (const width of [1440, 390]) {
    const { context, page } = await session("admin", width);
    await page.goto(`${origin}/admin/questions`);
    await filter(page, "Filter by subject").selectOption(
      manifest.taxonomy.subject.id,
    );
    await count(page, 793);
    for (const [i, c] of manifest.taxonomy.chapters.entries()) {
      await filter(page, "Filter by chapter").selectOption(c.id);
      await count(page, [97, 102, 100, 101, 101, 100, 192][i]);
    }
    check(
      `Admin ${width}: subject and all seven section filters reconcile`,
      true,
    );
    await filter(page, "Filter by chapter").selectOption("");
    await filter(page, "Filter by status").selectOption("active");
    await count(page, 791);
    await filter(page, "Filter by status").selectOption("draft");
    await page
      .getByRole("checkbox", {
        name: "Content review required only",
        exact: true,
      })
      .check();
    await count(page, 2);
    check(
      `Admin ${width}: exactly two review drafts identifiable`,
      (await page
        .getByText("Content review required", { exact: true })
        .count()) === 2,
    );
    await page
      .getByRole("checkbox", {
        name: "Content review required only",
        exact: true,
      })
      .uncheck();
    await filter(page, "Filter by status").selectOption("");
    await filter(page, "Filter by source").selectOption("previous_exam");
    await count(page, 31);
    await filter(page, "Filter by source").selectOption("");
    check(`Admin ${width}: 31 previous-paper records`, true);
    for (const s of [
      ...qa.selections,
      { subhead: 6, source_sequence: 70 },
      { subhead: 6, source_sequence: 72 },
    ]) {
      const q = source(s);
      await open(page, s);
      for (const summary of await page.locator("summary").all())
        if ((await summary.innerText()).toLowerCase().includes("preview"))
          await summary.click();
      if (q.native_tables)
        check(
          `Admin ${width}: MICRO ${q.micro} Q${q.source_sequence} native tables visible`,
          (await page.locator("table").count()) >= q.native_tables,
        );
      if (q.media.length) await images(page, q.media.length, true);
      if (q.media.some((m) => m.derivative))
        check(
          `Admin ${width}: EMF source/display metadata`,
          (await page
            .getByText("Source format: EMF · Display format: PNG", {
              exact: false,
            })
            .count()) > 0,
        );
      if (q.classification === "CONTENT REVIEW REQUIRED")
        check(
          `Admin ${width}: Q${q.source_sequence} stays Draft`,
          (await filter(page, "Publication status").inputValue()) === "draft",
        );
      if (q.micro === 4 && q.source_sequence === 71)
        check(
          `Admin ${width}: image-only stem retains empty text`,
          q.prompt === "" &&
            (await page
              .getByText("Image-only question", { exact: true })
              .count()) > 0,
        );
      if (q.source_reference_candidates.length) {
        await page
          .getByText("Source / previous-paper metadata", { exact: true })
          .click();
        check(
          `Admin ${width}: exact previous reference`,
          (await page
            .getByLabel("Exam reference", { exact: true })
            .inputValue()) === q.source_reference_candidates[0],
        );
      }
      check(
        `Admin ${width}: MICRO ${q.micro} Q${q.source_sequence} fits`,
        await fits(page),
      );
      if (q.native_tables || q.micro === 4)
        await page.screenshot({
          path: `.local-qa/microbiology-admin-${width}-${q.micro}-${q.source_sequence}.png`,
        });
      await save(page);
    }
    check(
      `Admin ${width}: representative content from all seven sections saved`,
      true,
    );
    await context.close();
    const learner = await session("second", width),
      sp = learner.page;
    let payload = null;
    sp.on("response", async (r) => {
      if (r.url().includes("/rpc/core_attempt_payload") && r.ok()) {
        const d = await r.json();
        if (d.status === "in_progress") payload = d;
      }
    });
    await sp.goto(`${origin}/student/exams/${qa.test_slug}`);
    await sp
      .getByRole("button", { name: "Start attempt", exact: true })
      .click();
    await sp
      .getByRole("button", { name: "Submit test", exact: true })
      .waitFor();
    check(
      `Student ${width}: intended Active bank covers seven sections`,
      payload?.questions.length === qa.question_ids.length &&
        payload.questions.every((q) => qa.question_ids.includes(q.id)),
    );
    check(
      `Student ${width}: network payload hides solutions and keys`,
      payload.questions.every(
        (q) =>
          ![
            "correct_ids",
            "explanation",
            "explanation_rich",
            "solution_media",
            "explanation_image_path",
          ].some((k) => k in q),
      ),
    );
    attempts.push(payload.id);
    for (const [i, s] of qa.selections.entries()) {
      const q = source(s),
        n = q.media.filter((m) => m.kind === "stem").length;
      if (n) await images(sp, n);
      if (q.micro === 4 && q.source_sequence === 71) {
        check(
          `Student ${width}: real Q71 image precedes four options without invented text`,
          (await sp.getByRole("radio").count()) === 4 &&
            !(await sp.locator("body").innerText()).includes(
              "Image-only question",
            ) &&
            (await sp.evaluate(
              () =>
                document
                  .querySelector('a[aria-label^="Open full-size"]')
                  .getBoundingClientRect().top <
                document
                  .querySelector('input[type="radio"]')
                  .getBoundingClientRect().top,
            )),
        );
        await sp.screenshot({
          path: `.local-qa/microbiology-q71-${width}.png`,
        });
      }
      for (const [j, o] of q.options.entries())
        if (o.correct) {
          const saved = sp.waitForResponse(
            (r) => r.url().includes("/rpc/save_attempt_answer") && r.ok(),
          );
          await sp
            .getByRole(q.type === "multiple_mcq" ? "checkbox" : "radio")
            .nth(j)
            .click();
          await saved;
        }
      if (i === 0 || (q.micro === 4 && q.source_sequence === 71)) {
        const id = payload.id;
        await sp.reload();
        await sp
          .getByRole("button", { name: "Submit test", exact: true })
          .waitFor();
        // The existing engine returns to question one on reload; revisit this source question.
        for (let step = 0; step < i; step++)
          await sp.getByRole("button", { name: "Next", exact: true }).click();
        check(
          `Student ${width}: Q${q.source_sequence} refresh retains answer and attempt`,
          payload.id === id &&
            (await sp.locator('input[name="answer"]:checked').count()) > 0,
        );
        if (n) await images(sp, n);
      }
      check(`Student ${width}: question ${i + 1} fits`, await fits(sp));
      if (i < qa.selections.length - 1)
        await sp.getByRole("button", { name: "Next", exact: true }).click();
    }
    await sp.getByRole("button", { name: "Submit test", exact: true }).click();
    await sp
      .getByRole("heading", { name: "Submitted result", exact: true })
      .waitFor();
    const score = qa.selections.reduce((n, s) => n + source(s).marks, 0),
      tableCount = qa.selections.reduce(
        (n, s) => n + source(s).native_tables,
        0,
      ),
      mediaCount = qa.selections.reduce(
        (n, s) => n + source(s).media.length,
        0,
      );
    check(
      `Student ${width}: server score ${score}/${score}`,
      (await sp.locator("body").innerText()).includes(
        `Score: ${score} / ${score}`,
      ),
    );
    await images(sp, mediaCount);
    check(
      `Student ${width}: ${tableCount} source tables render in review`,
      (await sp.locator("table").count()) === tableCount,
    );
    check(
      `Student ${width}: merged cells and scientific formatting render`,
      (await sp.locator('[colspan="3"]').count()) > 0 &&
        /[µμ⁰-₟°×±≤≥]/u.test(await sp.locator("body").innerText()),
    );
    const expectedPaths = qa.selections.flatMap((s) =>
      manifest.images
        .filter((m) => m.question_id === s.question_id)
        .sort((a, b) =>
          a.kind === "stem" && b.kind !== "stem"
            ? -1
            : a.kind !== "stem" && b.kind === "stem"
              ? 1
              : a.position - b.position,
        )
        .map((m) => m.storage_path),
    );
    const paths = await sp
      .locator('a[aria-label^="Open full-size"] img')
      .evaluateAll((a) =>
        a.map((i) => decodeURIComponent(new URL(i.src).pathname)),
      );
    check(
      `Student ${width}: original reading order and PNG derivatives`,
      paths.length === expectedPaths.length &&
        paths.every((p, i) => p.endsWith(expectedPaths[i])) &&
        paths.every((p) => !p.endsWith(".emf")),
    );
    check(`Student ${width}: review has no page overflow`, await fits(sp));
    await sp.screenshot({ path: `.local-qa/microbiology-review-${width}.png` });
    await sp.reload();
    await sp
      .getByRole("button", { name: "View result", exact: true })
      .first()
      .click();
    await sp
      .getByRole("heading", { name: "Submitted result", exact: true })
      .waitFor();
    await images(sp, mediaCount);
    check(
      `Student ${width}: history retains score, tables and images`,
      (await sp.locator("body").innerText()).includes(
        `Score: ${score} / ${score}`,
      ) && (await sp.locator("table").count()) === tableCount,
    );
    await learner.context.close();
  }
  check("No console or runtime errors", errors.length === 0);
} finally {
  writeFileSync(
    "docs/microbiology-browser-verification.json",
    JSON.stringify(
      {
        results,
        errors,
        attempts,
        viewports: [1440, { width: 390, height: 844 }],
      },
      null,
      2,
    ) + "\n",
  );
  await browser.close();
}
