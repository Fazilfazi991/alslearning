import {fixturesBytes} from "./fidelity-fixtures.mjs";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync } from "node:fs";
const { chromium } = await import(
  pathToFileURL(process.env.PLAYWRIGHT_MODULE).href
);
const f = JSON.parse(readFileSync("core-qa-results.json"));
const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
  origin = "http://localhost:3003";
if (new URL(url).hostname !== "xstssknlgdraulebdsfd.supabase.co")
  throw Error("QA only");
const keys = await (
  await fetch(
    "https://api.supabase.com/v1/projects/xstssknlgdraulebdsfd/api-keys",
    {
      headers: { Authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}` },
    },
  )
).json();
const root = createClient(
  url,
  keys.find((k) => k.name === "service_role").api_key,
  { auth: { persistSession: false } },
);
const ok = (r) => {
  if (r.error) throw Error(r.error.message);
  return r.data;
};
const browser = await chromium.launch({ headless: true, channel: "msedge" }),
  results = [],
  errors = [];
async function login(label, width) {
  const context = await browser.newContext({
    viewport: { width, height: width === 390 ? 844 : 1000 },
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  const link = ok(
    await root.auth.admin.generateLink({
      type: "magiclink",
      email: f.users[label].email,
    }),
  );
  await page.goto(
    `${origin}/auth/callback?token_hash=${link.properties.hashed_token}&type=magiclink`,
  );
  return { context, page };
}
function check(name, condition) {
  assert.ok(condition, name);
  results.push(name);
  console.log("PASS", name);
}
async function noOverflow(page, label) {
  check(
    label,
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
}
async function format(page, label, mark, start, end) {
  const box = page.getByRole("textbox", { name: label, exact: true });
  await box.focus();
  await box.evaluate((el, { start, end }) => el.setSelectionRange(start, end), {
    start,
    end,
  });
  await page
    .getByRole("toolbar", { name: `${label} formatting`, exact: true })
    .getByRole("button", { name: mark, exact: true })
    .click();
}
try {
  for (const width of [1440, 390]) {
    const { context, page } = await login("admin", width);
    await page.goto(`${origin}/admin/questions`);
    await page
      .getByRole("button", { name: "Add question", exact: true })
      .click();
    await page
      .getByRole("combobox", { name: /^Entrance exam/ })
      .selectOption(f.exam.id);
    await page
      .getByRole("combobox", { name: /^Program/ })
      .selectOption(f.program.id);
    await page
      .getByRole("combobox", { name: /^Subject/ })
      .selectOption(f.subject.id);
    const title = `Fidelity browser ${width} ${Date.now()} CO2 x2`;
    await page
      .getByRole("textbox", { name: "Question / case text", exact: true })
      .fill(title);
    await format(
      page,
      "Question / case text",
      "subscript",
      title.length - 4,
      title.length - 3,
    );
    await format(
      page,
      "Question / case text",
      "superscript",
      title.length - 1,
      title.length,
    );
    for (let i = 1; i <= 4; i++)
      await page
        .getByRole("textbox", { name: `Option ${i}`, exact: true })
        .fill(i === 1 ? "CO2" : `Option ${i}`);
    await format(page, "Option 1", "subscript", 2, 3);
    await page
      .getByRole("textbox", { name: "Explanation", exact: true })
      .fill("CO2 x2\n<script>bad()</script>");
    await format(page, "Explanation", "subscript", 2, 3);
    await format(page, "Explanation", "superscript", 5, 6);
    const files = ["png", "jpeg", "gif", "png"].map((ext, i) => ({
      name: `synthetic-${i}.${ext}`,
      mimeType: `image/${ext}`,
      buffer: fixturesBytes[ext],
    }));
    await page
      .getByLabel("Question images", { exact: true })
      .setInputFiles(files.slice(0, 2));
    await page
      .getByRole("button", { name: "Save question", exact: true })
      .waitFor();
    await page
      .getByLabel("Solution images", { exact: true })
      .setInputFiles(files);
    await page
      .getByRole("button", { name: "Save question", exact: true })
      .waitFor();
    await page
      .getByRole("combobox", { name: /^Publication status/ })
      .selectOption("active");
    check(
      `Admin ${width} formatted preview`,
      (await page.locator("sup").count()) > 0 &&
        (await page.locator("sub").count()) > 0,
    );
    await noOverflow(page, `Admin ${width} no horizontal overflow`);
    await page
      .getByRole("button", { name: "Save question", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Save question", exact: true })
      .waitFor({ state: "hidden" });
    await page.reload();
    await page
      .getByRole("textbox", { name: "Search", exact: true })
      .fill(title);
    await page
      .getByRole("button", { name: "View / edit", exact: true })
      .click();
    const before = ok(
      await root
        .from("questions")
        .select(
          "*,question_media(*),question_options!question_options_question_id_fkey(*)",
        )
        .eq("prompt", title)
        .single(),
    );
    check(
      `Admin ${width} persisted six media`,
      before.question_media.length === 6,
    );
    for (const summary of await page.locator("summary").all())
      if ((await summary.innerText()).includes("preview"))
        await summary.click();
    await page.waitForFunction(() =>
      [...document.querySelectorAll("img")]
        .filter((i) => i.alt.includes("images"))
        .every((i) => i.complete && i.naturalWidth > 0),
    );
    check(
      `Admin ${width} static GIF preview`,
      (await page.locator('img[src*=".gif"]').count()) === 1,
    );
    await page.screenshot({
      path: `.local-qa/admin-fidelity-${width}.png`,
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Save question", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Save question", exact: true })
      .waitFor({ state: "hidden" });
    const after = ok(
      await root
        .from("questions")
        .select("prompt_rich,explanation_rich")
        .eq("id", before.id)
        .single(),
    );
    check(
      `Admin ${width} unchanged resave preserves AST`,
      JSON.stringify(before.prompt_rich) ===
        JSON.stringify(after.prompt_rich) &&
        JSON.stringify(before.explanation_rich) ===
          JSON.stringify(after.explanation_rich),
    );
    // Canonical RPC creates only a disposable fixture test for the UI-authored question.
    const template = ok(
      await root.from("tests").select("*").eq("id", f.testId).single(),
    );
    const link = ok(
      await root.auth.admin.generateLink({
        type: "magiclink",
        email: f.users.admin.email,
      }),
    );
    const staff = createClient(
      url,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      { auth: { persistSession: false } },
    );
    ok(
      await staff.auth.verifyOtp({
        token_hash: link.properties.hashed_token,
        type: "magiclink",
      }),
    );
    const test = {
      ...template,
      id: crypto.randomUUID(),
      title: `Browser fidelity ${width}`,
      chapter_id: null,
      topic_id: null,
      max_attempts: 4,
      status: "active",
      show_answers: true,
      show_explanations: true,
      show_results: true,
    };
    ok(
      await staff.rpc("core_save_test", {
        value: test,
        question_ids: [before.id],
        batch_ids: [f.batch.id],
      }),
    );
    await context.close();
    const learner = await login("second", width),
      sp = learner.page;
    await sp.goto(`${origin}/student/exams/test-${test.id}`);
    await sp
      .getByRole("button", { name: "Start attempt", exact: true })
      .click();
    await sp
      .getByRole("button", { name: "Submit test", exact: true })
      .waitFor();
    check(
      `Student ${width} formatted stem and option`,
      (await sp.locator("sup").count()) > 0 &&
        (await sp.locator("sub").count()) >= 2,
    );
    check(
      `Student ${width} solution hidden`,
      (await sp.locator('img[alt^="Solution"]').count()) === 0 &&
        !(await sp.locator("body").innerText()).includes("<script>"),
    );
    await sp.getByRole("radio").first().click();
    await sp.locator('input[name="answer"]:checked').waitFor();
    await sp.reload();
    await sp
      .getByRole("button", { name: "Submit test", exact: true })
      .waitFor();
    check(
      `Student ${width} answer survives refresh`,
      await sp.getByRole("radio").first().isChecked(),
    );
    await noOverflow(sp, `Student attempt ${width} no overflow`);
    await sp.getByRole("button", { name: "Submit test", exact: true }).click();
    await sp
      .getByRole("heading", { name: "Submitted result", exact: true })
      .waitFor();
    await sp.waitForFunction(() => document.querySelectorAll('img[alt^="Solution image"]').length === 4);
    check(
      `Student ${width} four solution images`,
      (await sp.locator('img[alt^="Solution image"]').count()) === 4,
    );
    await sp.waitForFunction(() =>
      [...document.querySelectorAll('img[alt^="Solution image"]')].every(
        (i) => i.complete && i.naturalWidth > 0,
      ),
    );
    check(
      `Student ${width} safe literal markup`,
      (await sp.locator("body").innerText()).includes(
        "<script>bad()</script>",
      ) &&
        (await sp.locator("script").filter({ hasText: "bad()" }).count()) === 0,
    );
    await noOverflow(sp, `Student review ${width} no overflow`);
    await sp.screenshot({
      path: `.local-qa/student-fidelity-${width}.png`,
      fullPage: true,
    });
    await sp.reload();
    await sp
      .getByRole("button", { name: "View result", exact: true })
      .first()
      .click();
    await sp
      .getByRole("heading", { name: "Submitted result", exact: true })
      .waitFor();
    check(
      `Student ${width} historical refresh formatting`,
      (await sp.locator("sub").count()) >= 3 &&
        (await sp.locator("sup").count()) >= 2,
    );
    // Archive only the disposable browser test; preserve source question and attempts.
    ok(
      await staff.rpc("core_save_test", {
        value: { ...test, status: "archived" },
        question_ids: [before.id],
        batch_ids: [f.batch.id],
      }),
    );
    await learner.context.close();
  }
  check("No browser console/runtime errors", errors.length === 0);
  writeFileSync(
    ".local-qa/fidelity-browser-results.json",
    JSON.stringify({ results, errors }, null, 2),
  );
} finally {
  await browser.close();
}
