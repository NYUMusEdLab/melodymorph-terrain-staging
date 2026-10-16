import {workshopActivity} from './activity.mjs';
// Matches the owner's proposed Free Play contract, not a separate tracking service.
export const RELEASE_ID='melodymorph-workshop-0.1.9-gallery-candidate-r2';
export const TOOL_ID='melodymorph';
export const CONNECT_KIND='rgf-pilot-connect-v1';
const parents=/^\/rengongfu-sandbox\/workbench\/teacher-pilot\/(?:live\.html|callback\.html|index\.html|phone\.html)?$/;
const mapping={
 tray_audition:['play','instrument'],bell_place:['create','instrument'],bell_play:['play','instrument'],phrase_play:['play','melody'],phrase_stop:['stop','melody'],path_play:['play','pattern'],path_stop:['stop','pattern'],strum_gesture:['play','workspace'],line_draw:['create','workspace'],path_draw:['create','pattern'],object_move:['modify','workspace'],pitch_change:['modify','instrument'],object_remove:['delete','workspace'],record_start:['modify','workspace'],record_finish:['create','clip'],mode_change:['modify','settings'],display_change:['modify','settings'],timbre_change:['modify','settings'],undo:['undo','workspace'],redo:['redo','workspace'],landscape_new:['reset','workspace'],example_open:['reset','workspace'],import_complete:['import','workspace'],export_requested:['export','workspace'],stop_all:['stop','workspace']
};
export function semanticAction(value){if(!value||Object.keys(value).join(',')!=='action'||typeof value.action!=='string'||!Object.hasOwn(mapping,value.action))return null;const [action,target]=mapping[value.action];return {name:'tool_action',details:{action,target,count:1}};}
export function installWorkshopAdapter({windowObject=window,activity=workshopActivity}={}){
 if(new URLSearchParams(windowObject.location?.search||'').has('activity-preview'))return {close(){}};
 let port=null,enabled=false,lastContext='',resizeTimer=null;
 const w=windowObject;
 function disable(){enabled=false;lastContext='';activity.setEnabled(false);if(resizeTimer!==null){w.clearTimeout(resizeTimer);resizeTimer=null;}}
 function send(value){if(!enabled||!port)return false;try{port.postMessage(value);return true;}catch{disable();return false;}}
 activity.attach(value=>{const event=semanticAction(value);return event?send(event):false;});
 function context(){
  if(!enabled)return;const width=Math.round(w.innerWidth),height=Math.round(w.innerHeight);
  if(width<160||width>4096||height<160||height>4096)return;
  const details={schema_version:1,language:w.document.documentElement.lang==='zh-CN'?'zh-CN':'en',viewport_width:width,viewport_height:height,panel:w.document.querySelector('.workspace-menu')?.open?'settings':'workspace'};
  const key=JSON.stringify(details);if(key!==lastContext&&send({name:'interface_context',details}))lastContext=key;
 }
 function receive(e){
  if(w.parent===w||e.source!==w.parent||e.origin!==w.location.origin||!e.data||Object.keys(e.data).join(',')!=='type'||e.data.type!==CONNECT_KIND||e.ports?.length!==1)return;
  let ref;try{ref=new URL(w.document.referrer);}catch{return;}
  if(ref.origin!==e.origin||!parents.test(ref.pathname))return;
  disable();port?.close();port=e.ports[0];
  port.onmessage=({data})=>{if(!data||Object.keys(data).join(',')!=='enabled'||typeof data.enabled!=='boolean')return;const wasEnabled=enabled;enabled=data.enabled;activity.setEnabled(enabled);if(!enabled)disable();else if(!wasEnabled){lastContext='';context();}};
  port.onmessageerror=disable;port.start?.();
 }
 function resize(){if(resizeTimer!==null)w.clearTimeout(resizeTimer);resizeTimer=w.setTimeout(()=>{resizeTimer=null;context();},150);}
 function toggle(e){if(e.target?.matches?.('.workspace-menu'))context();}
 function close(){disable();port?.close();port=null;activity.detach();w.removeEventListener('message',receive);w.removeEventListener('resize',resize);w.removeEventListener('pagehide',close);w.document.removeEventListener('toggle',toggle,true);w.document.removeEventListener('melodymorph-language-change',context);}
 w.addEventListener('message',receive);w.addEventListener('resize',resize);w.addEventListener('pagehide',close);w.document.addEventListener('toggle',toggle,true);w.document.addEventListener('melodymorph-language-change',context);
 return {close};
}
