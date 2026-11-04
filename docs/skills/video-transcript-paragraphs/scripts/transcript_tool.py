#!/usr/bin/env python3
"""Video Transcript v2 conversion/validation: paragraph decisions are supplied, never guessed.
The tool preserves all raw WhisperX fields except adding word-level breakParagraph and
video_transcript metadata. No old-format migration path is provided.
"""
from __future__ import annotations
import argparse
import copy
import json
import math
import re
import sys
from pathlib import Path

EXT = '.video-transcript.json'
ID = re.compile(r'^s(0|[1-9][0-9]*)w(0|[1-9][0-9]*)$')
class ValidationError(ValueError): pass
def fail(message): raise ValidationError(message)
def load(path):
    try: return json.loads(path.read_text(encoding='utf-8-sig'))
    except (OSError, ValueError) as exc: fail(f'无法读取 JSON {path}: {exc}')
def words_of(data):
    if not isinstance(data,dict) or data.get('language') != 'en': fail('language 必须为 en')
    segments=data.get('segments')
    if not isinstance(segments,list) or not segments: fail('segments 不能为空')
    entries=[]; last=-math.inf
    for si,segment in enumerate(segments):
        ww=segment.get('words') if isinstance(segment,dict) else None
        if not isinstance(ww,list) or not ww: fail(f'segment {si} 缺少 words')
        if any(k in segment for k in ('paragraph_start','paragraph_id','breakParagraph')): fail(f'segment {si} 存在旧版或错误分段字段')
        for wi,w in enumerate(ww):
            ident=f's{si}w{wi}'
            if not isinstance(w,dict) or not isinstance(w.get('word'),str) or not w['word'].strip() or re.search(r'\s',w['word'].strip()): fail(f'非法单词 {ident}')
            a,b=w.get('start'),w.get('end')
            if type(a) not in (int,float) or type(b) not in (int,float) or not math.isfinite(a) or not math.isfinite(b) or a<0 or b<=a or a<last: fail(f'时间戳错误 {ident}')
            if any(k in w for k in ('paragraphAfter','paragraphBreaksAfter','paragraph_start')): fail(f'旧版分段字段 {ident}')
            if 'breakParagraph' in w and w['breakParagraph'] is not True: fail(f'breakParagraph 只能为 true 或省略：{ident}')
            last=a;entries.append((ident,w))
    if entries[-1][1].get('breakParagraph') is True: fail('最后一个单词无需 breakParagraph')
    if 'word_segments' in data:
        val=data['word_segments']
        if not isinstance(val,list) or any(not isinstance(w,dict) or 'breakParagraph' in w for w in val): fail('word_segments 禁止添加分段标记')
    return entries

def check(data,path=None):
    entries=words_of(data)
    if any(k in data for k in ('evr','paragraphs','paragraphBreaksAfter')): fail('禁止旧版分段格式')
    meta=data.get('video_transcript')
    if not isinstance(meta,dict) or meta.get('format')!='video-transcript' or type(meta.get('schemaVersion')) is not int or meta['schemaVersion']!=2: fail('必须使用 Video Transcript v2')
    if set(meta)-{'format','schemaVersion','displayOverrides'}: fail('存在未知的 video_transcript 字段')
    overrides=meta.get('displayOverrides',{})
    ids={ident for ident,_ in entries}
    if not isinstance(overrides,dict): fail('displayOverrides 必须为对象')
    for ident,val in overrides.items():
        if ident not in ids or not isinstance(val,str) or not val.strip() or re.search(r'\s',val.strip()): fail(f'不合法显示词覆盖 {ident}')
    if path is not None and not path.name.lower().endswith(EXT): fail(f'字幕文件必须以 {EXT} 结尾')
    return entries

def preview(data):
    entries=check(data)
    overrides=data['video_transcript'].get('displayOverrides',{})
    paras=[]; current=[]
    for ident,w in entries:
        current.append(overrides.get(ident,w['word']).strip())
        if w.get('breakParagraph') is True:
            paras.append(' '.join(current));current=[]
    if current:paras.append(' '.join(current))
    return '\n\n'.join(paras)+'\n'

def inspect(args):
    src=load(args.input);entries=words_of(src)
    result=['# Word-indexed transcript','','用全文语义与说话人转换判断段落，在每段末词后标记 `breakParagraph: true`。','']
    for si,seg in enumerate(src['segments']):
        result.extend([f'## Segment {si}',' '.join(f'[s{si}w{wi}] {w["word"]}' for wi,w in enumerate(seg['words'])),''])
    result='\n'.join(result)+'\n'
    if args.out: args.out.write_text(result,encoding='utf-8')
    else: print(result)
    print(f'检查：{len(entries)} 个单词',file=sys.stderr)

