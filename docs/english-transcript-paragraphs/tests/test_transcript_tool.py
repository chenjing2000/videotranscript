import copy
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

HERE=Path(__file__).resolve().parent
SKILL=HERE.parent
TOOL=SKILL/'scripts'/'transcript_tool.py'
REPO=SKILL.parents[1]
RAW=REPO/'fixtures'/'6 Minute English 01-seg1.json'

class ContractTest(unittest.TestCase):
    def run_tool(self,*args,ok=True):
        run=subprocess.run([sys.executable,str(TOOL),*map(str,args)],capture_output=True,text=True)
        if ok:self.assertEqual(run.returncode,0,run.stderr)
        else:self.assertNotEqual(run.returncode,0)
        return run
    def test_unchanged_source_and_200_words(self):
        with tempfile.TemporaryDirectory() as d:
            d=Path(d);bound=d/'breaks.json';out=d/'6 Minute English 01-seg1.evr-transcript.json';preview=d/'read.md'
            bound.write_text(json.dumps({'paragraphBreaksAfter':['s3w2','s4w9','s8w20']}),encoding='utf8')
            original=RAW.read_bytes()
            self.run_tool('build',RAW,'--boundaries',bound,'--output',out,'--preview',preview)
            self.run_tool('validate',out,'--source',RAW)
            self.assertEqual(RAW.read_bytes(),original)
            contents=json.loads(out.read_text())
            self.assertEqual(len(contents['segments']),13)
            self.assertEqual(sum(len(s['words']) for s in contents['segments']),200)
            self.assertEqual(contents['evr']['paragraphBreaksAfter'],['s3w2','s4w9','s8w20'])
            self.assertIn('personality',preview.read_text())
            self.run_tool('build',RAW,'--boundaries',bound,'--output',out,ok=False)  # no overwrite
    def test_bad_boundary_and_filename(self):
        with tempfile.TemporaryDirectory() as d:
            d=Path(d);bound=d/'breaks.json';out=d/'wrong.json'
            bound.write_text(json.dumps({'paragraphBreaksAfter':['s99w0']}),encoding='utf8')
            self.run_tool('build',RAW,'--boundaries',bound,'--output',out,ok=False)
            out=d/'correct.evr-transcript.json'
            self.run_tool('build',RAW,'--boundaries',bound,'--output',out,ok=False)
            bound.write_text(json.dumps({'paragraphBreaksAfter':['s3w2','s3w2']}),encoding='utf8')
            self.run_tool('build',RAW,'--boundaries',bound,'--output',out,ok=False)
    def test_bad_word_no_fake_timestamp(self):
        with tempfile.TemporaryDirectory() as d:
            d=Path(d);src=copy.deepcopy(json.loads(RAW.read_text()));src['segments'][0]['words'][0]['start']=-3
            bad=d/'bad.json';bad.write_text(json.dumps(src),encoding='utf8')
            self.run_tool('inspect',bad,ok=False)
    def test_raw_is_not_directly_accepted(self):
        self.run_tool('validate',RAW,ok=False)

if __name__=='__main__':unittest.main()
