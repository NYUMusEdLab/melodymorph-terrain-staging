import {entryFraction,inside} from './paths.mjs';
// Authoring only: saved points already contain the chosen loop duration, so older
// landscapes and immutable activity playback keep their recorded timing.
export class PathCapture{
 constructor(point){this.samples=[{...point,time:0}];this.circle={kind:'path',...point};this.exited=false;this.closure=null;}
 get points(){return this.closure?.points||this.samples;}
 append(point){
  const previous=this.samples.at(-1),next={...point,time:Math.max(previous.time,Math.min(600,point.time))};
  // Retain both endpoints while bounding very long gestures to the save format.
  if(this.samples.length>=2999){const last=this.samples.at(-1);this.samples=this.samples.filter((_,i)=>i%2===0);if(this.samples.at(-1)!==last)this.samples.push(last);}
  if(!inside(next,this.circle)){this.exited=true;this.closure=null;}
  else if(this.exited&&!this.closure&&!inside(previous,this.circle)){
   const fraction=entryFraction(previous,next,this.circle);
   if(fraction!==null){
    const edge={x:previous.x+(next.x-previous.x)*fraction,y:previous.y+(next.y-previous.y)*fraction,time:previous.time+(next.time-previous.time)*fraction};
    // Keep a mathematically-on-edge endpoint inside despite floating-point error.
    edge.x=this.circle.x+(edge.x-this.circle.x)*(1-1e-10);edge.y=this.circle.y+(edge.y-this.circle.y)*(1-1e-10);
    if(edge.time>0)this.closure={point:edge,points:[...this.samples,edge]};
   }
  }
  this.samples.push(next);return this.closure;
 }
}
