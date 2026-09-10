import importlib.util
import json
from pathlib import Path
import unittest
import zipfile
from media_derivatives import prepare_emf

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('parser',ROOT/'scripts/pathology-fidelity-preflight.py')
parser=importlib.util.module_from_spec(spec);spec.loader.exec_module(parser)

class MediaCompatibility(unittest.TestCase):
    def test_actual_image_only_stem_is_not_fabricated(self):
        path,=(ROOT/'MOQ').glob('*SIR 10 -*.docx')
        q=parser.parse(path)[70]
        self.assertEqual(q['prompt'],'')
        stem=[m for m in q['media'] if m['kind']=='stem']
        self.assertEqual(len(stem),1)
        self.assertEqual(stem[0]['mime_type'],'image/jpeg')
        self.assertNotIn('Empty stem',q['structural_errors'])
        self.assertEqual(stem[0]['alt_text'],'Entamoeba coli, smear showing cysts * \u2013 Instruments Direct')
        self.assertNotIn('title',stem[0])
        self.assertEqual(q['structural_errors'],[])
        with zipfile.ZipFile(path) as source:
            (ROOT/'.local-qa/micro-4-q71.jpeg').write_bytes(source.read(stem[0]['original_filename']))
        (ROOT/'.local-qa/image-only-source.json').write_text(json.dumps(q,indent=2)+'\n')

    def test_all_emfs_retain_source_identity_and_multiple_source_order(self):
        count=0
        for n in (8,9,10):
            path,=(ROOT/'MOQ').glob(f'*SIR {n} -*.docx')
            raw=parser.parse(path)
            converted=parser.parse(path,media_converter=lambda d,f,p:prepare_emf(d,f,p,ROOT/'.local-qa/media-derivatives'))
            self.assertEqual(len(raw),len(converted))
            for before,after in zip(raw,converted):
                self.assertEqual([m['relationship'] for m in before['media']],[m['relationship'] for m in after['media']])
                for m in after['media']:
                    if m['mime_type']=='image/x-emf':
                        count+=1
                        self.assertEqual(m['sha256'],m['derivative']['original']['sha256'])
                        self.assertEqual(m['derivative']['display']['mime_type'],'image/png')
                        self.assertNotIn('Unsupported media',after['structural_errors'])
            if n==8:self.assertEqual(len([m for m in converted[39]['media'] if m.get('derivative')]),2)
        self.assertEqual(count,11)

    def test_conversion_failure_remains_explicit(self):
        path,=(ROOT/'MOQ').glob('*SIR 8 -*.docx')
        def fail(*args):raise RuntimeError('deliberate conversion failure')
        q=parser.parse(path,media_converter=fail)[19]
        self.assertIn('Unsupported media',q['structural_errors'])
        self.assertTrue(any('deliberate conversion failure' in a for a in q['anomalies']))

if __name__=='__main__':unittest.main()
