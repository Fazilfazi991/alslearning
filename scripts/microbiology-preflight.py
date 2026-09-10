"""Complete local preflight. No database client, uploads, or import side effects."""
from collections import Counter, defaultdict
from difflib import SequenceMatcher
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import re
import xml.etree.ElementTree as ET
import zipfile
from PIL import Image
from media_derivatives import prepare_emf

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location("parser",ROOT/"scripts/pathology-fidelity-preflight.py")
parser=importlib.util.module_from_spec(spec);spec.loader.exec_module(parser)
NAMES=["General Microbiology","Bacteriology","Mycology","Parasitology","Virology","Applied Microbiology","Immunology"]
normalize=lambda s:" ".join(s.casefold().split())
location=lambda q:{"micro":q["micro"],"source_document":q["source_document"],"source_index":q["source_sequence"]}


def run():
    records,files,media_inventory=[],[],[]
    baseline=json.loads((ROOT/"docs/native-table-feature-inventory.json").read_text(encoding="utf-8"))
    reviewed=json.loads((ROOT/'docs/emf-visual-verification.json').read_text(encoding='utf-8'))
    def convert(data,filename,presentation):
        result=prepare_emf(data,filename,presentation,ROOT/'.local-qa/media-derivatives')
        if not any(r['original_sha256']==result['original']['sha256'] and r['display_sha256']==result['display']['sha256'] and r['visual_fidelity']=='PASS' for r in reviewed):
            raise ValueError('Derivative has not passed source visual comparison')
        return result
    for i,source in enumerate(baseline["files"],1):
        path=ROOT/"MOQ"/source["source_document"]
        assert hashlib.sha256(path.read_bytes()).hexdigest()==source["sha256"],"Source changed"
        questions=parser.parse(path,media_converter=convert)
        with zipfile.ZipFile(path) as archive:
            xml=ET.fromstring(archive.read("word/document.xml"))
            wrappers=xml.findall("w:body/w:tbl",parser.NS)
            assert len(questions)==len(wrappers)
            for q,wrapper in zip(questions,wrappers):
                q["micro"]=i
                text=q["prompt"]+"\n"+q["explanation"]+"\n"+"\n".join(o["content"] for o in q["options"])
                marked=[n for n,o in enumerate(q["options"]) if o["correct"]]
                q["written_answer_labels"]=[{"label":m[1].upper(),"clause":m[0],"offset":m.start()} for m in re.finditer(r"\b(?:Correct\s*(?:Answer|Option)|Ans(?:wer)?)\s*[:.\-–]*\s*(?:Option\s*[-:]?\s*)?\(?([A-F])\)?(?=[).:\s-]|$)",q["explanation"],re.I)]
                q["review_reasons"],q["quarantine_reasons"],q["technical_reasons"]=[],[],[]
                if re.search(r"(?:q(?:uestion|n)\s*(?:is\s*)?(?:cancelled|canceled)|(?:cancelled|canceled)\s*q(?:uestion|n))",text,re.I):q["quarantine_reasons"].append("SOURCE QUESTION CANCELLED")
                if not marked:q["quarantine_reasons"].append("MISSING/INVALID CORRECT ANSWER")
                if any(ord(a["label"])-65>=len(q["options"]) for a in q["written_answer_labels"]):q["quarantine_reasons"].append("WRITTEN ANSWER REFERENCES NONEXISTENT OPTION")
                elif marked and any(ord(a["label"])-65 not in marked for a in q["written_answer_labels"]):q["review_reasons"].append("MARKED ANSWER / WRITTEN ANSWER CONFLICT")
                if len(marked)>1:q["review_reasons"].append("MULTIPLE CORRECT MARKERS — CONFIRM MULTIPLE-ANSWER INTENT")
                for error in q["structural_errors"]:
                    if error in ("Missing correct answer","Malformed options","Invalid marks","Empty stem"):
                        if error!="Missing correct answer":q["quarantine_reasons"].append(error.upper())
                    else:q["technical_reasons"].append(error)
                tags=Counter(e.tag.split("}")[-1] for e in wrapper.iter())
                q["word_structure_counts"]={k:tags[k] for k in ("oMath","oMathPara","object","OLEObject","sym","txbxContent","pict") if tags[k]}
                if q["word_structure_counts"]:q["technical_reasons"].append("UNSUPPORTED WORD OBJECT — "+str(q["word_structure_counts"]))
                q["parser_artifacts"]=[{"character":f"U+{ord(c):04X}","count":text.count(c)} for c in ("\ufffd","\ufffe","\ufffc","\u00ad") if c in text]
                if q["parser_artifacts"]:q["review_reasons"].append("SOURCE CHARACTER ARTIFACT — FACULTY REVIEW")
                q["classification"]="TECHNICAL BLOCKER" if q["technical_reasons"] else "QUARANTINE" if q["quarantine_reasons"] else "CONTENT REVIEW REQUIRED" if q["review_reasons"] else "STRUCTURALLY READY"
                rich=[q["prompt_rich"],q["explanation_rich"],*[o["content_rich"] for o in q["options"]]]
                q["native_tables"]=sum(sum(b.get("type")=="table" for b in d["blocks"]) for d in rich)
                marks={m for d in rich for r in parser.rich_runs(d) for m in r["marks"]}
                q["format_inventory"]={k:k in marks for k in ("bold","italic","underline","superscript","subscript")}
                q["format_inventory"].update({"bullets":any(x["format"]=="bullet" for x in q.get("lists",[])) or bool(re.search("[•▪●]",text)),"numbered_lists":any(x["format"]!="bullet" for x in q.get("lists",[])),"unicode_scientific":bool(re.search(r"[µμΑ-ω⁰-₟←-⇿°×÷±≤≥]",text)),"multi_statement_stem":bool(re.search(r"(?:^|\n)\s*\(?[ivx]+[).]",q["prompt"],re.I)),"match_combination_mcq":bool(re.search(r"\bmatch\b|column\s*[AB12]",q["prompt"],re.I)) and bool(marked)})
                q["source_metadata"]={"references":q["source_reference_candidates"],"years":sorted(set(re.findall(r"\b(?:19|20)\d{2}\b",text))),"previous_label_present":bool(re.search(r"previous\s*(?:paper|qp|q\.?p\.?|question)",text,re.I)),"recalled_label_present":bool(re.search(r"\brecalled\b",text,re.I))}
                for m in q["media"]:
                    data=archive.read(m["original_filename"])
                    with Image.open(io.BytesIO(data)) as image:dimensions=list(image.size)
                    content_types=ET.fromstring(archive.read("[Content_Types].xml"))
                    extension=Path(m["original_filename"]).suffix.lstrip(".")
                    declared=next((x.get("ContentType") for x in content_types if x.get("Extension")==extension),None)
                    media_inventory.append({**location(q),**m,"dimensions":dimensions,"declared_content_type":declared})
                q["explanation_characters"]=len(q["explanation"])
                records.append(q)
        subset=[q for q in records if q["micro"]==i]
        count=Counter(q["classification"] for q in subset)
        files.append({"micro":i,"name":f"MICRO {i} - {NAMES[i-1]}","source_document":path.name,"sha256":source["sha256"],"source":len(subset),"ready":count["STRUCTURALLY READY"],"review":count["CONTENT REVIEW REQUIRED"],"quarantine":count["QUARANTINE"],"technical_blockers":count["TECHNICAL BLOCKER"],"images":sum(len(q["media"]) for q in subset),"native_tables":sum(q["native_tables"] for q in subset),"previous_paper_questions":sum(bool(q["source_reference_candidates"]) for q in subset)})
        files[-1].update({"emfs":sum(m['mime_type']=='image/x-emf' for q in subset for m in q['media']),"image_only_stems":sum(not q['prompt'].strip() and any(m['kind']=='stem' for m in q['media']) for q in subset)})
    exact,stems=defaultdict(list),defaultdict(list)
    for q in records:
        signature=(q["prompt"],tuple((o["content"],o["correct"]) for o in q["options"]))
        exact[signature].append(q);stems[normalize(q["prompt"])].append(q)
    duplicate_groups=[]
    for group in exact.values():
        if len(group)>1:duplicate_groups.append({"classification":"EXACT STEM/OPTIONS/ANSWER — POSSIBLE SOURCE COPY DUPLICATION","same_explanation":len({q["explanation"] for q in group})==1,"records":[location(q) for q in group]})
    same_stem=[]
    for group in stems.values():
        if len(group)<2:continue
        answers={tuple(normalize(o["content"]) for o in q["options"] if o["correct"]) for q in group}
        explanations={normalize(q["explanation"]) for q in group}
        if len(answers)>1 or len(explanations)>1:same_stem.append({"different_marked_answer":len(answers)>1,"different_explanation":len(explanations)>1,"records":[{**location(q),"marked_answers":[o["content"] for o in q["options"] if o["correct"]],"explanation":q["explanation"]} for q in group]})
    texts=[normalize(q["prompt"]) for q in records];tokens=[set(re.findall(r"\w+",t)) for t in texts];near=[]
    for i in range(len(records)):
        for j in range(i+1,len(records)):
            if texts[i]==texts[j] or not tokens[i] or not tokens[j]:continue
            if len(tokens[i]&tokens[j])/len(tokens[i]|tokens[j])<.8:continue
            similarity=SequenceMatcher(None,texts[i],texts[j]).ratio()
            if similarity>=.9:near.append({"records":[location(records[i]),location(records[j])],"similarity":round(similarity,4),"classification":"NEAR DUPLICATE / REPEATED CONCEPT CANDIDATE — NO CLINICAL ADJUDICATION"})
    assert len({q["source_key"] for q in records})==len(records)
    summary={"scope":"LOCAL PREFLIGHT ONLY — ZERO IMPORTS", "files":files,"total":{key:sum(f[key] for f in files) for key in ("source","ready","review","quarantine","technical_blockers","images","native_tables","previous_paper_questions")},"marks_distribution":dict(Counter(f'{q.get("marks")}/{q.get("negative_marks")}' for q in records)),"format_inventory":{k:sum(q["format_inventory"][k] for q in records) for k in records[0]["format_inventory"]},"media_mime_counts":dict(Counter(m["mime_type"] for m in media_inventory)),"stem_images":sum(m["kind"]=="stem" for m in media_inventory),"solution_images":sum(m["kind"]=="solution" for m in media_inventory),"multiple_image_questions":sum(len(q["media"])>1 for q in records),"longest_explanations":[{**location(q),"characters":q["explanation_characters"]} for q in sorted(records,key=lambda q:q["explanation_characters"],reverse=True)[:10]],"exact_duplicates":duplicate_groups,"same_stem_differences":same_stem,"near_duplicates":near,"duplicate_method":"Exact literal stem/options/answer; normalized equal stems; near token Jaccard >= .8 and character similarity >= .9. All occurrences retained, no medical equivalence inferred.","anomalies":[{**location(q),"classification":q["classification"],"marked_answers":[{"label":chr(65+i),"text":o["content"]} for i,o in enumerate(q["options"]) if o["correct"]],"written_answer_labels":q["written_answer_labels"],"explanation":q["explanation"],"review":q["review_reasons"],"quarantine":q["quarantine_reasons"],"technical":q["technical_reasons"],"parser_artifacts":q["parser_artifacts"]} for q in records if q["classification"]!="STRUCTURALLY READY"]}
    (ROOT/".local-qa/microbiology-preflight-records.json").write_text(json.dumps(records,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    summary['total'].update({key:sum(f[key] for f in files) for key in ('emfs','image_only_stems')})
    (ROOT/"docs/microbiology-preflight.json").write_text(json.dumps(summary,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    (ROOT/"docs/microbiology-media-inventory.json").write_text(json.dumps(media_inventory,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(json.dumps({"files":files,"total":summary["total"],"anomalies":len(summary["anomalies"]),"exact_groups":len(duplicate_groups),"near_pairs":len(near)},indent=2))


if __name__=="__main__":run()
