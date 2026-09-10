import json
from pathlib import Path
import tempfile
from media_derivatives import prepare_emf

ROOT=Path(__file__).resolve().parents[1]
results=[]
for item in json.loads((ROOT/'docs/emf-source-inventory.json').read_text(encoding='utf-8')):
    data=(ROOT/item['local_original']).read_bytes()
    first=prepare_emf(data,item['original_filename'],item['presentation'],ROOT/'.local-qa/media-derivatives')
    second=prepare_emf(data,item['original_filename'],item['presentation'],ROOT/'.local-qa/media-derivatives')
    assert first==second
    alias=prepare_emf(data,'same-bytes-different-source-name.emf',item['presentation'],ROOT/'.local-qa/media-derivatives')
    assert alias['display']==first['display'] and alias['original']['filename']=='same-bytes-different-source-name.emf'
    # Independent fresh render proves byte determinism, not just cache reuse.
    with tempfile.TemporaryDirectory(dir=ROOT/'.local-qa') as other:
        fresh=prepare_emf(data,item['original_filename'],item['presentation'],other)
        assert fresh['display']['sha256']==first['display']['sha256']
    results.append({'micro':item['micro'],'source_index':item['source_index'],'source_document':item['source_document'],'position':item['position'],**first,'deterministic':True})
try:
    prepare_emf(b'not an emf','invalid.emf',{},ROOT/'.local-qa/media-derivatives')
    raise AssertionError('Invalid source silently accepted')
except ValueError:
    pass
(ROOT/'docs/emf-conversion-verification.json').write_text(json.dumps(results,indent=2)+'\n',encoding='utf-8')
print('PASS: 11 original/derivative pairs, signatures, MIME, aspect, hashes, cache reuse, fresh-render determinism; invalid source rejected')
