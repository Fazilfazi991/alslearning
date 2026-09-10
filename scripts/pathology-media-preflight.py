"""Read-only source inventory. Does not import, upload, or alter client DOCX files."""
import hashlib
import io
import json
from pathlib import Path
import xml.etree.ElementTree as ET
import zipfile

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
NS = {
    "w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main",
    "a": "http://schemas.openxmlformats.org/drawingml/2006/main",
    "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
}


def text(element):
    return "".join(t.text or "" for t in element.findall(".//w:t", NS))


def inspect(path):
    with zipfile.ZipFile(path) as archive:
        document = ET.fromstring(archive.read("word/document.xml"))
        tables = document.findall(".//w:tbl", NS)
        media = []
        formatting = []
        for sequence, table in enumerate(tables, 1):
            for row in table.findall("w:tr", NS):
                cells = row.findall("w:tc", NS)
                role = text(cells[0]).strip().lower() if cells else ""
                for index, cell in enumerate(cells[1:], 1):
                    for run in cell.findall(".//w:r", NS):
                        alignment = run.find("w:rPr/w:vertAlign", NS)
                        if alignment is not None:
                            formatting.append({
                                "sequence": sequence, "row": role, "cell": index,
                                "text": text(run),
                                "format": alignment.get("{" + NS["w"] + "}val"),
                            })
                    for blip in cell.findall(".//a:blip", NS):
                        media.append({"sequence": sequence, "role": role,
                                      "relationship": blip.get("{" + NS["r"] + "}embed")})
        gifs = []
        for name in archive.namelist():
            if name.lower().endswith(".gif"):
                data = archive.read(name)
                with Image.open(io.BytesIO(data)) as image:
                    gifs.append({"file": name, "frames": image.n_frames,
                                 "size": list(image.size), "sha256": hashlib.sha256(data).hexdigest()})
        stem = {m["sequence"] for m in media if m["role"] == "question"}
        solution = {m["sequence"] for m in media if m["role"] == "solution"}
        multiple = {m["sequence"] for m in media
                    if sum(x["sequence"] == m["sequence"] for x in media) > 1}
        return {"file": path.name, "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
                "source_questions": len(tables), "questions_with_stem_images": len(stem),
                "questions_with_solution_images": len(solution),
                "questions_with_multiple_images": len(multiple), "image_occurrences": len(media),
                "media": media, "gifs": gifs, "vertical_format_runs": formatting}


if __name__ == "__main__":
    print(json.dumps({"status": "blocked_before_media_extension",
                      "full_structural_validation": "not_completed",
                      "records": [inspect(p) for p in sorted((ROOT / "MOQ").glob("*.docx"))]},
                     ensure_ascii=False, indent=2))
