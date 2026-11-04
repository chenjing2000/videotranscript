import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

SCRIPT=Path(__file__).resolve().parents[1]/'scripts'/'transcript_tool.py'
spec=importlib.util.spec_from_file_location('transcript_studio_tool',SCRIPT)
mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)
SOURCE=Path(__file__).resolve().parents[4]/'fixtures'/'6 Minute English 01-seg1.json'

class TestTranscriptTool(unittest.TestCase):
    def setUp(self): self.raw=json.loads(SOURCE.read_text(encoding='utf-8'))
    def test_validate_fixture_and_exact_source(self):
        fixture=SOURCE.with_name('6 Minute English 01-seg1.transcript-studio.json')
        data=mod.load(fixture);self.assertEqual(len(mod.check(data,fixture)),200)
        stripped=json.loads(json.dumps(data));stripped.pop('transcript_studio')
        for seg in stripped['segments']:
            for w in seg['words']:w.pop('breakParagraph',None)
        self.assertEqual(stripped,self.raw)
    def test_build_then_validate_without_source_mutation(self):
        with tempfile.TemporaryDirectory() as folder:
            d=Path(folder);src=d/'input.json';src.write_text(json.dumps(self.raw),encoding='utf-8')
            decisions=d/'decisions.json';decisions.write_text(json.dumps({'breakAfterWordIds':['s3w2','s10w38']}),encoding='utf-8')
            out=d/'input.transcript-studio.json';preview=d/'input.paragraphs.md'
            args=type('Args',(),{'input':src,'boundaries':decisions,'output':out,'preview':preview,'force':False})
            mod.build(args);mod.validate(type('VArgs',(),{'input':out,'source':src,'preview':None}))
            self.assertEqual(len(mod.check(mod.load(out))),200)
            self.assertTrue(mod.load(out)['segments'][3]['words'][2]['breakParagraph'])
            self.assertNotIn('breakParagraph',mod.load(out)['segments'][-1]['words'][-1])
            self.assertIn('\n\n',preview.read_text(encoding='utf-8'))
    def test_edit_changes_only_word_break_markers(self):
        with tempfile.TemporaryDirectory() as folder:
            d=Path(folder)
            original=SOURCE.with_name('6 Minute English 01-seg1.transcript-studio.json')
            decision=d/'revised.json';decision.write_text(json.dumps({'breakAfterWordIds':['s10w38']}),encoding='utf-8')
            out=d/'edited.transcript-studio.json'
            mod.edit(type('Args',(),{'input':original,'boundaries':decision,'output':out,'preview':None,'force':False}))
            v=mod.load(out);self.assertEqual(sum(w.get('breakParagraph') is True for _,w in mod.words_of(v)),1)
            stripped=json.loads(json.dumps(v));stripped.pop('transcript_studio')
            for seg in stripped['segments']:
                for w in seg['words']: w.pop('breakParagraph',None)
            self.assertEqual(stripped,self.raw)
    def test_bad_markers_fail(self):
        fixture=SOURCE.with_name('6 Minute English 01-seg1.transcript-studio.json')
        data=mod.load(fixture)
        data['segments'][0]['words'][0]['breakParagraph']=False
        with self.assertRaises(mod.ValidationError):mod.check(data)
        del data['segments'][0]['words'][0]['breakParagraph']
        data['segments'][-1]['words'][-1]['breakParagraph']=True
        with self.assertRaises(mod.ValidationError):mod.check(data)
    def test_old_format_rejected(self):
        with self.assertRaises(mod.ValidationError):mod.check(self.raw)
        with self.assertRaises(mod.ValidationError):mod.check({**self.raw,'evr':{'format':'evr-transcript','schemaVersion':1}})
    def test_bad_decision_ids(self):
        ids=[ident for ident,_ in mod.words_of(self.raw)]
        with tempfile.TemporaryDirectory() as folder:
            path=Path(folder)/'decisions.json'
            for bad in [['s999w0'],['s1w0','s1w0'],[ids[-1]]]:
                path.write_text(json.dumps({'breakAfterWordIds':bad}),encoding='utf-8')
                with self.assertRaises(mod.ValidationError):mod.read_decisions(path,ids)

if __name__=='__main__':unittest.main()
