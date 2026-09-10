import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SubmittedReview, answerOutcome } from "./submitted-review";
import type { Review } from "./review-types";
import { fromPlain } from "@/lib/rich-text";

vi.mock("@/components/learning/private-image", () => ({
  PrivateImage: ({ path, alt }: { path: string; alt: string }) =>
    path ? <span data-image={path}>{alt}</span> : null,
}));
const answer: Review["answers"][number] = {
  question_id: "one",
  prompt: "Original stem",
  options: [
    { id: "a", content: "A. Original answer" },
    { id: "b", content: "B. Other answer" },
  ],
  selected_option_ids: ["a"],
  correct_option_ids: ["a"],
  marks_awarded: 1,
  explanation: null,
  stem_image_path: null,
  explanation_image_path: null,
};
const review: Review = {
  status: "submitted",
  results_visible: true,
  score: 1,
  total_marks: 1,
  answers: [answer],
};
const render = (value: Review) =>
  renderToStaticMarkup(<SubmittedReview review={value} />);

describe("submitted review presentation", () => {
  it("distinguishes exact multi-answer sets, wrong and unanswered without using marks to grade", () => {
    expect(answerOutcome(answer)).toBe("correct");
    expect(
      answerOutcome({
        ...answer,
        selected_option_ids: ["b"],
        marks_awarded: 1,
      }),
    ).toBe("incorrect");
    expect(answerOutcome({ ...answer, selected_option_ids: [] })).toBe(
      "unanswered",
    );
    expect(answerOutcome({ ...answer, correct_option_ids: [] })).toBe(
      "recorded",
    );
    expect(
      answerOutcome({
        ...answer,
        correct_option_ids: ["a", "b"],
        selected_option_ids: ["b", "a"],
      }),
    ).toBe("correct");
    expect(answerOutcome({ ...answer, correct_option_ids: ["a", "b"] })).toBe(
      "incorrect",
    );
  });
  it("shows the backend score including zero and negative values, without clamping", () => {
    expect(render({ ...review, score: 0 })).toContain("0%");
    expect(render({ ...review, score: -0.5 })).toContain("-50%");
  });
  it("never reveals hidden scores or derives a replacement score from marks", () => {
    const html = render({
      ...review,
      results_visible: false,
      score: 938,
      answers: [{ ...answer, marks_awarded: 729 }],
    });
    expect(html).toContain("Results are hidden");
    expect(html).not.toContain("938");
    expect(html).not.toContain("729");
    expect(html).not.toContain("marks earned");
  });
  it("does not invent a review, statistics, keys or explanation when withheld", () => {
    const html = render({ ...review, answers: [] });
    expect(html).toContain("Answer review is not available");
    expect(html).not.toContain("Correct answer");
    expect(html).not.toContain("Attempted");
    expect(render(review)).not.toContain("Explanation</h4>");
    expect(
      render({
        ...review,
        answers: [{ ...answer, explanation_rich: fromPlain("") }],
      }),
    ).not.toContain("Explanation</h4>");
  });
  it("preserves source option labels and leaves image-only stems text-free", () => {
    const html = render({
      ...review,
      answers: [
        {
          ...answer,
          prompt: "",
          prompt_rich: fromPlain(""),
          stem_media: [
            {
              id: "stem",
              kind: "stem",
              position: 0,
              storage_path: "stem.png",
              mime_type: "image/png",
              original_filename: "stem.png",
            },
          ],
        },
      ],
    });
    expect(html).toContain("A. Original answer");
    expect(html).toContain('data-image="stem.png"');
    expect(html).not.toContain("See image");
    expect(html).not.toContain("Image-only question");
    expect(html).not.toContain("figcaption");
    expect(html).not.toContain("min-h-[1em]");
  });
  it("preserves rich text, merged tables and four ordered images including GIF and derivative", () => {
    const paths = ["first.png", "second.gif", "emf-display.png", "fourth.png"];
    const html = render({
      ...review,
      answers: [
        {
          ...answer,
          explanation_rich: {
            version: 2,
            blocks: [
              {
                runs: [
                  {
                    text: "• Original bullet",
                    marks: ["bold", "italic", "underline"],
                  },
                  { text: "2", marks: ["superscript"] },
                  { text: "3", marks: ["subscript"] },
                ],
              },
              { type: "media", position: 0 },
              {
                type: "table",
                columns: 2,
                rows: [
                  {
                    cells: [
                      {
                        content: fromPlain("Merged original cell"),
                        colspan: 2,
                        rowspan: 1,
                        header: true,
                      },
                    ],
                  },
                ],
              },
              ...[1, 2, 3].map((position) => ({
                type: "media" as const,
                position,
              })),
            ],
          },
          solution_media: paths
            .map((path, position) => ({
              id: path,
              kind: "solution" as const,
              position,
              storage_path: path,
              mime_type: path.endsWith("gif") ? "image/gif" : "image/png",
              original_filename: path,
            }))
            .reverse(),
        },
      ],
    });
    expect(html).toContain("<sup>2</sup>");
    expect(html).toContain("<sub>3</sub>");
    expect(html).toContain('colSpan="2"');
    expect(html.indexOf('data-image="first.png"')).toBeLessThan(
      html.indexOf("Merged original cell"),
    );
    expect(paths.map((path) => html.indexOf(`data-image="${path}"`))).toEqual(
      paths
        .map((path) => html.indexOf(`data-image="${path}"`))
        .sort((a, b) => a - b),
    );
    expect((html.match(/data-image=/g) || []).length).toBe(4);
  });
});
