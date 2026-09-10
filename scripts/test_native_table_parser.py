"""Local parser/ordering regression and all-source native-table attachment checks."""
import importlib.util
import io
import json
from pathlib import Path
import tempfile
import unittest
import zipfile
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("parser", ROOT / "scripts/pathology-fidelity-preflight.py")
parser = importlib.util.module_from_spec(spec)
spec.loader.exec_module(parser)


def tables(doc):
    return [b for b in doc["blocks"] if b.get("type") == "table"]


class NativeTables(unittest.TestCase):
    def test_all_24_tables_and_independent_top_level_counts(self):
        fixtures, counts = [], []
        for n in range(7,14):
            path, = (ROOT / "MOQ").glob(f"app friendly format - JSO SIR {n} - *.docx")
            records = parser.parse(path)
            counts.append(len(records))
            for q in records:
                docs = [q["prompt_rich"],q["explanation_rich"],*[o["content_rich"] for o in q["options"]]]
                if any(tables(d) for d in docs):
                    fixtures.append(q)
        self.assertEqual(counts,[98,102,100,102,101,101,193])
        self.assertEqual(len(fixtures),21)
        self.assertEqual(sum(len(tables(q[k])) for q in fixtures for k in ("prompt_rich","explanation_rich")),24)
        (ROOT / ".local-qa/native-table-source-fixtures.json").write_text(json.dumps(fixtures,ensure_ascii=False,indent=2),encoding="utf-8")

    def test_boundaries_reserved_words_multiple_tables_and_order(self):
        paragraph = lambda text: f"<w:p><w:r><w:t>{text}</w:t></w:r></w:p>"
        def table(text, raw=False):
            return '<w:tbl><w:tblGrid><w:gridCol/></w:tblGrid><w:tr><w:tc>'+(text if raw else paragraph(text))+'</w:tc></w:tr></w:tbl>'
        def row(label, body, marker=""):
            return '<w:tr><w:tc>'+paragraph(label)+'</w:tc><w:tc>'+body+'</w:tc>'+('<w:tc>'+paragraph(marker)+'</w:tc>' if marker else '')+'</w:tr>'
        image='<w:p><w:r><w:drawing><a:blip r:embed="rId1"/></w:drawing></w:r></w:p>'
        inner=paragraph("Before")+table("Question Marks OPTION Correct Type")+image+paragraph("Between")+image+table("Second table")+paragraph("After")+table(image,raw=True)
        question='<w:tbl>'+row("Question",inner)+row("Type",paragraph("multiple_choice"))+row("Option",paragraph("A"),"Correct")+row("Option",paragraph("B"),"Incorrect")+row("Solution",inner)+row("Marks",paragraph("1"),"0")+'</w:tbl>'
        with tempfile.TemporaryDirectory() as temp:
            path=Path(temp)/"fixture.docx"
            with zipfile.ZipFile(path,"w") as z:
                z.writestr("word/document.xml",f'<w:document xmlns:w="{parser.W}" xmlns:a="{parser.NS["a"]}" xmlns:r="{parser.NS["r"]}"><w:body>{question}{question}</w:body></w:document>')
                z.writestr("word/_rels/document.xml.rels",'<Relationships><Relationship Id="rId1" Target="media/test.png"/></Relationships>')
                buffer=io.BytesIO();Image.new("RGB",(1,1)).save(buffer,format="PNG");z.writestr("word/media/test.png",buffer.getvalue())
            records=parser.parse(path)
        self.assertEqual(len(records),2)
        for q in records:
            self.assertEqual(len(q["options"]),2)
            self.assertEqual(q["marks"],1)
            for key in ("prompt_rich","explanation_rich"):
                self.assertEqual([b.get("type","paragraph") for b in q[key]["blocks"]],["paragraph","table","media","paragraph","media","table","paragraph","table"])
                self.assertEqual(q[key]["blocks"][-1]["rows"][0]["cells"][0]["content"]["blocks"][0]["type"],"media")
            self.assertEqual(len(q["media"]),6)

    def test_word_disabled_numbering_and_legacy_pathology_payloads(self):
        path, = (ROOT/"MOQ").glob("*SIR 7 -*.docx")
        records=parser.parse(path)
        for index in (6,32):self.assertNotIn("Unresolved list definition",records[index-1]["structural_errors"])
        old=json.loads((ROOT/".local-qa/pathology-import-input.json").read_text(encoding="utf-8"))
        baseline=json.loads((ROOT/"docs/pathology-preflight.json").read_text(encoding="utf-8-sig"))
        for source in baseline["records"]:
            for q in parser.parse(ROOT/"MOQ"/source["file"], legacy_media=True):
                original=next(r for r in old if r["source_key"]==q["source_key"])
                for key in ("prompt_rich","explanation_rich","options","media","marks","negative_marks"):
                    self.assertEqual(q[key],original[key],f'{source["file"]}/{q["source_sequence"]}/{key}')


if __name__ == "__main__": unittest.main()