def read_decisions(path,ids):
    decision=load(path)
    # This is a *temporary human/AI decision file*, not an input subtitle schema.
    if not isinstance(decision,dict) or not isinstance(decision.get('breakAfterWordIds'),list) or set(decision)-{'breakAfterWordIds','displayOverrides'}:
        fail('边界决策文件必须为 {"breakAfterWordIds": ["s...w..."], "displayOverrides": {...}}')
    keys=decision['breakAfterWordIds'];position={key:i for i,key in enumerate(ids)};last=-1
    for ident in keys:
        if not isinstance(ident,str) or ident not in position or position[ident]<=last or position[ident]==len(ids)-1: fail(f'无效、重复或乱序边界：{ident}')
        last=position[ident]
    return decision

def build(args):
    raw=load(args.input)
    if not isinstance(raw,dict) or any(k in raw for k in ('evr','video_transcript','paragraphs')): fail('build 只接受原始 WhisperX，不支持旧格式迁移')
    entries=words_of(raw)
    decision=read_decisions(args.boundaries,[ident for ident,_ in entries])
    if args.output.resolve()==args.input.resolve(): fail('禁止覆盖原始字幕')
    if not args.output.name.lower().endswith(EXT): fail(f'输出必须以 {EXT} 结尾')
    if args.output.exists() and not args.force: fail('目标存在，如需重建请加 --force')
    out=copy.deepcopy(raw)
    out['video_transcript']={'format':'video-transcript','schemaVersion':2}
    if 'displayOverrides' in decision: out['video_transcript']['displayOverrides']=decision['displayOverrides']
    for ident in decision['breakAfterWordIds']:
        m=ID.fullmatch(ident);assert m is not None
        si,wi=(int(m.group(1)),int(m.group(2)))
        out['segments'][si]['words'][wi]['breakParagraph']=True
    check(out,args.output)
    args.output.parent.mkdir(parents=True,exist_ok=True)
    args.output.write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    if args.preview: args.preview.write_text(preview(out),encoding='utf-8')
    print(f'生成成功：{len(entries)} 词，{len(decision["breakAfterWordIds"])+1} 段')

def edit(args):
    """Re-apply the complete reviewed boundary set to an existing v2 file."""
    original=load(args.input)
    entries=check(original,args.input)
    decision=read_decisions(args.boundaries,[ident for ident,_ in entries])
    if args.output.resolve()==args.input.resolve(): fail('禁止原地覆盖字幕；请指定新输出路径')
    if args.output.exists() and not args.force: fail('目标文件已存在（可使用 --force）')
    changed=copy.deepcopy(original)
    for seg in changed['segments']:
        for word in seg['words']: word.pop('breakParagraph',None)
    for ident in decision['breakAfterWordIds']:
        match=ID.fullmatch(ident)
        si,wi=int(match.group(1)),int(match.group(2))
        changed['segments'][si]['words'][wi]['breakParagraph']=True
    if 'displayOverrides' in decision:
        changed['video_transcript']['displayOverrides']=decision['displayOverrides']
    check(changed,args.output)
    args.output.parent.mkdir(parents=True,exist_ok=True)
    args.output.write_text(json.dumps(changed,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    if args.preview: args.preview.write_text(preview(changed),encoding='utf-8')
    print(f'重新分段成功：{len(entries)} 词，{len(decision["breakAfterWordIds"])+1} 段')

def validate(args):
    data=load(args.input);entries=check(data,args.input)
    if args.source:
        raw=load(args.source);words_of(raw)
        cleaned=copy.deepcopy(data);cleaned.pop('video_transcript',None)
        for seg in cleaned['segments']:
            for w in seg['words']:w.pop('breakParagraph',None)
        if cleaned!=raw: fail('源文件内容发生变化（除允许新增的 breakParagraph/video_transcript 外）')
    if args.preview:args.preview.write_text(preview(data),encoding='utf-8')
    print(f'校验通过：{len(entries)} 词，{1+sum(w.get("breakParagraph") is True for _,w in entries)} 段')

def main():
    parser=argparse.ArgumentParser(description='Video Transcript v2 字幕分段工具')
    commands=parser.add_subparsers(dest='command',required=True)
    a=commands.add_parser('inspect');a.add_argument('input',type=Path);a.add_argument('--out',type=Path);a.set_defaults(fn=inspect)
    a=commands.add_parser('build');a.add_argument('input',type=Path);a.add_argument('--boundaries',required=True,type=Path);a.add_argument('--output',required=True,type=Path);a.add_argument('--preview',type=Path);a.add_argument('--force',action='store_true');a.set_defaults(fn=build)
    a=commands.add_parser('edit');a.add_argument('input',type=Path);a.add_argument('--boundaries',required=True,type=Path);a.add_argument('--output',required=True,type=Path);a.add_argument('--preview',type=Path);a.add_argument('--force',action='store_true');a.set_defaults(fn=edit)
    a=commands.add_parser('validate');a.add_argument('input',type=Path);a.add_argument('--source',type=Path);a.add_argument('--preview',type=Path);a.set_defaults(fn=validate)
    args=parser.parse_args()
    try:args.fn(args)
    except ValidationError as error:print(f'ERROR: {error}',file=sys.stderr);return 2
    return 0
if __name__=='__main__':raise SystemExit(main())
