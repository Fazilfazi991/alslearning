"""Local, read-only source audit using the established ALS parser unchanged.

No Supabase client, network operation, taxonomy creation, or importer execution.
Full candidate records remain local; compact evidence is written to docs/.
"""
from collections import Counter, defaultdict
from difflib import SequenceMatcher
import hashlib
import importlib.util
import json
from pathlib import Path
import re
import xml.etree.ElementTree as ET
import zipfile

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("established_parser", ROOT / "scripts/pathology-fidelity-preflight.py")
parser = importlib.util.module_from_spec(spec)
spec.loader.exec_module(parser)
NS = parser.NS
W = "{" + NS["w"] + "}"
MAPPING = [
    ("Biochemistry of Major Biomolecules", "app friendly format - JSO SIR 15 - Biochemistry of Major Biomolecules.docx"),
    ("Vitamins and Minerals, Hemoglobin", "app friendly format - JSO SIR 16 - Vitamins and Minerals, Hemoglobin.docx"),
    ("Enzymology, Techniques and Instrumentation, Biostatistics", "app friendly format - JSO SIR 17 - Enzymology, Techniques and Instrumentation, Biostatistics.docx"),
    ("Molecular Biology", "app friendly format - JSO SIR 14 -Molecular Biology.docx"),
    ("Physical Chemistry, General Biochemistry", "app friendly format - JSO SIR 18 - Physical Chemistry, General Biochemistry.docx"),
    ("Clinical Biochemistry", "app friendly format - JSO SIR 19 - Clinical biochemistry.docx"),
    ("Diagnostic Biochemistry", "app friendly format - JSO SIR 19 - Diagnostic Biochemistry.docx"),
    ("Hormones, QC, Toxicology", "app friendly format - JSO SIR 20 - HORMONES,QC,TOXICOLOGY.docx"),
]
CLASSES = ["STRUCTURALLY READY", "CONTENT REVIEW REQUIRED", "QUARANTINE", "TECHNICAL BLOCKER"]
norm = lambda s: " ".join(s.casefold().split())
compact = lambda s: re.sub(r"\s", "", s)
loc = lambda q: f'BIO {q["bio"]} Q{q["source_sequence"]}'


