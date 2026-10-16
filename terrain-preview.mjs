import {validate,color,noteName,strokePoints} from './model.mjs';
import {Sound} from './audio.mjs';
import {pathState,advancePathNetwork} from './path-network.mjs';
// Read-only renderer using the SAME note, phrase and path engine as the tablet app.
// It has no local-library, tracking adapter, editing or cloud-write dependency.
export function previewTerrain(host,raw){
  const project=validate(raw),active=new Map();let frame=null,closed=false,epoch=0;
  const sound=new Sound(()=>{},()=>{}),ns='http://www.w3.org/2000/svg';
  const svg=document.createElementNS(ns,'svg');svg.setAttribute('role','group');svg.setAttribute('aria-label','Playable terrain preview');svg.classList.add('terrain-preview');
  const coords=[...project.bells,...project.paths.flatMap(p=>p.points),...project.ink.flatMap(s=>strokePoints(s).map(([x,y])=>({x,y})))];
  let minX=0,minY=0,maxX=600,maxY=400;
  for(const p of coords){minX=Math.min(minX,p.x-50);minY=Math.min(minY,p.y-50);maxX=Math.max(maxX,p.x+50);maxY=Math.max(maxY,p.y+50);}
  svg.setAttribute('viewBox',`${minX} ${minY} ${maxX-minX} ${maxY-minY}`);
  const make=(tag,attributes)=>{const el=document.createElementNS(ns,tag);for(const [k,v] of Object.entries(attributes))el.setAttribute(k,v);return el;};
  const controls=document.createElement('div'),stop=document.createElement('button'),status=document.createElement('p');status.role='status';status.textContent='Tap a bell or path circle to play. Nothing is saved from this preview.';
  stop.textContent='Stop preview';const halt=()=>{epoch++;active.clear();sound.stop();cancelAnimationFrame(frame);frame=null;for(const head of heads.values())head.style.display='none';};stop.onclick=halt;controls.append(stop,status);
  const play=bell=>{if(bell.kind==='note')sound.note(bell,bell.id);else sound.play(bell);};
  const unlock=async action=>{const before=epoch;try{if(await sound.unlock()&&!closed&&before===epoch)action();}catch{status.textContent='Audio is unavailable. Tap again to retry.';}};
  const heads=new Map();
  function tick(){
    const r=advancePathNetwork(project.paths,project.bells,active,sound.now);
    if(r.overflow){halt();status.textContent='Path loop limit reached. Preview stopped.';return;}
    for(const hit of r.notes){if(hit.bell.kind==='note')sound.note(hit.bell,hit.bell.id,hit.at);else sound.play(hit.bell);}
    for(const [id,el] of heads){const state=active.get(id);el.hidden=!state;el.style.display=state?'':'none';if(state){el.setAttribute('cx',state.point.x);el.setAttribute('cy',state.point.y);}}
    frame=active.size?requestAnimationFrame(tick):null;
  }
  const activate=(el,label,action)=>{el.setAttribute('tabindex','0');el.setAttribute('role','button');el.setAttribute('aria-label',label);el.addEventListener('click',()=>void unlock(action));el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();void unlock(action);}});};
  for(const stroke of project.ink)svg.append(make('polyline',{points:strokePoints(stroke).map(p=>p.join(',')).join(' '),fill:'none',stroke:stroke.color||'#d9e2dc','stroke-width':stroke.width||3}));
  for(const path of project.paths){
    svg.append(make('polyline',{points:path.points.map(p=>p.x+','+p.y).join(' '),fill:'none',stroke:'#a9bbdb','stroke-width':3}));
    const start=make('circle',{cx:path.points[0].x,cy:path.points[0].y,r:22,fill:'#273b5c',stroke:'#eef5ff','stroke-width':2});
    const toggle=()=>{if(active.has(path.id))active.delete(path.id);else active.set(path.id,pathState(path,sound.now,project.paths));if(!frame)tick();};
    const label='Play or stop path '+(path.label||'Untitled');activate(start,label,toggle);svg.append(start);
    // Paths can begin underneath bells. Keep a reachable control for every path.
    const pathButton=document.createElement('button');pathButton.textContent=label;pathButton.onclick=()=>void unlock(toggle);controls.append(pathButton);
    const head=make('circle',{r:7,fill:'#fff'});head.style.display='none';heads.set(path.id,head);svg.append(head);
  }
  for(const bell of project.bells){
    const el=bell.kind==='note'?make('circle',{cx:bell.x,cy:bell.y,r:25,fill:color(bell.midi,project.display.colors),stroke:'#fff','stroke-width':2}):make('g',{});
    if(bell.kind==='recorder'){
      el.append(make('rect',{x:bell.x-63,y:bell.y-43,width:126,height:86,rx:14,fill:'#13202d',stroke:'#b6cbd6','stroke-width':2}));
      const duration=Math.max(.5,bell.events.at(-1).time);
      for(const event of bell.events)el.append(make('circle',{cx:bell.x-50+event.time/duration*100,cy:bell.y+20-(event.midi-48)/36*36,r:2.5,fill:color(event.midi,project.display.colors),'data-phrase-event':''}));
    }
    activate(el,bell.kind==='note'?noteName(bell.midi)+' '+bell.timbre:'Recorded phrase '+bell.label,()=>play(bell));svg.append(el);
  }
  host.replaceChildren(controls,svg);
  const visibility=()=>{if(document.hidden)halt();};document.addEventListener('visibilitychange',visibility);
  return {stop:halt,close(){closed=true;halt();document.removeEventListener('visibilitychange',visibility);host.replaceChildren();}};
}
