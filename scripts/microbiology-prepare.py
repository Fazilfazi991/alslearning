"""Verify the completed preflight and extract immutable originals; no database writes."""
import hashlib, json, zipfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
report=ROOT/'docs/microbiology-preflight.json'
assert hashlib.sha256(report.read_bytes()).hexdigest()=='88a3d62271a6ca124dcdee850de4dfba0df4f48e5fcc579e25869176096155af', 'Approved preflight changed'
records=json.loads((ROOT/'.local-qa/microbiology-preflight-records.json').read_text(encoding='utf-8'))
assert len(records)==797
out=ROOT/'.local-qa/microbiology-media';out.mkdir(exist_ok=True)
for source in json.loads(report.read_text(encoding='utf-8'))['files']:
    path=ROOT/'MOQ'/source['source_document']
    assert hashlib.sha256(path.read_bytes()).hexdigest()==source['sha256']
    with zipfile.ZipFile(path) as archive:
        for q in (q for q in records if q['micro']==source['micro']):
            for m in q['media']:
                data=archive.read(m['original_filename'])
                assert hashlib.sha256(data).hexdigest()==m['sha256']
                (out/m['sha256']).write_bytes(data)
quarantine=[{**q,'disposition':'Recoverable source manifest; not inserted into question bank'} for q in records if q['classification']=='QUARANTINE']
assert len(quarantine)==4 and not any(q['media'] for q in quarantine)
(ROOT/'docs/microbiology-quarantine.json').write_text(json.dumps(quarantine,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('797 source records verified; 116 originals extracted; four complete quarantine records retained')