def save(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def content_cells(wrapper):
    option = 0
    for row in wrapper.findall("w:tr", NS):
        cells = row.findall("w:tc", NS)
        label = parser.raw(cells[0]).strip().lower() if cells else ""
        if label in ("question", "solution", "option") and len(cells) > 1:
            if label == "option":
                option += 1
            yield label, option if label == "option" else None, cells[1]


def doc_for(q, role, option):
    return q["prompt_rich"] if role == "question" else q["explanation_rich"] if role == "solution" else q["options"][option - 1]["content_rich"]


def ast_order(doc):
    return ["table" if b.get("type") == "table" else "image" if b.get("type") == "media" else "paragraph" for b in doc["blocks"]]


def answer_claims(solution):
    # The source typo "Anaswer" is recognized for auditing, never rewritten.
    claims = []
    for line in solution.splitlines():
        s = line.strip()
        match = re.match(r"(?:Correct\s*(?:Answer|Anaswer|Option)|Ans(?:wer)?)\s*[:.\-–]*\s*(?:Option\s*[:\-]?\s*)?\(?([A-Z])\)?(?=[).:\s-]|$)[).:\s-]*(.*)$", s, re.I)
        reverse = re.match(r"([A-Z])[).]\s*(?:Correct\s*)?Answer\s*:\s*(.*)$", s, re.I)
        m = match or reverse
        if m:
            claims.append({"raw": line, "label": m[1].upper(), "named_answer": m[2]})
        for extra in re.finditer(r"\b(?:Option\s+)?([A-D])\s+is\s+(?:also\s+)?correct\b", s, re.I):
            claims.append({"raw": line, "label": extra[1].upper(), "named_answer": "", "kind": "explicit additional answer claim"})
    return claims


def xml_content_text(cell, archive):
    """Independent text check, including Word numbering not stored in w:t.

    The supplied BIO files use only bullets. Fail closed if that changes rather
    than ignoring list prefixes or reusing the parser's generated list metadata.
    """
    text = ""
    numbering = ET.fromstring(archive.read("word/numbering.xml")) if "word/numbering.xml" in archive.namelist() else None
    for paragraph in cell.findall(".//w:p", NS):
        num = paragraph.find("w:pPr/w:numPr", NS)
        if num is not None and parser.attr(num.find("w:numId", NS)) != "0":
            numid = parser.attr(num.find("w:numId", NS))
            level = parser.attr(num.find("w:ilvl", NS), default="0")
            abstractid = next(parser.attr(n.find("w:abstractNumId", NS)) for n in numbering.findall("w:num", NS) if parser.attr(n, "numId") == numid)
            abstract = next(n for n in numbering.findall("w:abstractNum", NS) if parser.attr(n, "abstractNumId") == abstractid)
            definition = next(n for n in abstract.findall("w:lvl", NS) if parser.attr(n, "ilvl") == level)
            assert parser.attr(definition.find("w:numFmt", NS)) == "bullet"
            marker = parser.attr(definition.find("w:lvlText", NS))
            text += {"\uf0b7": "•", "\uf0a7": "▪", "o": "○"}.get(marker, marker)
        text += parser.raw(paragraph)
    return text


def run():
    records, files, table_inventory, drawings, numbering, fidelity = [], [], [], [], [], []
    for bio, (name, filename) in enumerate(MAPPING, 1):
        path = ROOT / "MOQ" / filename
        source_bytes = path.read_bytes()
        questions = parser.parse(path)
        with zipfile.ZipFile(path) as z:
            xml = ET.fromstring(z.read("word/document.xml"))
            wrappers = xml.findall("w:body/w:tbl", NS)
            independent = []
            for t in wrappers:
                labels = [parser.raw(r.findall("w:tc", NS)[0]).strip().lower() for r in t.findall("w:tr", NS) if r.findall("w:tc", NS)]
                if labels.count("question") == 1 and labels.count("type") == 1 and labels.count("marks") == 1:
                    independent.append(t)
            assert len(independent) == len(wrappers) == len(questions), "Unreconciled question boundary"
            outside = [parser.raw(e).strip() for e in xml.find("w:body", NS) if e.tag != W + "tbl" and parser.raw(e).strip()]
            assert not outside, "Meaningful content outside question wrappers requires review"
            rels = [dict(r.attrib) for r in ET.fromstring(z.read("word/_rels/document.xml.rels"))]
            media_paths = [n for n in z.namelist() if n.startswith("word/media/") and not n.endswith("/")]
            for asset in media_paths:
                (ROOT / ".local-qa/biochemistry-assets" / f"bio-{bio}").mkdir(parents=True, exist_ok=True)
                (ROOT / ".local-qa/biochemistry-assets" / f"bio-{bio}" / Path(asset).name).write_bytes(z.read(asset))
            all_tags = Counter(e.tag.split("}")[-1] for e in xml.iter())
            # These are Word export separators, outside all question wrappers.
            for pict in xml.findall(".//w:pict", NS):
                rects = list(pict)
                decorative = len(rects) == 1 and rects[0].tag == "{urn:schemas-microsoft-com:vml}rect" and rects[0].get("{urn:schemas-microsoft-com:office:office}hr") == "t" and not list(rects[0])
                drawings.append({"bio": bio, "source_document": filename, "kind": "decorative question separator" if decorative else "UNSUPPORTED DRAWING", "xml": ET.tostring(pict, encoding="unicode")})
                assert decorative, "Meaningful drawing requires a blocker assessment"
            page_node = ET.fromstring(z.read("docProps/app.xml")).find("{http://schemas.openxmlformats.org/officeDocument/2006/extended-properties}Pages")
            displayed = []
            for q, wrapper in zip(questions, wrappers):
                q["bio"] = bio
                q["subhead"] = f"BIO {bio} — {name}"
                q["scoped_source_identity"] = hashlib.sha256(json.dumps(["Biochemistry", bio, filename, q["source_sha256"], q["source_sequence"]], ensure_ascii=False, separators=(",", ":")).encode()).hexdigest()
                q["review_reasons"], q["quarantine_reasons"], q["technical_reasons"] = [], [], []
                marked = [chr(65 + i) for i, o in enumerate(q["options"]) if o["correct"]]
                q["marked_answers"] = marked
                q["answer_claims"] = answer_claims(q["explanation"])
                for claim in q["answer_claims"]:
                    if claim["label"] not in [chr(65 + i) for i in range(len(q["options"]))]:
                        q["review_reasons"].append("WRITTEN ANSWER REFERENCES NONEXISTENT OPTION")
                    elif marked and claim["label"] not in marked:
                        q["review_reasons"].append("MARKED / WRITTEN ANSWER CONFLICT")
                    named = norm(claim["named_answer"]).rstrip(".")
                    matching = [chr(65 + i) for i, o in enumerate(q["options"]) if named and named == norm(o["content"]).rstrip(".")]
                    claim["exact_named_option_matches"] = matching
                    if matching and claim["label"] not in matching:
                        q["review_reasons"].append("WRITTEN LETTER / NAMED OPTION CONFLICT")
                if len({c["label"] for c in q["answer_claims"]}) > 1:
                    q["review_reasons"].append("CONFLICTING WRITTEN ANSWER CLAIMS")
                if len(marked) > 1:
                    q["review_reasons"].append("MULTIPLE CORRECT MARKERS — SOURCE INTENT REVIEW")
                text = "\n".join([q["prompt"], *[o["content"] for o in q["options"]], q["explanation"]])
                q["cancelled"] = bool(re.search(r"\b(?:question\s*(?:is\s*)?(?:cancelled|canceled|deleted|invalid)|(?:cancelled|canceled|deleted)\s*question)\b", text, re.I))
                if q["cancelled"]:
                    q["quarantine_reasons"].append("SOURCE QUESTION CANCELLED/DELETED/INVALID")
                if not marked:
                    q["quarantine_reasons"].append("MISSING CORRECT OPTION MARKER — DO NOT INFER FROM SOLUTION")
                for error in q["structural_errors"]:
                    if error == "Missing correct answer":
                        continue
                    if error in ("Malformed options", "Invalid marks", "Empty stem"):
                        q["quarantine_reasons"].append(error)
                    else:
                        q["technical_reasons"].append(error)
                number = re.match(r"^\s*(?:(?:Question|Q)\s*[.:#-]?\s*)?(\d+)\s*[.)]\s*", q["prompt"], re.I)
                q["displayed_number"] = int(number[1]) if number else None
                q["stem_without_display_number"] = q["prompt"][number.end():] if number else q["prompt"]
                displayed.append(q["displayed_number"])
                if not number or int(number[1]) != q["source_sequence"]:
                    numbering.append({"location": loc(q), "displayed_number": q["displayed_number"], "stem_start": q["prompt"][:160], "reason": "missing/malformed visible number" if not number else "display number differs from source sequence"})
                q["native_tables"] = 0
                q["source_order"] = []
                for role, option, cell in content_cells(wrapper):
                    doc = doc_for(q, role, option)
                    source_order = ["table" if e.tag == W + "tbl" else "paragraph" for e in cell if e.tag in (W + "p", W + "tbl")]
                    equal = source_order == ast_order(doc)
                    text_equal = compact(xml_content_text(cell, z)) == compact("".join(r["text"] for r in parser.rich_runs(doc)))
                    if not equal or not text_equal:
                        q["technical_reasons"].append(f"TEXT/ORDER FIDELITY MISMATCH: {role} {option}")
                    q["source_order"].append({"role": role, "option": option, "source": source_order, "canonical": ast_order(doc), "text_exact_ignoring_whitespace": text_equal})
                    for ti, table in enumerate(cell.findall(".//w:tbl", NS), 1):
                        tags = Counter(e.tag.split("}")[-1] for e in table.iter())
                        q["native_tables"] += 1
                        table_inventory.append({"location": loc(q), "source_document": filename, "role": role, "option": option, "table_index": ti,
                            "rows": len(table.findall("w:tr", NS)), "columns": len(table.findall("w:tblGrid/w:gridCol", NS)),
                            "merged_cells": tags["gridSpan"] + tags["vMerge"] + tags["hMerge"], "nested_tables": len(table.findall(".//w:tbl", NS)),
                            "images_in_cells": tags["blip"], "row_text": [[parser.raw(c) for c in row.findall("w:tc", NS)] for row in table.findall("w:tr", NS)],
                            "rich_properties": {k: tags[k] for k in ("b", "i", "u", "vertAlign")}, "source_cell_order": source_order,
                            "canonical_order_matches": equal, "xml_sha256": hashlib.sha256(ET.tostring(table)).hexdigest()})
                    # Independently compare direct run mark/text pairs to parser AST runs.
                    for run in cell.findall(".//w:r", NS):
                        vertical = parser.attr(run.find("w:rPr/w:vertAlign", NS))
                        if vertical in ("superscript", "subscript"):
                            raw = parser.raw(run)
                            assert any(r["text"] == raw and vertical in r["marks"] for r in parser.rich_runs(doc)), "Scientific run lost"
                runs = [r for role, option, _ in content_cells(wrapper) for r in parser.rich_runs(doc_for(q, role, option))]
                marks = {m for r in runs for m in r["marks"]}
                q["format_inventory"] = {k: k in marks for k in ("bold", "italic", "underline", "superscript", "subscript")}
                q["scientific_inventory"] = {
                    "unicode_superscript": bool(re.search("[⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁽⁾]", text)),
                    "unicode_subscript": bool(re.search("[₀-₟]", text)),
                    "greek": bool(re.search("[Α-ω]", text)), "arrows": bool(re.search("[←-⇿]", text)),
                    "math_symbols": bool(re.search("[±≥≤×÷√∞≈≠=]", text)),
                    "mu": bool(re.search("[μµ]", text)), "angstrom": "Å" in text,
                    "formula_candidate": bool(re.search(r"[=√]|\b(?:log|pCO|HCO|Ca²|Na⁺|pH)\b", text)),
                    "isotope_candidate": bool(re.search(r"isotop|radioactiv|³[²H]|¹[⁴³]|³H|³²P|⁶⁰Co|¹³¹I", text, re.I)),
                }
                q["previous_paper_evidence"] = list(dict.fromkeys(re.findall(r"\bPSC(?:\s+\d{2,3}/\d{2,4})?\b|\b\d{2,3}/(?:19|20)\d{2}\b|\b(?:previous\s*(?:paper|question)|recalled)\b", text, re.I)))
                q["source_literal_exam_codes"] = re.findall(r"\bPSC\s+(\d{2,3}/\d{2,4})\b", text, re.I)
                q["scientific_characters"] = sorted(set(re.findall("[Α-ωµÅ±≥≤×÷√∞≈≠←-⇿⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁽⁾₀-₟′″]", text)))
                q["image_only_stem"] = not q["prompt"].strip() and any(m["kind"] == "stem" for m in q["media"])
                q["table_only_stem"] = any(b.get("type") == "table" for b in q["prompt_rich"]["blocks"]) and not any(r["text"].strip() for b in q["prompt_rich"]["blocks"] for r in b.get("runs", []))
                q["analytical_types"] = {
                    "single_mcq": len(marked) <= 1,
                    "genuine_multiple_select": False,
                    "assertion_reason": bool((re.search(r"\bassertion\b", q["prompt"], re.I) and re.search(r"\breason\b", q["prompt"], re.I)) or (re.search(r"^A:\s*", q["stem_without_display_number"], re.I) and re.search(r"\nR:\s*", q["prompt"], re.I))),
                    "matching_combination": bool(re.search(r"\bmatch\b|column\s*[AB12]", q["prompt"], re.I)),
                    "multi_statement_combination": bool(re.search(r"(?:^|\n)\s*\(?[ivx]+[.)]|(?:^|\n)\s*[1-6][.)]", q["stem_without_display_number"], re.I) and any(re.search(r"\bonly\b|\band\b|[ivx]+\s*,|\d\s*,", o["content"], re.I) for o in q["options"])),
                    "image_only": q["image_only_stem"], "table_containing": q["native_tables"] > 0,
                }
                if q["analytical_types"]["matching_combination"]:
                    q["analytical_types"]["multi_statement_combination"] = False
                q["review_reasons"] = sorted(set(q["review_reasons"]))
                q["classification"] = CLASSES[3] if q["technical_reasons"] else CLASSES[2] if q["quarantine_reasons"] else CLASSES[1] if q["review_reasons"] else CLASSES[0]
                records.append(q)
                fidelity.append({"location": loc(q), "text_and_order_pass": not q["technical_reasons"], "format_runs": q["format_runs"], "source_order": q["source_order"]})
            subset = records[-len(questions):]
            counts = Counter(q["classification"] for q in subset)
            file = {"bio": bio, "name": name, "source_document": filename, "sha256": hashlib.sha256(source_bytes).hexdigest(), "bytes": len(source_bytes),
                "cached_page_count": int(page_node.text) if page_node is not None else None,
                "source": len(questions), "ready": counts[CLASSES[0]], "review": counts[CLASSES[1]], "quarantine": counts[CLASSES[2]], "technical_blockers": counts[CLASSES[3]],
                "images": sum(len(q["media"]) for q in subset), "native_tables": sum(q["native_tables"] for q in subset),
                "all_native_tables_including_wrappers": all_tags["tbl"], "question_wrappers": len(wrappers), "relationships": rels, "package_media_count": len(media_paths),
                "package_media_formats": dict(Counter(Path(p).suffix.lower() for p in media_paths)), "embedded_objects": sum(1 for n in z.namelist() if n.startswith("word/embeddings/")),
                "word_structure_counts": {k: all_tags[k] for k in ("drawing", "blip", "pict", "oMath", "oMathPara", "object", "OLEObject", "txbxContent", "sym", "chart", "AlternateContent")},
                "xml_parts": [n for n in z.namelist() if n.endswith(".xml")],
                "xml_tag_inventory": dict(sorted(all_tags.items())),
                "display_number_duplicates": {str(n): count for n, count in Counter(displayed).items() if count > 1},
                "missing_visible_numbers": [q["source_sequence"] for q in subset if q["displayed_number"] is None],
                "display_number_gaps": sorted(set(range(1, max(n for n in displayed if n is not None) + 1)) - set(displayed)),
                "previous_paper_questions": sum(bool(q["previous_paper_evidence"]) for q in subset),
                "marks_distribution": dict(Counter(f'{q.get("marks")} / {q.get("negative_marks")}' for q in subset)),
                "types": {k: sum(q["analytical_types"][k] for q in subset) for k in subset[0]["analytical_types"]},
                "formatting": {k: sum(q["format_inventory"][k] for q in subset) for k in subset[0]["format_inventory"]},
                "scientific": {k: sum(q["scientific_inventory"][k] for q in subset) for k in subset[0]["scientific_inventory"]}}
            assert file["source"] == sum(file[k] for k in ("ready", "review", "quarantine", "technical_blockers"))
            assert file["all_native_tables_including_wrappers"] == file["question_wrappers"] + file["native_tables"]
            assert path.read_bytes() == source_bytes, "Source mutated"
            files.append(file)
    stems, exact = defaultdict(list), defaultdict(list)
    for q in records:
        stems[norm(q["stem_without_display_number"])].append(q)
        signature = json.dumps([norm(q["stem_without_display_number"]), [(norm(o["content"]), o["correct"]) for o in q["options"]]], ensure_ascii=False)
        exact[signature].append(q)
    exact_groups = [[loc(q) for q in group] for group in exact.values() if len(group) > 1]
    same_stems = [{"records": [loc(q) for q in group], "options_or_key_differ": len({json.dumps(q["options"], sort_keys=True) for q in group}) > 1} for group in stems.values() if len(group) > 1]
    near = []
    texts = [norm(q["stem_without_display_number"]) for q in records]
    tokens = [set(re.findall(r"\w+", t)) for t in texts]
    for i in range(len(records)):
        for j in range(i + 1, len(records)):
            if texts[i] == texts[j] or not tokens[i] or not tokens[j]:
                continue
            if len(tokens[i] & tokens[j]) / len(tokens[i] | tokens[j]) < .7:
                continue
            similarity = SequenceMatcher(None, texts[i], texts[j], autojunk=False).ratio()
            if similarity >= .85:
                near.append({"records": [loc(records[i]), loc(records[j])], "similarity": round(similarity, 4)})
    assert len({q["source_key"] for q in records}) == len(records)
    assert len({q["scoped_source_identity"] for q in records}) == len(records)
    six, seven = [[q for q in records if q["bio"] == n] for n in (6, 7)]
    assert not {q["source_key"] for q in six} & {q["source_key"] for q in seven}
    report = {"scope": "LOCAL PREFLIGHT ONLY; zero writes/uploads/imports/deployments", "files": files,
        "totals": {k: sum(f[k] for f in files) for k in ("source", "ready", "review", "quarantine", "technical_blockers", "images", "native_tables", "previous_paper_questions")},
        "anomalies": [{"location": loc(q), "displayed_number": q["displayed_number"], "classification": q["classification"], "marked_answers": q["marked_answers"], "answer_claims": q["answer_claims"], "review": q["review_reasons"], "quarantine": q["quarantine_reasons"], "technical": q["technical_reasons"]} for q in records if q["classification"] != CLASSES[0]],
        "numbering": numbering, "exact_stem_options_key_groups": exact_groups, "same_stem_groups": same_stems, "near_duplicates": near,
        "duplicate_method": "Leading visible number removed; whitespace/case normalized. Near: token Jaccard >=0.70 and SequenceMatcher >=0.85. Candidates only; no records removed.",
        "identity": {"existing_key": "SHA256(exact DOCX bytes):source sequence", "additional_preflight_identity": "SHA256([subject,BIO subhead,exact filename,DOCX SHA256,sequence])", "unique_existing_keys": len({q["source_key"] for q in records}), "unique_scoped_keys": len({q["scoped_source_identity"] for q in records}), "bio6_bio7_overlap": 0},
        "native_table_inventory": table_inventory, "decorative_separators": len(drawings)}
    report["additional_inventory"] = {
        "native_content_tables": len(table_inventory),
        "merged_content_tables": sum(t["merged_cells"] > 0 for t in table_inventory),
        "nested_content_tables": sum(t["nested_tables"] for t in table_inventory),
        "images": sum(len(q["media"]) for q in records),
        "gif": sum(m["mime_type"] == "image/gif" for q in records for m in q["media"]),
        "emf": sum(m["mime_type"] == "image/x-emf" for q in records for m in q["media"]),
        "image_only_stems": sum(q["image_only_stem"] for q in records),
        "table_only_stems": sum(q["table_only_stem"] for q in records),
        "officemath_nodes": sum(f["word_structure_counts"]["oMath"] for f in files),
        "superscript_runs": sum(r["format"] == "superscript" for q in records for r in q["format_runs"]),
        "subscript_runs": sum(r["format"] == "subscript" for q in records for r in q["format_runs"]),
        "superscript_or_subscript_questions_including_unicode": sum(q["format_inventory"]["superscript"] or q["format_inventory"]["subscript"] or q["scientific_inventory"]["unicode_superscript"] or q["scientific_inventory"]["unicode_subscript"] for q in records),
        "previous_paper_questions": sum(bool(q["previous_paper_evidence"]) for q in records),
        "exact_normalized_stem_groups": len(same_stems),
        "exact_normalized_stem_options_key_groups": len(exact_groups),
        "near_duplicate_pairs": len(near),
        "answer_conflict_questions": sum(bool(q["review_reasons"]) for q in records),
        "missing_correct_markers": sum(not q["marked_answers"] for q in records),
        "missing_written_answers": sum(not q["answer_claims"] for q in records),
        "cancelled_questions": sum(q["cancelled"] for q in records),
        "multiple_correct_markers": sum(len(q["marked_answers"]) > 1 for q in records),
        "missing_display_numbers": sum(q["displayed_number"] is None for q in records),
        "unexpected_parser_records": 0,
    }
    save(ROOT / ".local-qa/biochemistry-preflight-records.json", records)
    save(ROOT / ".local-qa/biochemistry-fidelity-evidence.json", fidelity)
    save(ROOT / ".local-qa/biochemistry-drawing-evidence.json", drawings)
    save(ROOT / "docs/biochemistry-preflight.json", report)
    return report


if __name__ == "__main__":
    result = run()
    print(json.dumps({"totals": result["totals"], "anomalies": result["anomalies"], "numbering_count": len(result["numbering"]), "exact_groups": len(result["exact_stem_options_key_groups"]), "same_stem_groups": len(result["same_stem_groups"]), "near_pairs": len(result["near_duplicates"])}, ensure_ascii=False, indent=2))
