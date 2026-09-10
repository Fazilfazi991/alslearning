"""Local structural evidence checks. No DB or source-file mutations."""
import importlib.util
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def module(name, filename):
    spec = importlib.util.spec_from_file_location(name, ROOT / "scripts" / filename)
    result = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(result)
    return result


class StructuralStop(unittest.TestCase):
    def test_repeat_is_deterministic_and_tables_reconcile(self):
        scanner = module("scanner", "microbiology-structure-scan.py")
        first, second = scanner.scan(), scanner.scan()
        self.assertEqual(first, second)
        self.assertEqual(len(first["files"]), 7)
        for source in first["files"]:
            self.assertEqual(source["unclassified_native_tables"], 0)
            self.assertEqual(source["all_native_tables_including_wrappers"],
                             source["source_questions"] + source["nested_content_tables"])

    def test_existing_parser_loses_general_microbiology_table(self):
        parser = module("parser", "pathology-fidelity-preflight.py")
        path = ROOT / "MOQ/app friendly format - JSO SIR 7 - GENERAL MICROBIOLOGY.docx"
        questions = parser.parse(path)
        self.assertEqual(len(questions), 105)  # 98 wrappers plus 7 content tables misidentified.
        self.assertNotIn("Quaternary ammonium compounds", questions[0]["explanation"])
        scanner = module("scanner", "microbiology-structure-scan.py")
        first_table = scanner.scan()["files"][0]["native_table_evidence"][0]
        self.assertIn("Quaternary ammonium compounds", str(first_table["rows"]))


if __name__ == "__main__":
    unittest.main()
