import {validateActivity} from './activity-snapshot.mjs';
export const activityPreviewMode=()=>new URLSearchParams(location.search).has('activity-preview');
export function memoryStorage(){const values=new Map();return {getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,String(v))};}
// Preview has an isolated in-memory library. It neither edits nor syncs a local terrain.
export function installActivityPlayer({load,stop,fit=()=>{}}){
 if(!activityPreviewMode())return;
 document.body.dataset.activityPreview='true';
 const hide=['workspaceMenu','record','path','mute','select','move','duplicate','pitchDown','pitchUp','erase','canvasUndo','draw','paletteViewport','paletteToggle','viewNavigation','palette-top','recordStatus'];
 for(const id of hide){const el=document.getElementById(id)||document.querySelector('.'+id);if(el)el.hidden=true;}
 document.querySelector('header .eyebrow')?.remove();
 document.getElementById('stage').setAttribute('aria-label','Shared activity canvas. Tap bells or path circles to play. Use Strum to sweep across them. Make your own copy to edit.');
 // Keyboard editing cannot bypass the compact preview controls. Escape can stop sound.
 document.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();stop();return;}if(['Tab','Enter',' ','Shift','Control','Alt','Meta'].includes(event.key)&&!event.ctrlKey&&!event.metaKey)return;event.preventDefault();event.stopImmediatePropagation();},true);
 document.addEventListener('paste',event=>{event.preventDefault();event.stopImmediatePropagation();},true);
 let accepted=false;
 window.addEventListener('message',event=>{if(event.source!==parent||event.origin!==location.origin||event.data?.type!=='melodymorph-activity-load'||accepted)return;try{const activity=validateActivity(event.data.activity);stop();load(activity.project);fit();accepted=true;parent.postMessage({type:'melodymorph-activity-loaded',version_id:activity.version_id},location.origin);}catch{parent.postMessage({type:'melodymorph-activity-error'},location.origin);}});
 new ResizeObserver(()=>{if(accepted)fit();}).observe(document.getElementById('stage'));
 parent.postMessage({type:'melodymorph-activity-ready'},location.origin);
}
