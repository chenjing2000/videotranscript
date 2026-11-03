import React from 'react';
import {AbsoluteFill,useCurrentFrame,useVideoConfig,staticFile} from 'remotion';
import {Video} from '@remotion/media';
import {ReaderCanvas} from '../ui/ReaderCanvas';
import {parseWhisperX,applyOverrides,DEFAULT_STYLE} from '../core';
import type {WhisperXInput,Project} from '../core';
export type RenderProps={transcript:WhisperXInput;project?:Project;videoHeight:number;videoFile:string;durationSec?:number};
export const ReadingComposition:React.FC<RenderProps>=({transcript,project,videoHeight,videoFile})=>{
 const frame=useCurrentFrame();const {fps}=useVideoConfig();
 const parsed=parseWhisperX(transcript);const words=project?applyOverrides(parsed,project).words:parsed.words;
 const style=project?.style??DEFAULT_STYLE;
 return <AbsoluteFill><ReaderCanvas words={words} style={style} time={frame/fps} videoHeight={videoHeight} video={<Video src={staticFile(videoFile)} style={{height:videoHeight,width:1200,objectFit:'fill'}}/>}/></AbsoluteFill>;
};
