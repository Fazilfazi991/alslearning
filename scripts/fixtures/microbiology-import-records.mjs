// Synthetic, self-contained model fixtures. Original extraction integrity is
// additionally checked when the private preflight export is available locally.
const hash = letter => letter.repeat(64);
export const records = ["STRUCTURALLY READY", "CONTENT REVIEW REQUIRED", "QUARANTINE", "STRUCTURALLY READY", "STRUCTURALLY READY"].map((classification, index) => ({
  classification, source_key: `synthetic-microbiology-${index}`, source_document: "TEST synthetic.docx", source_sha256: hash("c"), source_sequence: index === 3 ? 71 : index + 1,
  micro: index === 3 ? 4 : 1, prompt: index === 3 ? "" : "TEST synthetic question", prompt_rich: null, explanation: "TEST explanation", explanation_rich: null,
  source_reference_candidates: [], type: "single_mcq", marks: 1, negative_marks: 0, native_tables: index === 0 ? 24 : 0,
  options: [{ content: "Correct", content_rich: null, correct: true }, { content: "Incorrect", content_rich: null, correct: false }],
  media: index === 3 ? [{ kind: "stem", position: 1, original_filename: "TEST diagram.emf", mime_type: "image/emf", sha256: hash("a"), relationship: "rIdTest", alt_text: "TEST diagram",
    derivative: { conversion: { kind: "emf-to-png", version: "test", presentation: "inline" }, display: { sha256: hash("b"), width: 40, height: 30 } } }] : [],
}));
