"""Inspect actual Word features before implementing canonical table support."""
from collections import Counter
import hashlib
import json
from pathlib import Path
import xml.etree.ElementTree as ET
import zipfile

ROOT = Path(__file__).resolve().parents[1]
W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
NS = {"w": W, "a": "http://schemas.openxmlformats.org/drawingml/2006/main"}


def value(e, name="val", default=None):
    return e.get(f"{{{W}}}{name}", default) if e is not None else default


def plain(e):
    return "".join(t.text or "" for t in e.findall(".//w:t", NS))


def inventory():
    files, tables = [], []
    for number in range(7, 14):
        path, = (ROOT / "MOQ").glob(f"app friendly format - JSO SIR {number} - *.docx")
        with zipfile.ZipFile(path) as archive:
            doc = ET.fromstring(archive.read("word/document.xml"))
            wrappers = doc.findall("w:body/w:tbl", NS)
            counts = Counter()
            for index, wrapper in enumerate(wrappers, 1):
                labels = [plain(r.find("w:tc", NS)).strip().lower() for r in wrapper.findall("w:tr", NS)]
                if "question" not in labels or "type" not in labels:
                    raise ValueError(f"Non-question top-level table: {path.name}/{index}")
                for row in wrapper.findall("w:tr", NS):
                    cells = row.findall("w:tc", NS)
                    role = plain(cells[0]).strip().lower()
                    for cell_index, outer in enumerate(cells[1:], 1):
                        order = []
                        for child in outer:
                            tag = child.tag.split("}")[-1]
                            if tag == "p":
                                order.append({"type": "paragraph", "text": plain(child),
                                              "images": len(child.findall(".//a:blip", NS))})
                            elif tag == "tbl":
                                order.append({"type": "table", "ordinal": sum(x["type"] == "table" for x in order) + 1})
                        for ordinal, table in enumerate(outer.findall("w:tbl", NS), 1):
                            rows = table.findall("w:tr", NS)
                            cell_features = []
                            for ri, tr in enumerate(rows):
                                for ci, tc in enumerate(tr.findall("w:tc", NS)):
                                    tags = Counter(e.tag.split("}")[-1] for e in tc.iter())
                                    formatting = Counter()
                                    for run in tc.findall(".//w:r", NS):
                                        for prop in ("b", "i", "u"):
                                            e = run.find(f"w:rPr/w:{prop}", NS)
                                            if e is not None and value(e, default="true") not in ("0", "false", "none", "off"):
                                                formatting[prop] += 1
                                        vertical = value(run.find("w:rPr/w:vertAlign", NS))
                                        if vertical in ("superscript", "subscript"):
                                            formatting[vertical] += 1
                                    cell_features.append({"row": ri, "cell": ci, "text": plain(tc),
                                        "colspan": int(value(tc.find("w:tcPr/w:gridSpan", NS), default="1")),
                                        "vertical_merge": value(tc.find("w:tcPr/w:vMerge", NS), default="continue") if tc.find("w:tcPr/w:vMerge", NS) is not None else None,
                                        "horizontal_merge": value(tc.find("w:tcPr/w:hMerge", NS), default="continue") if tc.find("w:tcPr/w:hMerge", NS) is not None else None,
                                        "paragraphs": len(tc.findall("w:p", NS)), "line_breaks": tags["br"] + tags["cr"],
                                        "list_paragraphs": tags["numPr"], "format_runs": dict(formatting),
                                        "unicode_characters": sorted(set(c for c in plain(tc) if ord(c) > 127)),
                                        "images": tags["blip"], "nested_tables": tags["tbl"],
                                        "unsupported_objects": {k: tags[k] for k in ("object", "OLEObject", "oMath", "oMathPara", "txbxContent", "shape", "pict") if tags[k]}})
                            record = {"source_document": path.name, "source_question": index, "micro": number - 6,
                                "role": role, "wrapper_cell": cell_index, "table_ordinal": ordinal,
                                "rows": len(rows), "grid_columns": len(table.findall("w:tblGrid/w:gridCol", NS)),
                                "row_cell_counts": [len(r.findall("w:tc", NS)) for r in rows],
                                "row_grid_offsets": [{"before":int(value(r.find("w:trPr/w:gridBefore",NS),default="0")),"after":int(value(r.find("w:trPr/w:gridAfter",NS),default="0"))} for r in rows],
                                "header_rows": [i for i, r in enumerate(rows) if r.find("w:trPr/w:tblHeader", NS) is not None],
                                "caption": value(table.find("w:tblPr/w:tblCaption", NS)),
                                "description": value(table.find("w:tblPr/w:tblDescription", NS)),
                                "surrounding_order": order, "cells": cell_features}
                            tables.append(record)
                            counts["tables"] += 1
            files.append({"source_document": path.name, "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
                          "top_level_questions": len(wrappers), "tables": counts["tables"]})
    return {"files": files, "tables": tables}


if __name__ == "__main__":
    result = inventory()
    (ROOT / "docs/native-table-feature-inventory.json").write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"files": result["files"], "table_count": len(result["tables"]),
        "features": [{"micro": t["micro"], "q": t["source_question"], "role": t["role"], "rows": t["rows"], "columns": t["grid_columns"],
            "merged": [c for c in t["cells"] if c["colspan"] > 1 or c["vertical_merge"] or c["horizontal_merge"]],
            "unsupported": [c for c in t["cells"] if c["nested_tables"] or c["unsupported_objects"]]}
            for t in result["tables"]]}, ensure_ascii=True, indent=2))
