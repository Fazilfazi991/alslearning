import assert from "node:assert/strict";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { clients, ok } from "./pathology-client.mjs";
const { chromium } = await import(
  pathToFileURL(process.env.PLAYWRIGHT_MODULE).href
);
const { root, admin } = await clients();
const qa = JSON.parse(
  readFileSync(".local-qa/media-compatibility-qa.json", "utf8"),
);
const origin = process.env.QA_ORIGIN || "http://localhost:3006",
  results = [],
  errors = [],
  attempts = [];
const browser = await chromium.launch({ headless: true, channel: "msedge" });
const priorAttempts = existsSync(".local-qa/media-browser-attempts.json")
  ? JSON.parse(readFileSync(".local-qa/media-browser-attempts.json", "utf8"))
  : [];
const check = (name, value) => {
  assert.ok(value, name);
  results.push(name);
  console.log("PASS", name);
};
const noOverflow = (page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
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
  return { page, context };
}
const loaded = (page, count = 1) =>
  page.waitForFunction((expected) => {
    const images = [
      ...document.querySelectorAll('a[aria-label^="Open full-size"] img'),
    ];
    return (
      images.length >= expected &&
      images.every((i) => i.complete && i.naturalWidth > 0)
    );
  }, count);
try {
  for (const width of [1440, 390]) {
    ok(await admin.rpc("core_save_question", { value: qa.q }));
    const staff = await session(qa.fixture.users.admin, width),
      ap = staff.page;
    await ap.goto(`${origin}/admin/questions`);
    await ap
      .getByRole("textbox", { name: "Search", exact: true })
      .fill("QA ONLY media compatibility");
    await ap.getByText("1 records", { exact: true }).waitFor();
    check(
      `Admin ${width} displays image-only fallback`,
      await ap.getByText("Image-only question", { exact: true }).isVisible(),
    );
    await ap.getByRole("button", { name: "View / edit", exact: true }).click();
    for (const summary of await ap
      .locator("summary")
      .filter({ hasText: "synthetic-media.emf" })
      .all())
      await summary.click();
    await loaded(ap, 2);
    check(
      `Admin ${width} displays both derivatives and format metadata`,
      (await ap
        .getByText("Source format: EMF · Display format: PNG", { exact: true })
        .count()) === 2,
    );
    check(`Admin ${width} no page overflow`, await noOverflow(ap));
    await ap.screenshot({ path: `.local-qa/media-admin-${width}.png` });
    await ap
      .getByRole("button", { name: "Save question", exact: true })
      .click();
    await ap
      .getByRole("heading", { name: "Edit question", exact: true })
      .waitFor({ state: "hidden", timeout: 90000 });
    check(
      `Admin ${width} save keeps original empty prompt`,
      ok(
        await admin
          .from("questions")
          .select("prompt")
          .eq("id", qa.q.id)
          .single(),
      ).prompt === "",
    );
    const learner = await session(qa.fixture.users.second, width),
      sp = learner.page;
    let payload;
    sp.on("response", async (r) => {
      if (r.url().includes("/rpc/core_attempt_payload") && r.ok()) {
        const data = await r.json();
        if (data.status === "in_progress") payload = data;
      }
    });
    await sp.goto(`${origin}/student/exams/test-${qa.test.id}`);
    await sp
      .getByRole("button", { name: "Start attempt", exact: true })
      .click();
    await sp
      .getByRole("button", { name: "Submit test", exact: true })
      .waitFor();
    await loaded(sp);
    attempts.push(payload.id);
    check(
      `Student ${width} image-only payload and solution protection`,
      payload.questions[0].prompt === "" &&
        !("solution_media" in payload.questions[0]) &&
        !("correct_ids" in payload.questions[0]),
    );
    check(
      `Student ${width} image precedes answer options`,
      await sp.evaluate(
        () =>
          !!(
            document
              .querySelector('a[aria-label^="Open full-size"] img')
              .compareDocumentPosition(
                document.querySelector("input[name=answer]"),
              ) & Node.DOCUMENT_POSITION_FOLLOWING
          ),
      ),
    );
    check(
      `Student ${width} full-size display link available`,
      await sp
        .getByRole("link", { name: "Open full-size Question image 1" })
        .isVisible(),
    );
    await sp.getByRole("radio").first().click();
    await sp.locator("input[name=answer]:checked").waitFor();
    const id = payload.id;
    await sp.reload();
    await sp
      .getByRole("button", { name: "Submit test", exact: true })
      .waitFor();
    await loaded(sp);
    check(
      `Student ${width} refresh retains image, answer and attempt`,
      payload.id === id && (await sp.getByRole("radio").first().isChecked()),
    );
    check(`Student ${width} no page overflow`, await noOverflow(sp));
    await sp.screenshot({ path: `.local-qa/media-student-${width}.png` });
    await sp.getByRole("button", { name: "Submit test", exact: true }).click();
    await sp
      .getByRole("heading", { name: "Submitted result", exact: true })
      .waitFor();
    await sp.locator('img[alt="Solution image 1"]').waitFor();
    await loaded(sp, 2);
    check(
      `Student ${width} submission grades and displays solution derivative`,
      (await sp.locator("body").innerText()).includes("Score: 1 / 1"),
    );
    ok(
      await admin.rpc("core_save_question", {
        value: {
          ...qa.q,
          prompt: "Edited synthetic source",
          prompt_rich: null,
          media: [
            {
              id: crypto.randomUUID(),
              kind: "stem",
              position: 0,
              storage_path: qa.replacement,
              mime_type: "image/png",
              original_filename: "replacement.png",
            },
          ],
        },
      }),
    );
    await sp.reload();
    await sp
      .getByRole("button", { name: "View result", exact: true })
      .first()
      .click();
    await sp
      .getByRole("heading", { name: "Submitted result", exact: true })
      .waitFor();
    await loaded(sp, 2);
    check(
      `Student ${width} history retains original stem and solution after source edit`,
      !(await sp.locator("body").innerText()).includes(
        "Edited synthetic source",
      ) &&
        (await sp.locator('a[aria-label^="Open full-size"] img').count()) === 2,
    );
    check(`Student ${width} history no page overflow`, await noOverflow(sp));
    await sp.screenshot({ path: `.local-qa/media-history-${width}.png` });
    await staff.context.close();
    await learner.context.close();
  }
  check("No console or runtime errors", errors.length === 0);
  writeFileSync(
    "docs/media-compatibility-browser-verification.json",
    JSON.stringify({ results, errors, attempts }, null, 2) + "\n",
  );
} finally {
  await browser.close();
  writeFileSync(
    ".local-qa/media-browser-attempts.json",
    JSON.stringify([...new Set([...priorAttempts, ...attempts])]),
  );
  ok(await admin.rpc("core_save_question", { value: qa.q }));
}
