import { createHash } from "node:crypto";
export const batch = "als-microbiology-client-20260910-v1";
export const chapterNames = [
  "General Microbiology",
  "Bacteriology",
  "Mycology",
  "Parasitology",
  "Virology",
  "Applied Microbiology",
  "Immunology",
].map((n, i) => `MICRO ${i + 1} - ${n}`);
const namespace = Buffer.from("d88ccbaa6d8f51cb9c0e1ed81fa72555", "hex");
export function identity(key) {
  const b = createHash("sha1")
    .update(namespace)
    .update(key)
    .digest()
    .subarray(0, 16);
  b[6] = (b[6] & 15) | 80;
  b[8] = (b[8] & 63) | 128;
  const h = b.toString("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
export function classify(q) {
  const status = {
    "STRUCTURALLY READY": "active",
    "CONTENT REVIEW REQUIRED": "draft",
    QUARANTINE: "quarantine",
  }[q.classification];
  if (!status) throw Error(`Unexpected classification ${q.classification}`);
  return status;
}
export function sourceMetadata(q, chapter) {
  const refs = q.source_reference_candidates;
  if (refs.length > 1) throw Error(`Ambiguous references at ${q.source_key}`);
  const reference = refs[0] || null;
  return {
    source_type: reference ? "previous_exam" : "standard",
    source_reference: reference,
    exam_year: reference ? Number(reference.split("/")[1]) : null,
    exam_session: null,
    source_label: `${classify(q) === "draft" ? "CONTENT REVIEW REQUIRED | " : ""}${chapter} | ${q.source_document} | Q${q.source_sequence} | batch=${batch} | source=${q.source_key}`,
  };
}
export function questionPayload(q, taxonomy, owner) {
  const id = identity(q.source_key),
    chapter = taxonomy.chapters[q.micro - 1];
  return {
    id,
    exam_id: taxonomy.exam.id,
    program_id: null,
    subject_id: taxonomy.subject.id,
    chapter_id: chapter.id,
    topic_id: null,
    prompt: q.prompt,
    prompt_rich: q.prompt_rich,
    explanation: q.explanation,
    explanation_rich: q.explanation_rich,
    type: q.type,
    status: classify(q),
    difficulty: "medium",
    marks: q.marks,
    negative_marks: q.negative_marks,
    ...sourceMetadata(q, chapter.name),
    options: q.options.map((o) => ({
      content: o.content,
      content_rich: o.content_rich,
      correct: o.correct,
    })),
    media: q.media
      .map((m) => {
        const { derivative, ...source } = m;
        const prefix = `${owner}/${batch}/${id}/${m.kind}-${m.position}`;
        const original_filename = m.original_filename.split("/").at(-1);
        const metadata = {
          ...source,
          source_key: q.source_key,
          source_sha256: q.source_sha256,
          batch,
          subhead: chapter.name,
        };
        let storage_path = `${prefix}-${m.sha256}.${m.mime_type.split("/")[1]}`,
          mime_type = m.mime_type;
        if (derivative) {
          metadata.original = {
            storage_path: `${prefix}-${m.sha256}.emf`,
            mime_type: m.mime_type,
            filename: original_filename,
            sha256: m.sha256,
          };
          metadata.conversion = {
            kind: derivative.conversion.kind,
            version: derivative.conversion.version,
            display_sha256: derivative.display.sha256,
            width: derivative.display.width,
            height: derivative.display.height,
            presentation: derivative.conversion.presentation,
          };
          storage_path = `${prefix}-${derivative.display.sha256}.png`;
          mime_type = "image/png";
        }
        return {
          id: identity(
            `${q.source_key}:${m.kind}:${m.position}:${m.relationship}`,
          ),
          kind: m.kind,
          position: m.position,
          storage_path,
          mime_type,
          original_filename,
          source: metadata,
        };
      })
      .sort((a, b) => a.kind.localeCompare(b.kind) || a.position - b.position),
  };
}
export function projectQuestion(row) {
  const result = {};
  for (const k of [
    "id",
    "exam_id",
    "program_id",
    "subject_id",
    "chapter_id",
    "topic_id",
    "prompt",
    "prompt_rich",
    "explanation",
    "explanation_rich",
    "type",
    "status",
    "difficulty",
    "marks",
    "negative_marks",
    "source_type",
    "source_reference",
    "exam_year",
    "exam_session",
    "source_label",
  ])
    result[k] = row[k];
  result.options = row.question_options
    .sort((a, b) => a.display_order - b.display_order)
    .map((o) => ({
      content: o.content,
      content_rich: o.content_rich,
      correct: row.question_answer_keys.some((k) => k.option_id === o.id),
    }));
  result.media = row.question_media
    .map(
      ({
        id,
        kind,
        position,
        storage_path,
        mime_type,
        original_filename,
        source,
      }) => ({
        id,
        kind,
        position,
        storage_path,
        mime_type,
        original_filename,
        source,
      }),
    )
    .sort((a, b) => a.kind.localeCompare(b.kind) || a.position - b.position);
  return result;
}
export const questionSelect =
  "*,question_options!question_options_question_id_fkey(*),question_answer_keys(option_id),question_media(*)";
