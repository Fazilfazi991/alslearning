"""Read-only DOCX asset inspection; extracted originals stay local."""
import hashlib
import json
from pathlib import Path
import struct
import zipfile
import xml.etree.ElementTree as ET
from collections import Counter

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / '.local-qa/emf'
OUT.mkdir(parents=True, exist_ok=True)
media = json.loads((ROOT / 'docs/microbiology-media-inventory.json').read_text(encoding='utf-8'))
records = []
for item in media:
    item = {k:v for k,v in item.items() if k != 'derivative'}
    if not item['original_filename'].lower().endswith('.emf'):
        continue
    with zipfile.ZipFile(ROOT / 'MOQ' / item['source_document']) as z:
        data = z.read(item['original_filename'])
        xml = ET.fromstring(z.read('word/document.xml'))
        ns = {'a':'http://schemas.openxmlformats.org/drawingml/2006/main', 'w':'http://schemas.openxmlformats.org/wordprocessingml/2006/main', 'wp':'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing'}
        drawing = next(d for d in xml.findall('.//w:drawing',ns) if any(b.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}embed') == item['relationship'] for b in d.findall('.//a:blip',ns)))
        crop = drawing.find('.//a:srcRect',ns)
        extent = drawing.find('.//wp:extent',ns)
        presentation = {'crop':{k:int(crop.get(k,'0')) if crop is not None else 0 for k in ('l','t','r','b')}, 'extent_emu':{k:int(extent.get(k)) for k in ('cx','cy')}}
        inline_index = next(i for i,b in enumerate(xml.findall('.//a:blip',ns),1) if b.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}embed')==item['relationship'])
    assert data[:4] == struct.pack('<I', 1) and data[40:44] == b' EMF'
    bounds = struct.unpack_from('<4i', data, 8)
    frame = struct.unpack_from('<4i', data, 24)
    types = Counter()
    offset = 0
    while offset < len(data):
        kind, size = struct.unpack_from('<2I', data, offset)
        assert size >= 8 and offset + size <= len(data)
        types[kind] += 1
        offset += size
    name = f'micro-{item["micro"]}-q{item["source_index"]}-{Path(item["original_filename"]).name}'
    (OUT / name).write_bytes(data)
    records.append({**item, 'bytes': len(data), 'original_sha256': hashlib.sha256(data).hexdigest(),
        'local_original': str((OUT / name).relative_to(ROOT)), 'inline_index': inline_index, 'presentation': presentation, 'bounds': bounds,
        'frame_01mm': frame, 'record_types': dict(sorted(types.items())),
        'vector_text_records': sum(types[t] for t in (83,84,96,97,108)),
        'raster_records': sum(types[t] for t in (76,77,78,79,80,81,114,116)),
        'alpha_blend_records': types[114], 'transparent_blit_records': types[116]})
assert len(records) == 11
for r in records:
    r['duplicate_locations'] = [f'MICRO {s["micro"]} Q{s["source_index"]}' for s in records if s is not r and s['original_sha256'] == r['original_sha256']]
(ROOT / 'docs/emf-source-inventory.json').write_text(json.dumps(records, indent=2, ensure_ascii=False)+'\n', encoding='utf-8')
for r in records:
    print(f'MICRO {r["micro"]} Q{r["source_index"]}: {r["bytes"]} bytes, bounds {r["bounds"]}, text {r["vector_text_records"]}, raster {r["raster_records"]}, alpha {r["alpha_blend_records"]}, types {r["record_types"]}')
