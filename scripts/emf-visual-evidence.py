"""Pair source Word PDF pages and final derivatives for manual visual review."""
import json
from pathlib import Path
import pypdfium2 as pdf
from PIL import Image,ImageDraw
root=Path(__file__).resolve().parents[1]
pages=json.loads((root/'.local-qa/emf/source-pages.json').read_text(encoding='utf-8-sig'))
records=json.loads((root/'docs/emf-conversion-verification.json').read_text())
for index,r in enumerate(records,1):
    p=next(p for p in pages if p['source']==r['source_document'] and p['filename']==r['original']['filename'])
    doc=pdf.PdfDocument(root/f'.local-qa/emf/word-source-{r["micro"]+6}.pdf')
    source=doc[p['page']-1].render(scale=2).to_pil().convert('RGB')
    display=Image.open(root/r['display']['local_path']).convert('RGB')
    canvas=Image.new('RGB',(1900,1500),'#ddd')
    ImageDraw.Draw(canvas).text((10,10),f'MICRO {r["micro"]} Q{r["source_index"]} | Word source page {p["page"]} | final PNG derivative',fill='black')
    source.thumbnail((930,1440));display.thumbnail((930,1400))
    canvas.paste(source,(10,50));canvas.paste(display,(960,60))
    canvas.save(root/f'.local-qa/emf/final-comparison-{index}.jpg')
