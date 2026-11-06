export type ProjectEditState = {
 currentRevision:number;
 savedRevision:number;
 draftChanged:boolean;
};

export function createProjectEditState():ProjectEditState{
 return {currentRevision:0,savedRevision:0,draftChanged:false};
}

export function markProjectEdited(state:ProjectEditState):ProjectEditState{
 return {...state,currentRevision:state.currentRevision+1};
}

export function setProjectDraftChanged(state:ProjectEditState,changed:boolean):ProjectEditState{
 if(state.draftChanged===changed)return state;
 return {...state,draftChanged:changed};
}

export function acknowledgeProjectSave(state:ProjectEditState,revision:number):ProjectEditState{
 if(!Number.isSafeInteger(revision)||revision<state.savedRevision||revision>state.currentRevision)return state;
 if(revision===state.savedRevision)return state;
 return {...state,savedRevision:revision};
}

export function resetProjectEditState(state:ProjectEditState):ProjectEditState{
 const revision=state.currentRevision+1;
 return {currentRevision:revision,savedRevision:revision,draftChanged:false};
}

export function hasUnsavedProjectChanges(state:ProjectEditState):boolean{
 return state.currentRevision!==state.savedRevision||state.draftChanged;
}
