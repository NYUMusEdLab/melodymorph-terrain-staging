// Newly authored piano geometry. Pitch range matches the existing save format.
export const KEY_WIDTH=62, OCTAVE_WIDTH=7*KEY_WIDTH;
const naturals=[0,2,4,5,7,9,11];
export function pianoKeys(keyWidth=KEY_WIDTH,padding=0){
 const keys=[];let whites=0;
 for(let midi=48;midi<=84;midi++){
  const black=!naturals.includes(midi%12);
  keys.push({midi,black,left:padding+(black?whites*keyWidth-22:whites*keyWidth),width:black?44:keyWidth});
  if(!black)whites++;
 }
 return {keys,width:whites*keyWidth+padding*2};
}
// Complete natural-key columns with inset edges; center the full range when it fits.
export function paletteLayout(viewportWidth){
 const columns=Math.max(1,Math.min(22,Math.floor((viewportWidth-32)/KEY_WIDTH)));
 const keyWidth=Math.min(68,Math.max(KEY_WIDTH,(viewportWidth-32)/columns));
 const padding=Math.max(16,(viewportWidth-columns*keyWidth)/2);
 return {...pianoKeys(keyWidth,padding),keyWidth,columns};
}
// Lock the gesture once its direction is clear: browsing must never place bells.
export function paletteIntent(dx,dy){
 if(Math.hypot(dx,dy)<8)return null;
 return Math.abs(dx)>Math.abs(dy)?'scroll':'place';
}

export function paletteKeys(layout,mode='chromatic'){
 if(mode==='pentatonic')return layout.keys.filter(k=>[0,2,4,7,9].includes(k.midi%12));
 return mode==='diatonic'?layout.keys.filter(k=>!k.black):layout.keys;
}
