// Pitch/color associations checked against the manufacturer's BWDG and BWCG sets.
// Hex values are screen approximations, not manufacturer-specified color standards.
// No brand images or assets are distributed. See docs/CLASSROOM-COLORS-20261016.md.
export const BOOMWHACKERS_COLORS=Object.freeze([
 '#e3342f','#f05a28','#f7941d','#ffc31a','#f7e600','#91c73e',
 '#2ead4a','#008e8e','#3d55cc','#5b3f9c','#843f9e','#c63f87'
]);
export const COLOR_SCHEMES=Object.freeze(['original','boomwhackers']);
export function pitchColor(midi,scheme='original'){
 if(scheme==='boomwhackers')return BOOMWHACKERS_COLORS[((midi%12)+12)%12];
 const height=Math.max(0,Math.min(1,(midi-48)/36));
 return `hsl(${(midi%12)*28} ${Math.round(94-height*50)}% ${Math.round(42+height*42)}%)`;
}
