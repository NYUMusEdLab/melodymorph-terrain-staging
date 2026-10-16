import {validate,color,strokePoints} from './model.mjs';
// A deterministic image of musical objects only: no DOM capture, labels, account
// data, external resources or upload. Detail is reduced only in the card image.
const sample=points=>points.length<=256?points:points.filter((_,i)=>i%Math.ceil(points.length/255)===0||i===points.length-1);
export function terrainThumbnail(raw){
 const p=validate(raw),positions=[...p.bells,...p.paths.flatMap(p=>p.points),...p.ink.flatMap(s=>strokePoints(s).map(([x,y])=>({x,y})))];
 let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
 for(const q of positions){minX=Math.min(minX,q.x-75);minY=Math.min(minY,q.y-60);maxX=Math.max(maxX,q.x+75);maxY=Math.max(maxY,q.y+60);}
 if(!positions.length){minX=0;minY=0;maxX=640;maxY=360;}
 const parts=[`<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180" viewBox="${minX} ${minY} ${maxX-minX} ${maxY-minY}"><rect x="${minX}" y="${minY}" width="${maxX-minX}" height="${maxY-minY}" fill="#1e2a38"/>`];
 const line=(points,stroke,width)=>`<polyline points="${sample(points).map(q=>q.join(',')).join(' ')}" fill="none" stroke="${stroke}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`;
 for(const s of p.ink)parts.push(line(strokePoints(s),s.color||'#d9e2dc',s.width||3));
 for(const path of p.paths){const a=path.points[0];parts.push(line(path.points.map(q=>[q.x,q.y]),'#a9bbdb',3),`<circle cx="${a.x}" cy="${a.y}" r="23" fill="#e6eef8" stroke="#aac9dd" stroke-width="2"/><path d="M${a.x-5} ${a.y-8}l13 8-13 8Z" fill="#2e5065"/>`);}
 for(const b of p.bells){
  if(b.kind==='recorder'){
   parts.push(`<rect x="${b.x-63}" y="${b.y-43}" width="126" height="86" rx="14" fill="#13202d" stroke="#b6cbd6" stroke-width="2"/>`);
   const duration=Math.max(.1,b.events.at(-1).time),events=sample(b.events);
   for(const e of events)parts.push(`<circle cx="${b.x-48+96*e.time/duration}" cy="${b.y+24-(e.midi-48)/36*48}" r="3" fill="${color(e.midi,p.display.colors)}"/>`);
  }else{
   const fill=color(b.midi,p.display.colors),common=`fill="${fill}" stroke="#ffffffaa" stroke-width="2"`;
   if(b.timbre==='vibes')parts.push(`<path d="M${b.x} ${b.y-32}l32 64h-64Z" ${common}/>`);
   else if(b.timbre==='bowed')parts.push(`<path d="M${b.x} ${b.y-32}l32 32-32 32-32-32Z" ${common}/>`);
   else if(b.timbre==='epiano')parts.push(`<rect x="${b.x-32}" y="${b.y-32}" width="64" height="64" rx="6" ${common}/>`);
   else if(b.timbre==='pluck')parts.push(`<path d="M${b.x} ${b.y-32}l9 21 23 11-23 10-9 22-10-22-22-10 22-11Z" ${common}/>`);
   else{parts.push(`<circle cx="${b.x}" cy="${b.y}" r="32" ${common}/>`);if(b.timbre==='grand')parts.push(`<circle cx="${b.x}" cy="${b.y}" r="17" fill="#1e2a38"/>`);}
  }
 }
 parts.push('</svg>');return 'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(parts.join(''));
}
