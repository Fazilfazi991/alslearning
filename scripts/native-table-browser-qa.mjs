import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { clients, ok } from "./pathology-client.mjs";
const { chromium } = await import(
  pathToFileURL(process.env.PLAYWRIGHT_MODULE).href
);
const { root, admin } = await clients();
const qa = JSON.parse(readFileSync(".local-qa/native-table-qa.json", "utf8"));
const origin = process.env.QA_ORIGIN || "http://localhost:3005",
  results = [],
  errors = [],
  attempts = [];
const browser = await chromium.launch({ headless: true, channel: "msedge" });
const check = (name, value) => {
  assert.ok(value, name);
  results.push(name);
  console.log("PASS", name);
};
async function session(user, width) {
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
      email: user.email,
    }),
  );
  await page.goto(
    `${origin}/auth/callback?token_hash=${link.properties.hashed_token}&type=magiclink`,
  );
  return { context, page };
}
const noOverflow = (page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
async function open(page) {
  await page.goto(`${origin}/admin/questions`);
  await page
    .getByRole("textbox", { name: "Search", exact: true })
    .fill("TABLE SEARCH NEEDLE");
  await page.getByText("1 records", { exact: true }).waitFor();
  await page.getByRole("button", { name: "View / edit", exact: true }).click();
  await page
    .getByRole("button", { name: "Save question", exact: true })
    .waitFor();
}
async function save(page) {
  await page
    .getByRole("button", { name: "Save question", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Edit question", exact: true })
    .waitFor({ state: "hidden", timeout: 90000 });
}
try {
  for (const width of [1440, 390]) {
    const local = await browser.newPage({
      viewport: { width, height: width === 390 ? 844 : 1000 },
    });
    await local.setContent(
      readFileSync(".local-qa/native-source-render.html", "utf8"),
    );
    check(
      `All 24 real source tables render structurally at ${width}`,
      (await local.locator("table").count()) === 24,
    );
    check(
      `All source tables contain page overflow at ${width}`,
      await noOverflow(local),
    );
    await local.locator('article[data-table="16"]').scrollIntoViewIfNeeded();
    await local.screenshot({ path: `.local-qa/native-source-${width}.png` });
    await local.close();
    ok(await admin.rpc("core_save_question", { value: qa.q }));
    ok(
      await admin.rpc("core_save_test", {
        value: { ...qa.test, status: "active", max_attempts: 100 },
        question_ids: [qa.q.id],
        batch_ids: [qa.fixture.batch.id],
      }),
    );
    const staff = await session(qa.fixture.users.admin, width),
      ap = staff.page;
    await open(ap);
    check(`Admin ${width} search finds table-cell text`, true);
    check(
      `Admin ${width} tables, merged cells, superscript/subscript render`,
      (await ap.locator("table").count()) >= 5 &&
        (await ap.locator('td[colspan="5"],th[colspan="5"]').count()) > 0 &&
        (await ap.locator("sup").count()) > 0 &&
        (await ap.locator("sub").count()) > 0,
    );
    await ap
      .getByRole("textbox", {
        name: "Question / case text table 2 row 1 cell 1",
        exact: true,
      })
      .scrollIntoViewIfNeeded();
    check(
      `Admin ${width} page has no horizontal overflow`,
      await noOverflow(ap),
    );
    await ap.screenshot({ path: `.local-qa/native-admin-${width}.png` });
    await save(ap);
    const saved = ok(
      await admin
        .from("questions")
        .select("prompt_rich,explanation_rich")
        .eq("id", qa.q.id)
        .single(),
    );
    assert.deepEqual(saved.prompt_rich, qa.q.prompt_rich);
    assert.deepEqual(saved.explanation_rich, qa.q.explanation_rich);
    check(`Admin ${width} no-op save preserves full table structure`, true);
    const learner = await session(qa.fixture.users.second, width),
      sp = learner.page;
    let payload;
    sp.on("response", async (r) => {
      if (r.url().includes("/rpc/core_attempt_payload") && r.ok()) {
        const d = await r.json();
        if (d.status === "in_progress") payload = d;
      }
    });
    await sp.goto(`${origin}/student/exams/test-${qa.test.id}`);
    await sp
      .getByRole("button", { name: "Start attempt", exact: true })
      .click();
    await sp
      .getByRole("button", { name: "Submit test", exact: true })
      .waitFor();
    check(
      `Student ${width} stem and option tables render`,
      (await sp.locator("table").count()) === 3,
    );
    check(
      `Student ${width} solution tables and keys absent from payload`,
      payload &&
        !JSON.stringify(payload).includes("PRIVATE TABLE EXPLANATION") &&
        !("correct_ids" in payload.questions[0]),
    );
    attempts.push(payload.id);
    await sp
      .locator('img[alt="Question image 1"]')
      .waitFor({ state: "attached" });
    check(
      `Student ${width} content order includes table before and after image`,
      await sp.evaluate(() => {
        const image = document.querySelector('img[alt="Question image 1"]');
        const tables = [...document.querySelectorAll("table")];
        return (
          !!image &&
          !!(
            tables[0].compareDocumentPosition(image) &
            Node.DOCUMENT_POSITION_FOLLOWING
          ) &&
          !!(
            image.compareDocumentPosition(tables[1]) &
            Node.DOCUMENT_POSITION_FOLLOWING
          )
        );
      }),
    );
    await sp.getByRole("radio").first().click();
    await sp.locator('input[name="answer"]:checked').waitFor();
    await sp.reload();
    await sp
      .getByRole("button", { name: "Submit test", exact: true })
      .waitFor();
    check(
      `Student ${width} answer survives refresh in same attempt`,
      payload.id === attempts.at(-1) &&
        (await sp.getByRole("radio").first().isChecked()),
    );
    check(`Student ${width} attempt overflow contained`, await noOverflow(sp));
    await sp.screenshot({ path: `.local-qa/native-student-${width}.png` });
    await sp.getByRole("button", { name: "Submit test", exact: true }).click();
    await sp
      .getByRole("heading", { name: "Submitted result", exact: true })
      .waitFor();
    check(
      `Student ${width} server grade is 1/1`,
      (await sp.locator("body").innerText()).includes("Score: 1 / 1"),
    );
    check(
      `Student ${width} explanation and option tables render in review`,
      (await sp.locator("table").count()) === 6,
    );
    await sp
      .locator('img[alt="Solution image 2"]')
      .waitFor({ state: "attached" });
    for (const img of await sp.locator("img[alt^='Solution image']").all())
      await img.scrollIntoViewIfNeeded();
    await sp.waitForFunction(() =>
      [...document.querySelectorAll("img[alt^='Solution image']")].every(
        (i) => i.complete && i.naturalWidth > 0,
      ),
    );
    check(`Student ${width} review overflow contained`, await noOverflow(sp));
    await sp.screenshot({ path: `.local-qa/native-review-${width}.png` });
    await open(ap);
    await ap
      .getByRole("textbox", {
        name: "Question / case text table 2 row 1 cell 1",
        exact: true,
      })
      .fill("TABLE SEARCH NEEDLE changed after submission");
    await save(ap);
    check(
      `Admin ${width} cell edit persists`,
      ok(
        await admin
          .from("questions")
          .select("prompt")
          .eq("id", qa.q.id)
          .single(),
      ).prompt.includes("changed after submission"),
    );
    await sp.reload();
    await sp
      .getByRole("button", { name: "View result", exact: true })
      .first()
      .click();
    await sp
      .getByRole("heading", { name: "Submitted result", exact: true })
      .waitFor();
    check(
      `Student ${width} historical table remains original after source edit`,
      !(await sp.locator("body").innerText()).includes(
        "changed after submission",
      ) &&
        (await sp.locator("body").innerText()).includes("TABLE SEARCH NEEDLE"),
    );
    await learner.context.close();
    await staff.context.close();
  }
  check("No browser runtime or console errors", errors.length === 0);

  ok(
    await admin.rpc("core_save_test", {
      value: { ...qa.test, status: "archived" },
      question_ids: [qa.q.id],
      batch_ids: [qa.fixture.batch.id],
    }),
  );
  ok(
    await admin.rpc("core_save_question", {
      value: { ...qa.q, status: "archived" },
    }),
  );
  writeFileSync(
    "docs/native-table-browser-verification.json",
    JSON.stringify(
      { results, errors, attempts, synthetic_test_archived: true },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
