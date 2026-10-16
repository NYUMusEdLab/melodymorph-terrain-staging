export const DEFAULT_DISPLAY={notation:'off',tonic:0,accidentals:'sharps'};
export const TONICS=['C','D♭','D','E♭','E','F','F♯','G','A♭','A','B♭','B'];
const sharpDegrees=[[1,''],[1,'♯'],[2,''],[2,'♯'],[3,''],[4,''],[4,'♯'],[5,''],[5,'♯'],[6,''],[6,'♯'],[7,'']];
const flatDegrees=[[1,''],[2,'♭'],[2,''],[3,'♭'],[3,''],[4,''],[5,'♭'],[5,''],[6,'♭'],[6,''],[7,'♭'],[7,'']];
// Explicit study convention: undotted 1 is the chosen tonic in scientific octave 4.
// The stored MIDI pitch is never changed by this display calculation.
export function jianpu(midi,{tonic=0,accidentals='sharps'}={}){
 const relative=midi-(60+tonic),semitone=((relative%12)+12)%12;
 const [degree,accidental]=(accidentals==='flats'?flatDegrees:sharpDegrees)[semitone];
 return {degree,accidental,octave:Math.floor(relative/12)};
}
export function jianpuDescription(midi,display){
 const n=jianpu(midi,display),alter=n.accidental==='♯'?'sharp ':n.accidental==='♭'?'flat ':'';
 const octave=n.octave===0?'undotted':`${Math.abs(n.octave)} octave${Math.abs(n.octave)===1?'':'s'} ${n.octave>0?'above':'below'} the undotted range`;
 return `Jianpu ${alter}${n.degree}, ${octave}; undotted 1 is ${TONICS[display.tonic]}4`;
}
export function jianpuMarkup(midi,display){
 const n=jianpu(midi,display),dots=count=>Array.from({length:count},()=>'<i>•</i>').join('');
 return `<span class="jianpu" aria-hidden="true"><span class="octave-dots above">${dots(Math.max(0,n.octave))}</span><span>${n.accidental}${n.degree}</span><span class="octave-dots below">${dots(Math.max(0,-n.octave))}</span></span>`;
}
