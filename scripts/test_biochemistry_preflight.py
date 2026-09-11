"""Biochemistry source acceptance; read-only, no database clients."""
import hashlib
import importlib.util
import json
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("bio", ROOT / "scripts/biochemistry-preflight.py")
bio = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bio)


@unittest.skipUnless(all((ROOT / "MOQ" / f).exists() for _, f in bio.MAPPING), "Local client sources required")
class BiochemistryPreflight(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.before = {f: hashlib.sha256((ROOT / "MOQ" / f).read_bytes()).hexdigest() for _, f in bio.MAPPING}
        cls.report = bio.run()
        cls.questions = json.loads((ROOT / ".local-qa/biochemistry-preflight-records.json").read_text(encoding="utf-8"))

    def test_independent_source_counts_and_classifications(self):
        self.assertEqual([f["source"] for f in self.report["files"]], [32, 46, 44, 200, 42, 202, 85, 63])
        self.assertEqual([self.report["totals"][k] for k in ("source", "ready", "review", "quarantine", "technical_blockers")], [714, 708, 5, 1, 0])
        for f in self.report["files"]:
            self.assertEqual(f["source"], sum(f[k] for k in ("ready", "review", "quarantine", "technical_blockers")))

    def test_named_answer_disagreements_and_additional_claim(self):
        self.assertEqual([(q["bio"], q["source_sequence"]) for q in self.questions if q["classification"] == "CONTENT REVIEW REQUIRED"], [(6, 73), (6, 77), (6, 135), (6, 172), (6, 188)])
        q = next(q for q in self.questions if q["bio"] == 6 and q["source_sequence"] == 77)
        self.assertEqual(q["marked_answers"], ["C"])
        self.assertEqual([c["label"] for c in q["answer_claims"]], ["C", "D"])
        self.assertEqual(q["type"], "single_mcq")

    def test_missing_marker_does_not_copy_written_answer(self):
        q = next(q for q in self.questions if q["bio"] == 5 and q["source_sequence"] == 31)
        self.assertEqual(q["classification"], "QUARANTINE")
        self.assertFalse(any(o["correct"] for o in q["options"]))
        self.assertEqual(q["explanation"], "Correct Answer: C) Cytoplasm")

    def test_both_sir19_files_have_disjoint_stable_source_keys(self):
        groups = [{q["source_key"] for q in self.questions if q["bio"] == n} for n in (6, 7)]
        self.assertFalse(groups[0] & groups[1])
        self.assertEqual(len({q["scoped_source_identity"] for q in self.questions}), 714)
        for q in self.questions:
            self.assertEqual(q["source_key"], f'{q["source_sha256"]}:{q["source_sequence"]}')

    def test_numberless_records_never_change_boundaries(self):
        self.assertEqual([n["location"] for n in self.report["numbering"]], ["BIO 3 Q39", "BIO 7 Q48", "BIO 8 Q57"])
        self.assertTrue(all(n["displayed_number"] is None for n in self.report["numbering"]))
        self.assertTrue(all(q["source_question_type"] == "multiple_choice" for q in self.questions))

    def test_tables_and_bullets_preserve_source_order(self):
        self.assertEqual(len(self.report["native_table_inventory"]), 8)
        self.assertTrue(all(t["canonical_order_matches"] for t in self.report["native_table_inventory"]))
        for q in self.questions:
            for part in q["source_order"]:
                self.assertEqual(part["source"], part["canonical"])
                self.assertTrue(part["text_exact_ignoring_whitespace"])
        self.assertEqual(sum(len(q.get("lists", [])) for q in self.questions), 10)

    def test_scientific_runs_and_decorative_shapes(self):
        self.assertEqual(sum(len(q["format_runs"]) for q in self.questions), 13)
        self.assertEqual(self.report["decorative_separators"], 714)
        self.assertEqual(sum(f["package_media_count"] for f in self.report["files"]), 0)
        self.assertEqual(sum(f["word_structure_counts"]["oMath"] for f in self.report["files"]), 0)

    def test_rerun_and_source_integrity(self):
        self.assertEqual(self.report, bio.run())
        self.assertEqual(self.before, {f: hashlib.sha256((ROOT / "MOQ" / f).read_bytes()).hexdigest() for _, f in bio.MAPPING})


if __name__ == "__main__":
    unittest.main()
