import React from 'react';
import {Composition} from 'remotion';
import {ReadingComposition} from './Composition';
import type {RenderProps} from './Composition';
const fallback:RenderProps={transcript:{language:'en',segments:[{words:[{word:'Hello',start:0,end:1}]}],transcript_studio:{format:'transcript-studio',schemaVersion:2}},mediaKind:'video',videoHeight:675,mediaFile:'__export_input.mp4'};
export const RemotionRoot=()=> <Composition id="TranscriptStudio" component={ReadingComposition} width={1200} height={1600} fps={30} durationInFrames={90} defaultProps={fallback} calculateMetadata={({props})=>{
 const fps=props.project?.export.fps??30;
 return {width:props.project?.canvas.width??1200,height:props.project?.canvas.height??1600,fps,durationInFrames:Math.max(1,Math.ceil((props.durationSec??3)*fps))};
 }}/>;
