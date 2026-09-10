"""Analysis only. Never deduplicates or changes source records."""
from collections import defaultdict
from difflib import SequenceMatcher
import json
from pathlib import Path
import re

records = json.loads(Path(".local-qa/pathology-import-input.json").read_text(encoding="utf-8"))
def location(q): return {"subhead": q["subhead"], "sequence": q["source_sequence"], "source_document": q["source_document"]}
def normalized(s): return " ".join(s.casefold().split())
exact, stems = defaultdict(list), defaultdict(list)
for q in records:
    signature = {k:q[k] for k in ("prompt_rich", "options", "explanation_rich", "marks", "negative_marks")}
    signature["media"] = [(m["kind"], m["position"], m["sha256"]) for m in q["media"]]
    exact[json.dumps(signature, sort_keys=True)].append(q)
    stems[normalized(q["prompt"])].append(q)
same_stem = []
for group in stems.values():
    if len(group) < 2: continue
    signatures = {(tuple(normalized(o["content"]) for o in q["options"] if o["correct"]), normalized(q["explanation"])) for q in group}
    if len(signatures) > 1:
        same_stem.append({"classification":"POTENTIAL CONTRADICTORY DUPLICATE — faculty review required",
                          "records":[{**location(q),"marked_answers":[o["content"] for o in q["options"] if o["correct"]],"solution":q["explanation"]} for q in group]})
near = []
texts = [normalized(q["prompt"]) for q in records]
tokens = [set(re.findall(r"\w+", t)) for t in texts]
for i, q in enumerate(records):
    for j in range(i+1,len(records)):
        if texts[i] == texts[j] or not tokens[i] or not tokens[j]: continue
        if len(tokens[i] & tokens[j])/len(tokens[i] | tokens[j]) < .8: continue
        similarity = SequenceMatcher(None,texts[i],texts[j]).ratio()
        if similarity >= .9: near.append({"records":[location(q),location(records[j])],"similarity":round(similarity,4)})
result = {"policy":"All source occurrences retained; similarities are lexical candidates, not clinical equivalence judgments",
          "exact_groups":[[location(q) for q in group] for group in exact.values() if len(group)>1],
          "same_stem_differing_answer_or_solution":same_stem,"near_pairs":near,
          "near_threshold":"Token Jaccard >= 0.8 and character similarity >= 0.9, excluding identical stems"}
Path("docs/pathology-duplicates.json").write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding="utf-8")
print(json.dumps({"exact_groups":len(result["exact_groups"]),"potential_contradictory_groups":len(same_stem),"near_pairs":len(near)}))
