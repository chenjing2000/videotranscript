import {DEFAULT_STYLE} from './types';import type {Project,Word} from './types';import {buildOverrides} from './transcript';
export function createProject(videoName:string,subtitleName:string,words:Word[]):Project{return {format:'video-transcript-project',schemaVersion:2,source:{videoName,subtitleName},overrides:buildOverrides(words),style:{...DEFAULT_STYLE},export:{fps:30,quality:'standard'}}}
export function saveProjectView(project:Project,words:Word[]):Project{return {...project,overrides:buildOverrides(words),savedAt:new Date().toISOString()}}
export function normalizeProjectStyle(project:Project):Project {return {...project,style:{...DEFAULT_STYLE,...project.style}};}
export function validateProject(value:unknown):value is Project{if(!value||typeof value!=='object')return false;const p=value as Partial<Project>;return p.format==='video-transcript-project'&&p.schemaVersion===2&&!!p.source?.videoName&&!!p.source?.subtitleName&&!!p.overrides&&!!p.style&&!!p.export;}
