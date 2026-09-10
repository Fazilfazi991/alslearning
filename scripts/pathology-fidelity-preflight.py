"""Offline DOCX parser. Never connects to a database or imports questions.

Writes full source-preserving candidate records to an explicitly requested local
output, and a small reconciliation report to stdout. Images remain original bytes
inside DOCX until a later authorized import; relationships and hashes are recorded.
"""
import argparse
from collections import Counter, defaultdict
import hashlib
import io
import json
from pathlib import Path, PurePosixPath
import re
import xml.etree.ElementTree as ET
import zipfile
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
NS = {"w": W, "a": "http://schemas.openxmlformats.org/drawingml/2006/main",
      "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships"}


def attr(element, name="val", default=None):
    return element.get("{" + W + "}" + name, default) if element is not None else default


def plain(doc):
    return "\n".join("".join(r["text"] for r in b["runs"]) for b in doc["blocks"])


def raw(cell):
    return "".join(x.text or "" for x in cell.findall(".//w:t", NS))


def parse(path):
    file_hash = hashlib.sha256(path.read_bytes()).hexdigest()
    with zipfile.ZipFile(path) as archive:
        root = ET.fromstring(archive.read("word/document.xml"))
        relationships = {x.get("Id"): x.get("Target") for x in ET.fromstring(archive.read("word/_rels/document.xml.rels"))}
        numbering, abstract, counters = {}, {}, defaultdict(lambda: defaultdict(int))
        if "word/numbering.xml" in archive.namelist():
            nums = ET.fromstring(archive.read("word/numbering.xml"))
            abstract = {attr(a, "abstractNumId"): {attr(l, "ilvl"): l for l in a.findall("w:lvl", NS)} for a in nums.findall("w:abstractNum", NS)}
            numbering = {attr(n, "numId"): attr(n.find("w:abstractNumId", NS)) for n in nums.findall("w:num", NS)}
        questions = []
        for sequence, table in enumerate(root.findall(".//w:tbl", NS), 1):
            q = {"source_document": path.name, "source_sha256": file_hash, "source_sequence": sequence,
                 "source_key": f"{file_hash}:{sequence}", "options": [], "media": [], "anomalies": [], "format_runs": []}

            def content(cell, role):
                blocks = []
                for paragraph in cell.findall("w:p", NS):
                    runs = []
                    num = paragraph.find("w:pPr/w:numPr", NS)
                    if num is not None:
                        num_id, level = attr(num.find("w:numId", NS)), attr(num.find("w:ilvl", NS), default="0")
                        definition = abstract.get(numbering.get(num_id), {}).get(level)
                        if definition is None:
                            q["anomalies"].append("Unresolved list definition")
                        else:
                            fmt = attr(definition.find("w:numFmt", NS))
                            label = attr(definition.find("w:lvlText", NS), default="")
                            if fmt == "decimal":
                                counters[num_id][level] += 1
                                label = re.sub(r"%([1-9])", lambda m: str(counters[num_id][str(int(m[1])-1)] or 1), label)
                            elif fmt == "bullet":
                                # Word's Symbol-font bullet has private-use encoding.
                                label = {"\uf0b7": "•", "\uf0a7": "▪", "o": "○"}.get(label, label)
                            else:
                                q["anomalies"].append(f"Unsupported list format: {fmt}")
                            runs.append({"text": label + "\t", "marks": []})
                            q.setdefault("lists", []).append({"role": role, "num_id": num_id, "level": level, "format": fmt, "marker": label})
                    for run in paragraph.findall(".//w:r", NS):
                        marks = []
                        for prop, mark in [("b", "bold"), ("i", "italic"), ("u", "underline")]:
                            value = run.find(f"w:rPr/w:{prop}", NS)
                            if value is not None and attr(value, default="true") not in ("0", "false", "none", "off"):
                                marks.append(mark)
                        vertical = attr(run.find("w:rPr/w:vertAlign", NS))
                        if vertical in ("superscript", "subscript"):
                            marks.append(vertical)
                        text = ""
                        for node in run:
                            tag = node.tag.split("}")[-1]
                            if tag == "t": text += node.text or ""
                            elif tag in ("br", "cr"): text += "\n"
                            elif tag == "tab": text += "\t"
                            elif tag == "noBreakHyphen": text += "‑"
                            elif tag == "softHyphen": text += "\u00ad"
                        if text:
                            runs.append({"text": text, "marks": marks})
                            if vertical in ("superscript", "subscript"):
                                q["format_runs"].append({"role": role, "text": text, "format": vertical})
                        for blip in run.findall(".//a:blip", NS):
                            rid = blip.get("{" + NS["r"] + "}embed")
                            target = relationships.get(rid)
                            if not target:
                                q["anomalies"].append("Unresolved image relationship")
                                continue
                            media_path = str(PurePosixPath("word") / target)
                            data = archive.read(media_path)
                            with Image.open(io.BytesIO(data)) as image:
                                mime = Image.MIME.get(image.format)
                                frames = getattr(image, "n_frames", 1)
                            kind = "stem" if role == "question" else "solution" if role == "solution" else "option"
                            if kind == "option": q["anomalies"].append("Option image requires separate support")
                            q["media"].append({"kind": kind, "position": sum(m["kind"] == kind for m in q["media"]),
                                "relationship": rid, "original_filename": media_path, "mime_type": mime,
                                "sha256": hashlib.sha256(data).hexdigest(), "bytes": len(data), "frames": frames,
                                "paragraph_index": len(blocks), "after_run": len(runs),
                                "source_document": path.name, "source_sequence": sequence})
                    blocks.append({"runs": runs})
                return {"version": 1, "blocks": blocks}

            for row in table.findall("w:tr", NS):
                cells = row.findall("w:tc", NS)
                label = raw(cells[0]).strip().lower() if cells else ""
                if label in ("question", "solution") and len(cells) > 1:
                    q["prompt_rich" if label == "question" else "explanation_rich"] = content(cells[1], label)
                elif label == "option" and len(cells) >= 3:
                    designation = raw(cells[-1]).strip()
                    q["options"].append({"content_rich": content(cells[1], "option"), "source_designation": designation,
                                         "correct": designation.lower() == "correct"})
                    if designation.lower() not in ("correct", "incorrect"):
                        q["anomalies"].append(f"Unknown answer marking: {designation}")
                elif label == "type":
                    q["source_question_type"] = raw(cells[1]).strip()
                elif label == "marks":
                    try:
                        q["marks"] = float(raw(cells[1]).strip())
                        q["negative_marks"] = float(raw(cells[2]).strip())
                    except (ValueError, IndexError):
                        q["anomalies"].append("Invalid marks")
                elif label:
                    q["anomalies"].append(f"Unknown row: {label}")
            q["prompt"] = plain(q.get("prompt_rich", {"blocks": []}))
            q["explanation"] = plain(q.get("explanation_rich", {"blocks": []}))
            for option in q["options"]: option["content"] = plain(option["content_rich"])
            correct = [i for i, o in enumerate(q["options"]) if o["correct"]]
            q["type"] = "multiple_mcq" if len(correct) > 1 else "single_mcq"
            errors = []
            if not q["prompt"].strip(): errors.append("Empty stem")
            if q.get("source_question_type") != "multiple_choice": errors.append("Unsupported source type")
            if len(q["options"]) < 2 or any(not o["content"].strip() for o in q["options"]): errors.append("Malformed options")
            if not correct: errors.append("Missing correct answer")
            if q.get("marks", 0) <= 0 or q.get("negative_marks", -1) < 0: errors.append("Invalid marks")
            if any(m["mime_type"] not in ("image/png", "image/jpeg", "image/gif", "image/webp") for m in q["media"]): errors.append("Unsupported media")
            errors += q["anomalies"]
            q["structural_errors"] = sorted(set(errors))
            answer = re.search(r"\b(?:Ans(?:wer)?)[\s:.-]+([A-D])\b", q["explanation"], re.I)
            q["answer_conflict"] = bool(answer and [ord(answer[1].upper()) - 65] != correct)
            q["content_review"] = "CONTENT REVIEW REQUIRED" if q["answer_conflict"] else None
            q["rich_text"] = any(r["marks"] for d in [q.get("prompt_rich"), q.get("explanation_rich"), *[o["content_rich"] for o in q["options"]]] if d for b in d["blocks"] for r in b["runs"]) or bool(q.get("lists"))
            references = list(dict.fromkeys(re.findall(r"\b\d{3}/(?:19|20)\d{2}\b", q["prompt"] + "\n" + q["explanation"])))
            q["source_reference_candidates"] = references
            q["source_type"] = "standard"  # requires scope review before any previous-paper mapping
            questions.append(q)
        return questions


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--records", required=True, help="Local candidate JSON output; never a database import")
    args = parser.parse_args()
    records, report = [], []
    for index, path in enumerate(sorted((ROOT / "MOQ").glob("*.docx")), 1):
        questions = parse(path)
        records += questions
        report.append({"subhead": f"PATHO {index}", "questions": len(questions),
            "rich_text": sum(q["rich_text"] for q in questions),
            "superscript_questions": sum(any(r["format"] == "superscript" for r in q["format_runs"]) for q in questions),
            "subscript_questions": sum(any(r["format"] == "subscript" for r in q["format_runs"]) for q in questions),
            "questions_with_images": sum(bool(q["media"]) for q in questions),
            "multiple_image_questions": sum(len(q["media"]) > 1 for q in questions),
            "images": sum(len(q["media"]) for q in questions),
            "gifs": sum(m["mime_type"] == "image/gif" for q in questions for m in q["media"]),
            "unsupported_media": sum(m["mime_type"] not in ("image/png", "image/jpeg", "image/gif", "image/webp") for q in questions for m in q["media"]),
            "conflicts": [q["source_sequence"] for q in questions if q["answer_conflict"]],
            "structurally_ready": sum(not q["structural_errors"] for q in questions),
            "malformed": [{"sequence": q["source_sequence"], "errors": q["structural_errors"]} for q in questions if q["structural_errors"]],
            "format_runs": [{"sequence": q["source_sequence"], "runs": q["format_runs"]} for q in questions if q["format_runs"]]})
    duplicates = defaultdict(list)
    for q in records:
        key = json.dumps({**{k: q.get(k) for k in ("prompt_rich", "options", "explanation_rich", "marks", "negative_marks")}, "media": [(m["kind"], m["position"], m["sha256"]) for m in q["media"]]}, sort_keys=True, ensure_ascii=False)
        duplicates[key].append({"file": q["source_document"], "sequence": q["source_sequence"]})
    Path(args.records).write_text(json.dumps(records, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"imported": 0, "pending": len(records), "documents": report,
                      "exact_duplicate_groups": [v for v in duplicates.values() if len(v) > 1],
                      "duplicate_definition": "Identical text AST, options/markings, solution AST, and marks; source locations retained; no deduplication",
                      "conflict_detection": "Explicit Ans/Answer A-D mismatches; not a clinical review"}, ensure_ascii=False, indent=2))


if __name__ == "__main__": main()
