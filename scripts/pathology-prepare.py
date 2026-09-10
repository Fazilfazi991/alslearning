"""Prepare immutable local import inputs and original media bytes. No database access."""
import hashlib
import importlib.util
import json
from pathlib import Path
import zipfile

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("parser", ROOT / "scripts/pathology-fidelity-preflight.py")
parser = importlib.util.module_from_spec(spec)
spec.loader.exec_module(parser)
baseline = json.loads((ROOT / "docs/pathology-preflight.json").read_text(encoding="utf-8-sig"))
records = []
out = ROOT / ".local-qa/pathology-media"
out.mkdir(parents=True, exist_ok=True)
for subhead, source in enumerate(baseline["records"], 1):
    path = ROOT / "MOQ" / source["file"]
    if hashlib.sha256(path.read_bytes()).hexdigest() != source["sha256"]:
        raise ValueError(f"Source hash changed: {path.name}")
    # This completed batch retains its approved v1 gallery payload on reruns.
    questions = parser.parse(path, legacy_media=True)
    if len(questions) != source["source_questions"]:
        raise ValueError("Source count changed")
    with zipfile.ZipFile(path) as archive:
        for q in questions:
            q["subhead"] = subhead
            for media in q["media"]:
                data = archive.read(media["original_filename"])
                if hashlib.sha256(data).hexdigest() != media["sha256"]:
                    raise ValueError("Media hash changed")
                (out / media["sha256"]).write_bytes(data)
    records += questions
counts = {"active": sum(not q["structural_errors"] and not q["answer_conflict"] for q in records),
          "draft": sum(q["answer_conflict"] for q in records), "quarantine": sum(bool(q["structural_errors"]) for q in records)}
assert counts == {"active": 961, "draft": 5, "quarantine": 2}, counts
(ROOT / ".local-qa/pathology-import-input.json").write_text(json.dumps(records, ensure_ascii=False, indent=2), encoding="utf-8")
quarantine = [{**q, "reason": "MISSING CORRECT ANSWER", "disposition": "Not inserted into the question bank"} for q in records if q["structural_errors"]]
(ROOT / "docs/pathology-quarantine.json").write_text(json.dumps(quarantine, ensure_ascii=False, indent=2), encoding="utf-8")
print(json.dumps({**counts, "source": len(records), "extracted_image_occurrences": sum(len(q["media"]) for q in records)}))
