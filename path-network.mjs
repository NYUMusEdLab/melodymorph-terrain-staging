import {pathHits,pointAt,inside} from './paths.mjs';
export const isLoopPath=path=>path.points.length>=2&&inside(path.points.at(-1),{kind:'path',...path.points[0]});
export function pathState(path,start,paths=[]){return {start,previous:0,inside:new Set(['path:'+path.id,...paths.filter(p=>inside(path.points[0],{kind:'path',...p.points[0]})).map(p=>'path:'+p.id)]),point:{...path.points[0]}};}
// Alex's web interaction: a crossing starts or restarts a path. Direct taps still
// toggle playback. Seed overlapping circles on linked starts so coincident heads
// cannot instantly restart one another without first leaving and re-entering.
export function advancePathNetwork(paths,bells,active,now,budget=2048){
 const lookup=new Map(paths.map(p=>[p.id,p])),targets=[...bells,...paths.map(p=>({id:'path:'+p.id,kind:'path',pathId:p.id,...p.points[0]}))];
 const queue=[],notes=[],changes=[];let processed=0,overflow=false;
 function schedule(path,state){
  const elapsed=Math.min(Math.max(0,now-state.start),path.points.at(-1).time);
  const result=pathHits(path.points,state.previous,elapsed,targets.filter(target=>target.id!=='path:'+path.id),state.inside,Math.max(0,budget-processed-queue.length));
  if(result.overflow){overflow=true;return;}
  for(const hit of result.hits)queue.push({type:'hit',source:path.id,state,at:state.start+hit.time,hit});
  state.previous=elapsed;state.inside=result.inside;state.point=result.point;
  if(elapsed>=path.points.at(-1).time)queue.push({type:'end',source:path.id,state,at:state.start+elapsed});
 }
 for(const [id,state] of [...active]){const path=lookup.get(id);if(path)schedule(path,state);else active.delete(id);if(overflow)break;}
 while(queue.length&&!overflow){
  if(++processed>budget){overflow=true;break;}
  queue.sort((a,b)=>a.at-b.at||Number(a.type==='end')-Number(b.type==='end'));const event=queue.shift();
  if(active.get(event.source)!==event.state)continue;
  if(event.type==='end'){const path=lookup.get(event.source);if(isLoopPath(path)){const state=pathState(path,event.at,paths);active.set(path.id,state);changes.push({type:'restart',id:path.id,at:event.at,self:true});schedule(path,state);}else{active.delete(event.source);changes.push({type:'end',id:event.source,at:event.at});}continue;}
  const target=event.hit.bell;
  if(target.kind!=='path'){notes.push({bell:target,at:event.at});continue;}
  const path=lookup.get(target.pathId);if(!path)continue;
  const restarting=active.has(path.id),state=pathState(path,event.at,paths);active.set(path.id,state);changes.push({type:restarting?'restart':'start',id:path.id,at:event.at,self:path.id===event.source});schedule(path,state);
 }
 if(overflow){active.clear();return {notes:[],changes,overflow:true};}
 // Heads created or restarted in this frame are positioned at the same audio time.
 for(const [id,state] of active)state.point=pointAt(lookup.get(id).points,Math.max(0,now-state.start));
 return {notes,changes,overflow:false};
}
