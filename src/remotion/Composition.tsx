import React,{useMemo} from 'react';
import {AbsoluteFill,useCurrentFrame,useVideoConfig,staticFile,OffthreadVideo} from 'remotion';
import {ReaderCanvas} from '../ui/ReaderCanvas';
import {parseVideoTranscript,applyOverrides,DEFAULT_STYLE,normalizeProjectStyle} from '../core';
import type {VideoTranscriptInput,Project,PagePlan} from '../core';
export type RenderProps={transcript:VideoTranscriptInput;project?:Project;videoHeight:number;videoFile:string;durationSec?:number;pagePlan?:PagePlan};
export const ReadingComposition:React.FC<RenderProps>=({transcript,project,videoHeight,videoFile,pagePlan})=>{
 const frame=useCurrentFrame();const {fps}=useVideoConfig();
 const words = useMemo(() => {
  const parsed = parseVideoTranscript(transcript);
  return project ? applyOverrides(parsed, project).words : parsed.words;
 }, [transcript, project]);
 const style=project?normalizeProjectStyle(project).style:DEFAULT_STYLE;
 return <AbsoluteFill><ReaderCanvas words={words} style={style} time={frame/fps} videoHeight={videoHeight} pagePlan={pagePlan} video={<OffthreadVideo src={staticFile(videoFile)} style={{height:videoHeight,width:1200,objectFit:"fill"}}/>}/></AbsoluteFill>;
};
