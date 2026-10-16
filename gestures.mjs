// Coordinates are local to the canvas. Musical touches never enter this navigator.
export function pinchStart(view,a,b){const midpoint={x:(a.x+b.x)/2,y:(a.y+b.y)/2};return {origin:{...view},distance:Math.max(1,Math.hypot(b.x-a.x,b.y-a.y)),anchor:{x:midpoint.x/view.zoom-view.x,y:midpoint.y/view.zoom-view.y}};}
export function pinchView(start,a,b){const zoom=Math.max(.4,Math.min(2,start.origin.zoom*Math.hypot(b.x-a.x,b.y-a.y)/start.distance));const bound=n=>Math.max(-100000,Math.min(100000,n));return {zoom,x:bound((a.x+b.x)/2/zoom-start.anchor.x),y:bound((a.y+b.y)/2/zoom-start.anchor.y)};}
export class TouchNavigator{
 constructor(){this.points=new Map();this.pinch=null;this.suppressed=new Set();}
 down(id,point,eligible,view){this.points.set(id,{...point,eligible});if(!eligible||this.pinch||this.suppressed.size)return false;const pair=[...this.points].filter(([,p])=>p.eligible);if(pair.length!==2)return false;this.pinch={ids:pair.map(([id])=>id),...pinchStart(view,pair[0][1],pair[1][1])};return true;}
 move(id,point){const old=this.points.get(id);if(old)this.points.set(id,{...old,...point});if(!this.pinch||!this.pinch.ids.includes(id))return null;return pinchView(this.pinch,...this.pinch.ids.map(id=>this.points.get(id)));}
 up(id,cancelled=false){this.points.delete(id);this.suppressed.delete(id);if(!this.pinch?.ids.includes(id))return null;const p=this.pinch;this.pinch=null;for(const other of p.ids)if(other!==id&&this.points.has(other))this.suppressed.add(other);return {cancelled,origin:p.origin};}
 clear(){this.points.clear();this.pinch=null;this.suppressed.clear();}
}
