import {validate} from './model.mjs';
import {ACTIVITY_SCHEMA,SOUND_SET,SOUND_SETS,UUID,SHARE_TOKEN,validateBehavior,validateOrigin,requireFields} from './activity-contract.mjs';
export const MAX_ACTIVITY_BYTES=3_016_384;
// Rebuild the exact musical shape; imported extra fields never become share data.
export function musicalSnapshot(value){
 const p=validate(value);
 return {schema:p.schema,palette:p.palette,title:p.title,...(p.description===undefined?{}:{description:p.description}),bells:p.bells.map(b=>({id:b.id,kind:b.kind,label:b.label,x:b.x,y:b.y,...(b.kind==='note'?{midi:b.midi,timbre:b.timbre}:{events:b.events.map(e=>({time:e.time,midi:e.midi,timbre:e.timbre,...(e.duration===undefined?{}:{duration:e.duration})}))})})),ink:p.ink.map(s=>Array.isArray(s)?s.map(p=>[...p]):{points:s.points.map(p=>[...p]),color:s.color,width:s.width}),paths:p.paths.map(p=>({id:p.id,label:p.label,points:p.points.map(q=>({x:q.x,y:q.y,time:q.time}))})),display:{notation:p.display.notation,tonic:p.display.tonic,accidentals:p.display.accidentals,...(p.display.colors===undefined?{}:{colors:p.display.colors})},view:{x:p.view.x,y:p.view.y,zoom:p.view.zoom},workspace:{timbre:p.workspace.timbre,pianoKeys:p.workspace.pianoKeys,inkColor:p.workspace.inkColor,inkWidth:p.workspace.inkWidth}};
}
export function requiredInstruments(project){return [...new Set(project.bells.flatMap(b=>b.kind==='note'?[b.timbre]:b.events.map(e=>e.timbre)))].sort();}
export function validateActivity(value){
 requireFields(value,['schema','activity_id','version_id','terrain_id','terrain_revision','created_at','title','attribution','behavior','sound_set','required_instruments','project']);
 if(value.schema!==ACTIVITY_SCHEMA||![value.activity_id,value.version_id,value.terrain_id].every(v=>typeof v==='string'&&UUID.test(v))||!Number.isSafeInteger(value.terrain_revision)||value.terrain_revision<1||typeof value.created_at!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|\+00:00)$/.test(value.created_at)||!Number.isFinite(Date.parse(value.created_at))||![value.title,value.attribution].every(v=>typeof v==='string'&&v.length<=100)||!value.title.trim())throw Error('This activity snapshot is invalid.');
 const behavior=validateBehavior(value.behavior);
 if(!SOUND_SETS.includes(value.sound_set))throw Error('This activity needs a different sound set.');
 const project=musicalSnapshot(value.project),required=requiredInstruments(project);
 if(!Array.isArray(value.required_instruments)||JSON.stringify(value.required_instruments)!==JSON.stringify(required)||(value.sound_set!==SOUND_SET&&required.includes('bowed')))throw Error('This activity has incompatible instruments.');
 if(project.title!==value.title)throw Error('The activity title does not match its snapshot.');
 return {...value,behavior,project,required_instruments:required};
}
export function parseActivity(text){if(typeof text!=='string'||new TextEncoder().encode(text).length>MAX_ACTIVITY_BYTES)throw Error('This activity is too large.');return validateActivity(JSON.parse(text));}
export function remixActivity(value){const activity=validateActivity(value),project=musicalSnapshot(activity.project);project.title=(activity.title.slice(0,92)+' (remix)').slice(0,100);project.activity_origin=validateOrigin({schema:'melodymorph-origin/1',activity_id:activity.activity_id,version_id:activity.version_id,terrain_id:activity.terrain_id,terrain_revision:activity.terrain_revision,title:activity.title,attribution:activity.attribution,behavior:activity.behavior,sound_set:activity.sound_set});return project;}
export function parseActivityLink(hash){const match=/^#([0-9a-f-]{36})\.([A-Za-z0-9_-]{43})$/.exec(hash||'');if(!match||!UUID.test(match[1])||!SHARE_TOKEN.test(match[2]))throw Error('This activity link is incomplete.');return {activity_id:match[1],share_token:match[2]};}
export function activityLink(base,id,token){if(!UUID.test(id)||!SHARE_TOKEN.test(token))throw Error('Invalid activity link.');const url=new URL('a.html',base);url.search='';url.hash=id+'.'+token;return url.href;}
