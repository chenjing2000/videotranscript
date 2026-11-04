#!/usr/bin/env python3
"""EVR Transcript v1: deterministic WhisperX -> EVR converter and validator.
The assistant/human chooses boundaries; this program must never infer semantics.
No third-party packages. Source JSON is never overwritten.
"""
from __future__ import annotations
import argparse
import copy
import json
import re
import sys
from pathlib import Path

NAME = re.compile(r'^s(0|[1-9][0-9]*)w(0|[1-9][0-9]*)$')
SPACE = re.compile(r'\s')
EXT = '.evr-transcript.json'

class ValidationError(ValueError):
    pass

def fail(message):
    raise ValidationError(message)

def load(path: Path):
    try:
        return json.loads(path.read_text(encoding='utf-8-sig'))
    except (OSError, ValueError) as e:
        fail(f'无法读取 JSON {path}: {e}')

def source_words(source):
    if not isinstance(source, dict) or source.get('language') != 'en':
        fail('language 必须是 en')
    segs = source.get('segments')
    if not isinstance(segs, list) or not segs:
        fail('必须包含非空 segments')
    ids = []
    last = float('-inf')
    for si, segment in enumerate(segs):
        items = segment.get('words') if isinstance(segment, dict) else None
        if not isinstance(items, list) or not items:
            fail(f'segment {si} 没有逐词时间记录')
        for wi, entry in enumerate(items):
            wid = f's{si}w{wi}'
            if not isinstance(entry, dict) or not isinstance(entry.get('word'), str) or not entry['word'].strip() or SPACE.search(entry['word'].strip()):
                fail(f'{wid} 非法单词锚点')
            a, b = entry.get('start'), entry.get('end')
            if type(a) not in (int, float) or type(b) not in (int, float) or not all(__import__('math').isfinite(x) for x in (a,b)) or a < 0 or b <= a:
                fail(f'{wid} 时间戳无效')
            if a < last:
                fail(f'{wid} 时间起点倒序')
            last = a
            ids.append((wid,entry))
    return ids

def check(data, strict_filename: Path | None = None):
    words = source_words(data)
    if 'paragraphs' in data or any(('paragraph_start' in seg or 'paragraph_id' in seg) for seg in data['segments']):
        fail('检测到旧版分段字段；必须由 Skill build 统一转换')
    evr = data.get('evr')
    if not isinstance(evr, dict) or evr.get('format') != 'evr-transcript' or type(evr.get('schemaVersion')) is not int or evr['schemaVersion'] != 1:
        fail('不是 EVR Transcript v1')
    if set(evr) - {'format','schemaVersion','paragraphBreaksAfter','displayOverrides'}:
        fail('存在未定义的 evr 扩展字段')
    boundaries = evr.get('paragraphBreaksAfter')
    if not isinstance(boundaries, list):
        fail('paragraphBreaksAfter 必须是数组')
    pos = {key:i for i,(key,_) in enumerate(words)}
    last = -1
    for k in boundaries:
        if not isinstance(k,str) or k not in pos or pos[k] <= last or pos[k]==len(words)-1:
            fail(f'无效、重复、乱序或末词边界：{k}')
        last=pos[k]
    overrides=evr.get('displayOverrides',{})
    if not isinstance(overrides,dict):
        fail('displayOverrides 必须是对象')
    for k,v in overrides.items():
        if k not in pos or not isinstance(v,str) or not v.strip() or SPACE.search(v.strip()):
            fail(f'不合法的显示词覆盖：{k}')
    if strict_filename is not None and not strict_filename.name.lower().endswith(EXT):
        fail(f'字幕文件名必须以 {EXT} 结尾')
    return words

def preview(words, boundaries, overrides):
    stops=set(boundaries);paras=[];cur=[]
    for wid,item in words:
        cur.append(overrides.get(wid,item['word']).strip())
        if wid in stops:
            paras.append(' '.join(cur));cur=[]
    if cur:paras.append(' '.join(cur))
    return '\n\n'.join(paras)+'\n'

