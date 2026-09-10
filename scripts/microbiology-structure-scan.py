"""Read-only structural stop-condition scan; never a completed import manifest."""
import hashlib
import json
from pathlib import Path
import xml.etree.ElementTree as ET
import zipfile

ROOT = Path(__file__).resolve().parents[1]
NS = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main",
      "a": "http://schemas.openxmlformats.org/drawingml/2006/main"}


def text(element):
    return "\n".join("".join(t.text or "" for t in p.findall(".//w:t", NS))
                     for p in element.findall(".//w:p", NS))


def scan():
    files = []
    for number in range(7, 14):
        matches = list((ROOT / "MOQ").glob(f"app friendly format - JSO SIR {number} - *.docx"))
        if len(matches) != 1:
            raise ValueError(f"Expected one source for JSO SIR {number}")
        path = matches[0]
        with zipfile.ZipFile(path) as archive:
            document = ET.fromstring(archive.read("word/document.xml"))
            tables = document.findall(".//w:tbl", NS)
            questions, nested = [], []
            for table in tables:
                rows = [(row.findall("w:tc", NS)) for row in table.findall("w:tr", NS)]
                labels = [text(cells[0]).strip().lower() for cells in rows if cells]
                if "question" not in labels or "type" not in labels:
                    continue
                index = len(questions) + 1
                question = {"source_index": index, "row_labels": labels}
                for cells in rows:
                    if len(cells) < 2:
                        continue
                    role = text(cells[0]).strip().lower()
                    if role == "question":
                        question["stem"] = text(cells[1])
                    for cell in cells[1:]:
                        for inner in cell.findall(".//w:tbl", NS):
                            nested.append({"question_index": index, "role": role,
                                "rows": [[text(c) for c in r.findall("w:tc", NS)]
                                         for r in inner.findall("w:tr", NS)],
                                "xml": ET.tostring(inner, encoding="unicode")})
                questions.append(question)
            files.append({"subhead": f"MICRO {number - 6}", "file": path.name,
                "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
                "source_questions": len(questions), "all_native_tables_including_wrappers": len(tables),
                "nested_content_tables": len(nested),
                "questions_with_nested_tables": sorted({t["question_index"] for t in nested}),
                "embedded_image_occurrences": len(document.findall(".//a:blip", NS)),
                "unclassified_native_tables": len(tables) - len(questions) - len(nested),
                "questions": questions, "native_table_evidence": nested})
    return {"scope": "Structural stop-condition scan only; content classifications not complete",
            "database_writes": 0, "media_uploads": 0, "files": files}


if __name__ == "__main__":
    result = scan()
    output = ROOT / "docs/microbiology-structure-scan.json"
    output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps([{k: v for k, v in f.items() if k not in ("questions", "native_table_evidence")}
                      for f in result["files"]], indent=2))
