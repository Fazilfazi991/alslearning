// Read-only historical QA. Additional response states and draft Q190 are browser-local
// fixtures: RPC/storage interceptions never write or publish questions or attempts.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { clients, ok } from "./pathology-client.mjs";
const { chromium } = await import(
  pathToFileURL(process.env.PLAYWRIGHT_MODULE).href
);
const { root } = await clients();
const read = (path) => JSON.parse(readFileSync(path, "utf8"));
const origin = process.env.QA_ORIGIN || "http://localhost:3007";
assert.equal(new URL(origin).hostname, "localhost");
const directory = ".local-qa/submitted-review";
mkdirSync(directory, { recursive: true });
const results = [],
  errors = [];
const browser = await chromium.launch({ headless: true, channel: "msedge" });
async function inspect(page, name, expectedImages) {
  const review = page.locator("[data-submitted-review]");
  await review
    .getByRole("heading", { name: "Test completed", exact: true })
    .waitFor();
  const images = review.locator('a[aria-label^="Open full-size"] img');
  await page.waitForFunction(
    (count) =>
      document.querySelectorAll(
        '[data-submitted-review] a[aria-label^="Open full-size"] img',
      ).length === count,
    expectedImages,
  );
  const dimensions = [];
  for (const img of await images.all()) {
    await img.scrollIntoViewIfNeeded();
    await img.evaluate((image) => image.decode());
    const size = await img.evaluate((image) => ({
      width: image.clientWidth,
      height: image.clientHeight,
      naturalWidth: image.naturalWidth,
      naturalHeight: image.naturalHeight,
    }));
    assert.ok(
      Math.abs(
        size.width / size.height / (size.naturalWidth / size.naturalHeight) - 1,
      ) < 0.025,
      `image aspect ratio ${JSON.stringify(size)}`,
    );
    assert.ok(size.width <= size.naturalWidth + 1, "small image not stretched");
    dimensions.push(size);
  }
  assert.equal(await review.locator("figcaption").count(), 0);
  assert.equal(await review.getByRole("alert").count(), 0);
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    "page overflow",
  );
  const tables = await review
    .locator('[aria-label="Content table"]')
    .evaluateAll((nodes) =>
      nodes.map((node) => ({
        scroll: node.scrollWidth,
        viewport: node.clientWidth,
        font: getComputedStyle(node.querySelector("table")).fontSize,
      })),
    );
  assert.ok(tables.every((table) => table.font === "16px"));
  for (const table of await review
    .locator('[aria-label="Content table"]')
    .all()) {
    assert.ok(
      await table.evaluate((node) => {
        if (node.scrollWidth <= node.clientWidth) return true;
        node.scrollLeft = 50;
        const scrolled = node.scrollLeft > 0;
        node.scrollLeft = 0;
        return scrolled;
      }),
    );
  }
  const cards = review.locator("article");
  for (let i = 0; i < (await cards.count()); i++) {
    await cards
      .nth(i)
      .screenshot({
        path: `${directory}/${name}-question-${i + 1}.png`,
        style: "header.sticky, nav.fixed { visibility: hidden !important; }",
      });
  }
  await review
    .getByRole("link", { name: "Result summary", exact: true })
    .click();
  await page.waitForFunction(
    () =>
      document.querySelector("#result-summary").getBoundingClientRect().top >=
      90,
  );
  await page.screenshot({ path: `${directory}/${name}-summary.png` });
  if (await cards.count()) {
    await review
      .getByRole("link", { name: "Review answers", exact: true })
      .click();
    await review
      .getByRole("navigation", { name: "Jump to question" })
      .getByRole("link")
      .last()
      .click();
    assert.ok(page.url().endsWith(`#review-question-${await cards.count()}`));
  }
  results.push({
    name,
    questions: await cards.count(),
    images: dimensions,
    tables,
    no_page_overflow: true,
  });
  console.log(
    `PASS ${name}: ${await cards.count()} questions, ${dimensions.length} images, ${tables.length} tables`,
  );
}
try {
  for (const width of [1440, 390]) {
    const context = await browser.newContext({
      viewport: { width, height: width === 390 ? 844 : 1000 },
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    let lastReview;
    for (const subject of ["pathology", "microbiology"]) {
      const fixture = read(`.local-qa/${subject}-acceptance.json`);
      await context.clearCookies();
      const link = ok(
        await root.auth.admin.generateLink({
          type: "magiclink",
          email: fixture.fixture.users.second.email,
        }),
      );
      await page.goto(
        `${origin}/auth/callback?token_hash=${link.properties.hashed_token}&type=magiclink`,
      );
      await page.goto(`${origin}/student/exams/${fixture.test_slug}`);
      const response = page.waitForResponse((response) =>
        response.url().includes("/rpc/get_test_review"),
      );
      await page
        .getByRole("button", { name: "View result", exact: true })
        .first()
        .click();
      lastReview = await (await response).json();
      assert.ok(lastReview.answers.length >= 10);
      await inspect(
        page,
        `${subject}-${width}`,
        lastReview.answers.reduce(
          (count, a) =>
            count +
            (a.stem_media?.length || 0) +
            (a.solution_media?.length || 0),
          0,
        ),
      );
      const paths = await page
        .locator('[data-submitted-review] a[aria-label^="Open full-size"]')
        .evaluateAll((nodes) =>
          nodes.map(
            (n) =>
              decodeURIComponent(new URL(n.href).pathname).split(
                "/question-media/",
              )[1],
          ),
        );
      assert.deepEqual(
        paths,
        lastReview.answers.flatMap((a) =>
          [
            ...(a.stem_media || []).sort((x, y) => x.position - y.position),
            ...(a.solution_media || []).sort((x, y) => x.position - y.position),
          ].map((m) => m.storage_path),
        ),
      );
      if (subject === "microbiology") {
        const imageOnly = lastReview.answers.find((a) => !a.prompt.trim());
        assert.ok(imageOnly && imageOnly.stem_media.length === 1);
        assert.ok(
          !(await page
            .locator("[data-submitted-review]")
            .getByText("Image-only question", { exact: true })
            .count()),
        );
      }
    }
    // Draft source Q190 remains outside Student access. Render its exact local
    // source text/media in the isolated browser only, without an asserted key.
    const source = read(".local-qa/pathology-import-input.json").find(
      (q) => q.subhead === 1 && q.source_sequence === 190,
    );
    const media = source.media.map((m, index) => ({
      ...m,
      id: `local-${index}`,
      storage_path: `review-local/${index}.${m.mime_type.split("/")[1]}`,
    }));
    await page.route(
      "**/storage/v1/object/sign/question-media/review-local/**",
      async (route) => {
        const path = new URL(route.request().url()).pathname;
        const index = Number(path.split("/").at(-1).split(".")[0]);
        if (route.request().method() === "POST")
          return route.fulfill({
            json: {
              signedURL: `/object/sign/question-media/${media[index].storage_path}?token=local-fixture`,
            },
          });
        return route.fulfill({
          contentType: media[index].mime_type,
          body: readFileSync(
            `.local-qa/pathology-media/${media[index].sha256}`,
          ),
        });
      },
    );
    const base = lastReview.answers.find(
      (a) => !a.stem_media?.length && !a.solution_media?.length,
    );
    const local = {
      ...lastReview,
      score: 1,
      total_marks: 3,
      answers: [
        {
          ...base,
          question_id: "local-correct",
          selected_option_ids: base.correct_option_ids,
          marks_awarded: 1,
        },
        {
          ...base,
          question_id: "local-wrong",
          selected_option_ids: [
            base.options.find((o) => !base.correct_option_ids.includes(o.id))
              .id,
          ],
          marks_awarded: 0,
        },
        {
          ...base,
          question_id: "local-unanswered",
          selected_option_ids: [],
          marks_awarded: 0,
        },
        {
          question_id: "local-q190",
          prompt: source.prompt,
          prompt_rich: source.prompt_rich,
          options: source.options.map((o, i) => ({ ...o, id: String(i) })),
          selected_option_ids: [],
          correct_option_ids: [],
          marks_awarded: 0,
          explanation: source.explanation,
          explanation_rich: source.explanation_rich,
          stem_media: [],
          solution_media: media,
          stem_image_path: null,
          explanation_image_path: null,
        },
      ],
    };
    await page.route("**/rest/v1/rpc/get_test_review", (route) =>
      route.fulfill({ json: local }),
    );
    await page
      .getByRole("button", { name: "View result", exact: true })
      .first()
      .click();
    await inspect(page, `local-states-q190-${width}`, 4);
    assert.equal(
      await page.locator('[data-submitted-review] img[src*=".gif"]').count(),
      1,
    );
    const displayed = await page
      .locator('[data-submitted-review] a[aria-label^="Open full-size"]')
      .evaluateAll((nodes) => nodes.map((node) => new URL(node.href).pathname));
    assert.deepEqual(
      displayed,
      media
        .sort((a, b) => a.position - b.position)
        .map((m) => `/storage/v1/object/sign/question-media/${m.storage_path}`),
    );
    await page.unroute("**/rest/v1/rpc/get_test_review");
    await page.route("**/rest/v1/rpc/get_test_review", (route) =>
      route.fulfill({
        json: {
          status: "submitted",
          results_visible: false,
          score: null,
          total_marks: 3,
          answers: [],
        },
      }),
    );
    await page
      .getByRole("button", { name: "View result", exact: true })
      .first()
      .click();
    await page
      .getByText(
        "Your submission is saved. Results are hidden by the test settings.",
        { exact: true },
      )
      .waitFor();
    assert.equal(
      await page.locator("[data-submitted-review] article").count(),
      0,
    );
    await context.close();
  }
  assert.deepEqual(errors, []);
  writeFileSync(
    "docs/submitted-review-browser-qa.json",
    JSON.stringify(
      {
        results,
        errors,
        database_writes: false,
        production_touched: false,
        local_fixture_note:
          "Correct/wrong/unanswered and draft Q190 gallery exercised by browser-local RPC/storage interception; historical subject reviews use real permitted snapshots.",
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
