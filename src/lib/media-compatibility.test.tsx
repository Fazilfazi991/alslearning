import { describe, expect, it } from "vitest";
import {
  mediaAlt,
  questionLabel,
  conversionLabel,
  type QuestionMedia,
} from "./question-media";

const media: QuestionMedia = {
  id: "qa",
  kind: "stem",
  position: 0,
  storage_path: "private/display.png",
  mime_type: "image/png",
  original_filename: "source.emf",
};
describe("source/display and image-only UI metadata", () => {
  it("keeps fallback identification out of source text", () => {
    const q = { prompt: "" };
    expect(questionLabel(q)).toBe("Image-only question");
    expect(q.prompt).toBe("");
    expect(questionLabel({ prompt: "Original question" })).toBe(
      "Original question",
    );
  });
  it("uses only source alt/title or neutral fallback", () => {
    expect(mediaAlt(media, "Question image")).toBe("Question image");
    expect(
      mediaAlt(
        {
          ...media,
          source: { alt_text: "Original source description", title: "Title" },
        },
        "Question image",
      ),
    ).toBe("Original source description");
    expect(
      mediaAlt(
        { ...media, source: { title: "Source title" } },
        "Question image",
      ),
    ).toBe("Source title");
  });
  it("shows conversion metadata only for converted media", () => {
    expect(conversionLabel(media)).toBeNull();
    expect(
      conversionLabel({
        ...media,
        source: { original: { mime_type: "image/x-emf" } },
      }),
    ).toBe("Source format: EMF · Display format: PNG");
  });
});
