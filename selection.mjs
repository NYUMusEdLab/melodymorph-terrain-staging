import {clone,validate,strokePoints} from './model.mjs';

export function bellsInBox(bells, start, end) {
  const left=Math.min(start.x,end.x),right=Math.max(start.x,end.x),top=Math.min(start.y,end.y),bottom=Math.max(start.y,end.y);
  return bells.filter(b=>b.x>=left&&b.x<=right&&b.y>=top&&b.y<=bottom).map(b=>b.id);
}

export function shiftBells(bells, dx, dy) {
  if(!bells.length)return;
  dx=Math.max(-100000-Math.min(...bells.map(b=>b.x)),Math.min(dx,100000-Math.max(...bells.map(b=>b.x))));
  dy=Math.max(-100000-Math.min(...bells.map(b=>b.y)),Math.min(dy,100000-Math.max(...bells.map(b=>b.y))));
  for(const b of bells){b.x+=dx;b.y+=dy;}
}

export function copiesFor(project, source, makeId, offset=28) {
  if(project.bells.length+source.length>500)throw new Error('This copy would exceed the 500-bell limit.');
  const notes=bells=>bells.reduce((n,b)=>n+(b.kind==='recorder'?b.events.length:0),0);
  if(notes(project.bells)+notes(source)>20000)throw new Error('This copy would exceed the recorded-note limit.');
  const copies=clone(source).map(b=>({...b,id:makeId()}));
  shiftBells(copies,offset,offset);
  return copies;
}

export function selectionKeys(project){return [...project.bells.map(b=>b.id),...project.paths.map(p=>'path:'+p.id),...project.ink.map((_,i)=>'ink:'+i)];}
export function selectionFor(project,keys){
 const set=new Set(keys);
 return {bells:project.bells.filter(b=>set.has(b.id)),paths:project.paths.filter(p=>set.has('path:'+p.id)),ink:project.ink.filter((_,i)=>set.has('ink:'+i))};
}
export function selectionSize(group){return group.bells.length+group.paths.length+group.ink.length;}

// Include crossed segments as well as enclosed points, even for a sparse path.
function segmentInBox(a,b,box){
 let lo=0,hi=1;
 for(const [start,end,min,max] of [[a.x,b.x,box.left,box.right],[a.y,b.y,box.top,box.bottom]]){
  const delta=end-start;if(!delta){if(start<min||start>max)return false;continue;}
  const u=(min-start)/delta,v=(max-start)/delta;lo=Math.max(lo,Math.min(u,v));hi=Math.min(hi,Math.max(u,v));if(lo>hi)return false;
 }
 return true;
}
export function itemsInBox(project,start,end){
 const box={left:Math.min(start.x,end.x),right:Math.max(start.x,end.x),top:Math.min(start.y,end.y),bottom:Math.max(start.y,end.y)};
 const inside=p=>p.x>=box.left&&p.x<=box.right&&p.y>=box.top&&p.y<=box.bottom;
 const crosses=points=>points.some(inside)||points.some((p,i)=>i&&segmentInBox(points[i-1],p,box));
 const circle=p=>Math.hypot(p.x-Math.max(box.left,Math.min(p.x,box.right)),p.y-Math.max(box.top,Math.min(p.y,box.bottom)))<=23;
 return [...bellsInBox(project.bells,start,end),...project.paths.filter(p=>circle(p.points[0])||crosses(p.points)).map(p=>'path:'+p.id),...project.ink.flatMap((s,i)=>crosses(strokePoints(s).map(([x,y])=>({x,y})))?['ink:'+i]:[])];
}
export function shiftSelection(group,dx,dy){
 const points=[...group.bells,...group.paths.flatMap(p=>p.points),...group.ink.flatMap(s=>strokePoints(s).map(([x,y])=>({x,y})))];
 if(!points.length)return;
 let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
 for(const p of points){minX=Math.min(minX,p.x);maxX=Math.max(maxX,p.x);minY=Math.min(minY,p.y);maxY=Math.max(maxY,p.y);}
 dx=Math.max(-100000-minX,Math.min(dx,100000-maxX));dy=Math.max(-100000-minY,Math.min(dy,100000-maxY));
 for(const p of [...group.bells,...group.paths.flatMap(p=>p.points)]){p.x+=dx;p.y+=dy;}
 for(const stroke of group.ink)for(const p of strokePoints(stroke)){p[0]+=dx;p[1]+=dy;}
}
export function copySelection(project,source,makeId,offset=28){
 const copies=clone(source);
 for(const item of [...copies.bells,...copies.paths])item.id=makeId();
 shiftSelection(copies,offset,offset);
 validate({...project,bells:[...project.bells,...copies.bells],paths:[...project.paths,...copies.paths],ink:[...project.ink,...copies.ink]});
 return copies;
}
// The archived controls transpose ordinary note bells, not recorder/path bells.
export function canTranspose(bells,step){const notes=bells.filter(b=>b.kind==='note');return Number.isInteger(step)&&notes.length>0&&notes.every(b=>b.midi+step>=48&&b.midi+step<=84);}
export function transposeNotes(bells,step){if(!canTranspose(bells,step))return false;for(const b of bells)if(b.kind==='note')b.midi+=step;return true;}
