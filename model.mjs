// New implementation for this local research prototype. No original source reused.
import {validateOrigin,validateLibraryOrigin} from './activity-contract.mjs';
import {validateDescription} from './description-contract.mjs';
import {DEFAULT_DISPLAY} from './notation.mjs';
import {COLOR_SCHEMES,pitchColor} from './pitch-colors.mjs';
export const VERSION = 'melodymorph-study/5';
export const timbres = ['piano','epiano','grand','pluck','vibes','bowed'];
export const pitchNames = ['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'];
export const clone = value => JSON.parse(JSON.stringify(value));
export const INK_COLORS=['#d9e2dc','#f2b86b','#e687a6','#8bbde9','#86d4ba'];
export const DEFAULT_WORKSPACE={timbre:'piano',pianoKeys:false,inkColor:'#d9e2dc',inkWidth:3};
export const strokePoints=s=>Array.isArray(s)?s:s.points;
export function blank() { return {schema:VERSION,palette:'chromatic',title:'My musical landscape',bells:[],ink:[],paths:[],display:{...DEFAULT_DISPLAY},view:{x:0,y:0,zoom:1},workspace:{...DEFAULT_WORKSPACE}}; }
export function noteName(midi) { return pitchNames[midi%12]+(Math.floor(midi/12)-1); }
export const color=pitchColor;
export function eventOf(bell, time=0) { return {time,midi:bell.midi,timbre:bell.timbre}; }
export function normalizeCapture(events) {
  if (!events.length) return [];
  const sorted=clone(events).sort((a,b)=>a.time-b.time), origin=sorted[0].time;
  return sorted.map(e=>({...e,time:Math.max(0,Math.round((e.time-origin)*1000000)/1000000)}));
}
export function validate(value) {
  const fail=s=>{throw new Error(s);};
  if(value?.schema==='melodymorph-study/1')value={...value,schema:'melodymorph-study/2',paths:[]};
  if(value?.schema==='melodymorph-study/2')value={...value,schema:'melodymorph-study/3',display:value.display??{...DEFAULT_DISPLAY}};
  if(value?.schema==='melodymorph-study/3')value={...value,schema:'melodymorph-study/4'};
  if(value?.schema==='melodymorph-study/4')value={...value,schema:VERSION,palette:'chromatic'};
  if (!value || value.schema!==VERSION) fail('This is not a supported MelodyMorph study file.');
  value={...value,workspace:value.workspace??{...DEFAULT_WORKSPACE}};
  if(value.activity_origin!==undefined)value.activity_origin=validateOrigin(value.activity_origin);
  if(value.library_origin!==undefined)value.library_origin=validateLibraryOrigin(value.library_origin);
  if(value.description!==undefined&&!validateDescription(value.description))fail('Description must be at most three sentences and 600 characters.');
  const workspace=value.workspace;
  if(!workspace||!timbres.includes(workspace.timbre)||typeof workspace.pianoKeys!=='boolean'||!INK_COLORS.includes(workspace.inkColor)||![3,7].includes(workspace.inkWidth))fail('Invalid workspace settings.');
  if(typeof value.title!=='string'||value.title.length>100) fail('Invalid landscape title.');
  if(!Array.isArray(value.bells)||value.bells.length>500||!Array.isArray(value.ink)||value.ink.length>500) fail('Landscape exceeds this prototype’s limits.');
  const finite=n=>typeof n==='number'&&Number.isFinite(n), coord=n=>finite(n)&&Math.abs(n)<=100000;
  const note=e=>e&&Number.isInteger(e.midi)&&e.midi>=48&&e.midi<=84&&timbres.includes(e.timbre);
  if(!['chromatic','diatonic','pentatonic'].includes(value.palette))fail('Invalid palette setting.');
  const display=value.display;
  if(!display||!['off','names','jianpu'].includes(display.notation)||!Number.isInteger(display.tonic)||display.tonic<0||display.tonic>11||!['sharps','flats'].includes(display.accidentals))fail('Invalid bell label settings.');
  if(display.colors!==undefined&&!COLOR_SCHEMES.includes(display.colors))fail('Invalid bell color setting.');
  const ids=new Set();let total=0;
  for(const b of value.bells) {
    if(!b||typeof b.id!=='string'||b.id.length>80||ids.has(b.id))fail('Invalid or duplicate bell identity.');ids.add(b.id);
    if(!coord(b.x)||!coord(b.y)||typeof b.label!=='string'||b.label.length>50)fail('Invalid bell position or label.');
    if(b.kind==='note'){if(!note(b))fail('Invalid note.');}
    else if(b.kind==='recorder'){
      if(!Array.isArray(b.events)||!b.events.length||b.events.length>5000)fail('Invalid recording.');
      let previous=-1;for(const e of b.events){if(!note(e)||!finite(e.time)||e.time<previous||e.time>600||(e.duration!==undefined&&(!finite(e.duration)||e.duration<.03||e.duration>30)))fail('Invalid recording timing.');previous=e.time;}
      if(b.events[0].time!==0)fail('A recording must begin with its first note.');total+=b.events.length;
    }else fail('Unknown bell type.');
  }
  if(total>20000)fail('Too many recorded notes for this study.');
  for(const stroke of value.ink){const points=stroke&&strokePoints(stroke);if(!Array.isArray(points)||points.length>3000||points.some(p=>!Array.isArray(p)||p.length!==2||!p.every(coord)))fail('Invalid drawing.');if(!Array.isArray(stroke)&&(!INK_COLORS.includes(stroke.color)||![3,7].includes(stroke.width)))fail('Invalid drawing style.');}
  if(!Array.isArray(value.paths)||value.paths.length>200)fail('Invalid path collection.');
  for(const path of value.paths){
    if(!path||typeof path.id!=='string'||path.id.length>80||ids.has(path.id)||typeof path.label!=='string'||path.label.length>50)fail('Invalid path identity.');ids.add(path.id);
    if(!Array.isArray(path.points)||path.points.length<2||path.points.length>3000)fail('Invalid path points.');let previous=-1;
    for(const p of path.points){if(!coord(p.x)||!coord(p.y)||!finite(p.time)||p.time<previous||p.time>600)fail('Invalid path timing.');previous=p.time;}
    if(path.points[0].time!==0||path.points.at(-1).time<=0)fail('A path must have a positive duration and start at zero.');
  }
  if(!value.view||!coord(value.view.x)||!coord(value.view.y)||!finite(value.view.zoom)||value.view.zoom<.4||value.view.zoom>2)fail('Invalid canvas view.');
  return clone(value);
}
export function study() {
  const p=blank();p.title='Two gestures, one landscape';
  [60,62,64,67,69,72].forEach((m,i)=>p.bells.push({id:'study-note-'+i,kind:'note',midi:m,timbre:'piano',label:noteName(m),x:140+i*112,y:200+Math.sin(i*.9)*70}));
  const phrase=(id,label,x,events)=>({id,kind:'recorder',label,x,y:455,events:events.map(([time,midi])=>({time,midi,timbre:'piano'}))});
  p.bells.push(phrase('study-a','A · call',240,[[0,60],[.38,64],[.76,67]]));
  p.bells.push(phrase('study-b','B · reply',500,[[0,69],[.38,67],[.76,64],[1.14,60]]));
  return p;
}
