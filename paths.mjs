// New geometric path playback, sampled from a performed gesture.
export function pointAt(points,time){
  if(time<=points[0].time)return {...points[0],time};
  for(let i=1;i<points.length;i++)if(points[i].time>=time){const a=points[i-1],b=points[i],f=b.time===a.time?1:(time-a.time)/(b.time-a.time);return {x:a.x+(b.x-a.x)*f,y:a.y+(b.y-a.y)*f,time};}
  return {...points.at(-1),time};
}
export function segmentsBetween(points,from,to){
  const start=pointAt(points,Math.max(0,from)),middle=points.filter(p=>p.time>from&&p.time<to),end=pointAt(points,to);return [start,...middle,end];
}
export function entryFraction(a,b,target){
  const rx=target.kind==='recorder'?63:target.kind==='path'?23:34,ry=target.kind==='recorder'?43:target.kind==='path'?23:34;
  const x=(a.x-target.x)/rx,y=(a.y-target.y)/ry,dx=(b.x-a.x)/rx,dy=(b.y-a.y)/ry;
  if(x*x+y*y<=1)return 0;
  const A=dx*dx+dy*dy;if(A===0)return null;
  const B=2*(x*dx+y*dy),C=x*x+y*y-1,D=B*B-4*A*C;if(D<0)return null;
  const t=(-B-Math.sqrt(D))/(2*A);return t>=0&&t<=1?t:null;
}
export function inside(p,b){const rx=b.kind==='recorder'?63:b.kind==='path'?23:34,ry=b.kind==='recorder'?43:b.kind==='path'?23:34;return ((p.x-b.x)/rx)**2+((p.y-b.y)/ry)**2<=1;}
export function pathHits(points,from,to,bells,previous=new Set(),maxHits=Infinity){
  const segments=segmentsBetween(points,from,to),hits=[];let occupied=new Set(previous);
  for(let i=1;i<segments.length;i++){const a=segments[i-1],b=segments[i],next=new Set();for(const bell of bells){const f=entryFraction(a,b,bell);if(f!==null&&!occupied.has(bell.id)){if(hits.length>=maxHits)return {hits,inside:occupied,point:a,overflow:true};hits.push({bell,time:a.time+(b.time-a.time)*f});}if(inside(b,bell))next.add(bell.id);}occupied=next;}
  return {hits:hits.sort((a,b)=>a.time-b.time),inside:occupied,point:segments.at(-1)};
}