def do_inspect(args):
    data=load(args.input);words=source_words(data)
    lines=['# Word-indexed WhisperX transcript', '', '根据完整语义决定自然段，输出 **单词后的 ID**，不要改动时间戳。', '']
    for si,seg in enumerate(data['segments']):
        lines.append(f'## Segment {si}')
        lines.append(' '.join(f'[{"s"+str(si)+"w"+str(wi)}] {item["word"]}' for wi,item in enumerate(seg['words'])))
        lines.append('')
    output='\n'.join(lines)+'\n'
    if args.out:args.out.write_text(output,encoding='utf-8')
    else:print(output)
    print(f'检查：{len(data["segments"])} segments, {len(words)} words',file=sys.stderr)

def do_build(args):
    source=load(args.input)
    if not isinstance(source,dict) or 'evr' in source:
        fail('build 只接受未经 EVR 标准化的原始 WhisperX JSON；请勿覆盖已有标准文件')
    words=source_words(source)
    boundaries=load(args.boundaries)
    if not isinstance(boundaries,dict) or set(boundaries)-{'paragraphBreaksAfter','displayOverrides'} or not isinstance(boundaries.get('paragraphBreaksAfter'),list):
        fail('边界文件必须是 {"paragraphBreaksAfter":[...], "displayOverrides":{...可选}}')
    if args.output.resolve()==args.input.resolve():fail('输出不能覆盖源文件')
    if not args.output.name.lower().endswith(EXT):fail(f'输出文件名必须以 {EXT} 结尾')
    clean=copy.deepcopy(source)
    # Legacy semantic keys are never treated as authoritative; AI-curated word boundaries win.
    clean.pop('paragraphs',None)
    for seg in clean['segments']:
        seg.pop('paragraph_id',None)
        seg.pop('paragraph_start',None)
    evr={'format':'evr-transcript','schemaVersion':1,'paragraphBreaksAfter':boundaries['paragraphBreaksAfter']}
    if 'displayOverrides' in boundaries:evr['displayOverrides']=boundaries['displayOverrides']
    clean['evr']=evr
    valid=check(clean, args.output)
    if args.output.exists() and not args.force:fail('目标文件已存在；默认禁止覆盖。确需覆盖使用 --force')
    args.output.parent.mkdir(parents=True,exist_ok=True)
    args.output.write_text(json.dumps(clean,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    if args.preview:
        args.preview.write_text(preview(valid, evr['paragraphBreaksAfter'], evr.get('displayOverrides',{})),encoding='utf-8')
    print(f'成功：{len(valid)} 个词，{len(evr["paragraphBreaksAfter"])+1} 段，写入 {args.output}')

def do_validate(args):
    data=load(args.input);words=check(data,args.input)
    if args.source:
        raw=load(args.source)
        source_words(raw)
        for k in raw:
            if k=='paragraphs':continue
            if k not in data or (k!='segments' and data[k]!=raw[k]):fail(f'原始字段被修改：{k}')
        if len(raw['segments'])!=len(data['segments']):fail('segments 数量变化')
        for i,(before,after) in enumerate(zip(raw['segments'],data['segments'])):
            cmp={k:v for k,v in before.items() if k not in ('paragraph_start','paragraph_id')}
            aft={k:v for k,v in after.items() if k not in ('paragraph_start','paragraph_id')}
            if cmp!=aft:fail(f'原始 segment {i} 发生改动')
    if args.preview:
        evr=data['evr'];args.preview.write_text(preview(words,evr['paragraphBreaksAfter'],evr.get('displayOverrides',{})),encoding='utf-8')
    print(f'校验通过：{len(words)} 词、{len(data["evr"]["paragraphBreaksAfter"])+1} 段')

def main():
    parser=argparse.ArgumentParser(description='EVR Transcript v1 严格转换与校验')
    cmd=parser.add_subparsers(dest='command',required=True)
    a=cmd.add_parser('inspect');a.add_argument('input',type=Path);a.add_argument('--out',type=Path);a.set_defaults(fn=do_inspect)
    a=cmd.add_parser('build');a.add_argument('input',type=Path);a.add_argument('--boundaries',required=True,type=Path);a.add_argument('--output',required=True,type=Path);a.add_argument('--preview',type=Path);a.add_argument('--force',action='store_true');a.set_defaults(fn=do_build)
    a=cmd.add_parser('validate');a.add_argument('input',type=Path);a.add_argument('--source',type=Path);a.add_argument('--preview',type=Path);a.set_defaults(fn=do_validate)
    args=parser.parse_args()
    try:args.fn(args)
    except ValidationError as e:print(f'ERROR: {e}',file=sys.stderr);return 2
    return 0
if __name__=='__main__':raise SystemExit(main())
