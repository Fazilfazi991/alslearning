"""Read-only acceptance against the six locally supplied client files."""
import importlib.util
import json
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("parser", ROOT / "scripts/pathology-fidelity-preflight.py")
parser = importlib.util.module_from_spec(spec)
spec.loader.exec_module(parser)
SOURCES = [ROOT / "MOQ" / source["file"] for source in
           json.loads((ROOT / "docs/pathology-preflight.json").read_text(encoding="utf-8-sig"))["records"]]


@unittest.skipUnless(all(path.is_file() for path in SOURCES), "Client source files are local, not committed")
class SourceFidelity(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.docs = [parser.parse(p) for p in SOURCES]

    def test_reconciliation(self):
        self.assertEqual([len(d) for d in self.docs], [310, 137, 168, 100, 148, 105])
        self.assertEqual(sum(not q["structural_errors"] for d in self.docs for q in d), 966)

    def test_exact_superscript_runs(self):
        self.assertEqual([(r["role"], r["text"], r["format"]) for r in self.docs[1][125]["format_runs"]],
                         [("option", "st", "superscript"), ("option", "nd", "superscript"),
                          ("option", "rd", "superscript"), ("option", "th", "superscript"),
                          ("solution", "nd", "superscript")])
        self.assertEqual([r["text"] for r in self.docs[3][67]["format_runs"]], ["nd", "th", "th", "th"])

    def test_q190_order_and_original_gif(self):
        media = self.docs[0][189]["media"]
        self.assertEqual([m["position"] for m in media], [0, 1, 2, 3])
        self.assertEqual([m["relationship"] for m in media], ["rId5", "rId6", "rId7", "rId8"])
        self.assertEqual(media[3]["mime_type"], "image/gif")
        self.assertEqual(media[3]["frames"], 1)
        self.assertEqual(media[3]["sha256"], "be60ef22ce9a2c4070e54196b978be87a44f32dc89cd5c498caa9a138f89bee3")

    def test_answer_conflicts_preserved(self):
        q = self.docs[0][189]
        self.assertEqual([o["source_designation"] for o in q["options"]], ["Incorrect", "Correct", "Incorrect", "Incorrect"])
        self.assertEqual(q["explanation"].strip(), "Ans: C")
        self.assertEqual(q["content_review"], "CONTENT REVIEW REQUIRED")
        self.assertEqual(q["structural_errors"], [])

    def test_missing_keys_are_content_quarantine(self):
        failures = [(i + 1, q["source_sequence"], q["structural_errors"]) for i, d in enumerate(self.docs) for q in d if q["structural_errors"]]
        self.assertEqual(failures, [(2, 6, ["Missing correct answer"]), (4, 43, ["Missing correct answer"])])

    def test_blank_solutions_and_unicode(self):
        self.assertTrue(all(q["explanation"] == "" for q in self.docs[3]))
        self.assertIn("A₂", self.docs[0][204]["prompt"])
        self.assertIn("’", self.docs[0][179]["options"][0]["content"])


if __name__ == "__main__": unittest.main()
