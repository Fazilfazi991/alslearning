"""Deterministic local source/display asset preparation. Never uploads."""
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
KIND = 'windows-gdiplus-emf-docx-png-600dpi-white'
VERSION = '1'

def prepare_emf(data, filename, presentation, cache):
    if len(data) < 88 or data[:4] != b'\x01\0\0\0' or data[40:44] != b' EMF':
        raise ValueError('Invalid EMF signature')
    shell = shutil.which('pwsh') or shutil.which('powershell')
    if not shell:
        raise RuntimeError('EMF conversion requires Windows GDI+ and PowerShell')
    cache = Path(cache); cache.mkdir(parents=True, exist_ok=True)
    source_hash = hashlib.sha256(data).hexdigest()
    recipe = json.dumps({'kind':KIND,'version':VERSION,'presentation':presentation},sort_keys=True,separators=(',',':'))
    key = hashlib.sha256((source_hash+recipe).encode()).hexdigest()
    original = cache / f'{source_hash}.emf'
    display = cache / f'{key}.png'
    manifest = cache / f'{key}.json'
    if original.exists() and original.read_bytes() != data:
        raise ValueError('Cached original checksum mismatch')
    original.write_bytes(data)
    if manifest.exists():
        result = json.loads(manifest.read_text())
        if not display.exists() or hashlib.sha256(display.read_bytes()).hexdigest() != result['display']['sha256']:
            raise ValueError('Cached derivative checksum mismatch')
        # The display cache is shared by bytes/recipe, but source filenames belong
        # to each source occurrence, including identical assets with different names.
        return {**result,'original':{**result['original'],'filename':filename}}
    command = [shell,'-NoProfile','-File',str(ROOT/'scripts/convert-emf.ps1'),'-InputPath',str(original),'-OutputPath',str(display),'-PresentationJson',json.dumps(presentation,separators=(',',':'))]
    run = subprocess.run(command,capture_output=True,text=True,timeout=90)
    if run.returncode:
        raise RuntimeError('EMF conversion failed: '+run.stderr[-1000:])
    info = json.loads(run.stdout)
    with Image.open(display) as image:
        if image.format != 'PNG' or list(image.size) != [info['width'],info['height']]:
            raise ValueError('Invalid display derivative')
    expected_ratio = presentation['extent_emu']['cx']/presentation['extent_emu']['cy']
    if abs(info['width']/info['height']/expected_ratio-1) > 1/info['width']+1/info['height']:
        raise ValueError('Derivative aspect ratio differs from source DOCX')
    result = {'original':{'local_path':str(original.relative_to(ROOT)), 'filename':filename,'mime_type':'image/x-emf','sha256':source_hash,'bytes':len(data)},
              'display':{'local_path':str(display.relative_to(ROOT)),'mime_type':'image/png','sha256':hashlib.sha256(display.read_bytes()).hexdigest(),'width':info['width'],'height':info['height'],'bytes':display.stat().st_size},
              'conversion':{'kind':KIND,'version':VERSION,'presentation':presentation,'cache_key':key}}
    manifest.write_text(json.dumps(result,indent=2)+'\n')
    return result
