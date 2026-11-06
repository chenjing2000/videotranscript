import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const sourceExists=existsSync('src/core/project-edit-state.ts');

test('M6.15.6: project edit state tracks drafts, commits, saves and project replacement',()=>{
 assert.equal(sourceExists,true,'src/core/project-edit-state.ts must provide the revision-based edit state');
 if(!sourceExists)return;
 const api=require('../.tmp-core/project-edit-state.js');
 const {
  createProjectEditState,markProjectEdited,setProjectDraftChanged,
  acknowledgeProjectSave,resetProjectEditState,hasUnsavedProjectChanges
 }=api;

 let state=createProjectEditState();
 assert.deepEqual(state,{currentRevision:0,savedRevision:0,draftChanged:false});
 assert.equal(hasUnsavedProjectChanges(state),false);

 state=setProjectDraftChanged(state,true);
 assert.equal(hasUnsavedProjectChanges(state),true);
 state=setProjectDraftChanged(state,false);
 assert.equal(hasUnsavedProjectChanges(state),false,'cancelling a draft must restore the clean state');
 assert.equal(state.currentRevision,0,'draft-only edits must not advance the committed revision');

 state=setProjectDraftChanged(state,true);
 state=markProjectEdited(state);
 state=setProjectDraftChanged(state,false);
 assert.equal(state.currentRevision,1);
 assert.equal(hasUnsavedProjectChanges(state),true,'committing a changed draft must remain unsaved');
 state=acknowledgeProjectSave(state,1);
 assert.equal(state.savedRevision,1);
 assert.equal(hasUnsavedProjectChanges(state),false,'matching save acknowledgement clears the marker');

 state=markProjectEdited(state);
 assert.equal(state.currentRevision,2);
 state=acknowledgeProjectSave(state,1);
 assert.equal(state.savedRevision,1);
 assert.equal(hasUnsavedProjectChanges(state),true,'older acknowledgement cannot clear a newer edit');

 state=markProjectEdited(state);
 state=acknowledgeProjectSave(state,3);
 assert.equal(state.savedRevision,3);
 state=acknowledgeProjectSave(state,2);
 assert.equal(state.savedRevision,3,'out-of-order acknowledgement must not move saved revision backwards');

 const oldRevision=state.currentRevision;
 state=resetProjectEditState(state);
 assert.equal(state.currentRevision,oldRevision+1);
 assert.equal(state.savedRevision,state.currentRevision);
 assert.equal(hasUnsavedProjectChanges(state),false);
 state=acknowledgeProjectSave(state,oldRevision);
 assert.equal(state.savedRevision,oldRevision+1,'acknowledgement from the previous project must be ignored');
});
