"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createProject = createProject;
exports.saveProjectView = saveProjectView;
exports.migrateProjectStyle = migrateProjectStyle;
exports.validateProject = validateProject;
const types_1 = require("./types");
const transcript_1 = require("./transcript");
function createProject(videoName, subtitleName, words) { return { schemaVersion: 1, source: { videoName, subtitleName }, overrides: (0, transcript_1.buildOverrides)(words), style: { ...types_1.DEFAULT_STYLE }, export: { fps: 30, quality: 'standard' } }; }
function saveProjectView(project, words) { return { ...project, overrides: (0, transcript_1.buildOverrides)(words), savedAt: new Date().toISOString() }; }
function migrateProjectStyle(project) { return { ...project, style: { ...types_1.DEFAULT_STYLE, ...project.style } }; }
function validateProject(value) { if (!value || typeof value !== 'object')
    return false; const p = value; return p.schemaVersion === 1 && !!p.source?.videoName && !!p.source?.subtitleName && !!p.overrides && !!p.style && !!p.export; }
