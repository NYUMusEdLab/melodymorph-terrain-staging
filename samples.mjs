export const SAMPLE_MAP={
 // The legacy piano key identifies round bells in saved landscapes. Alex chose bass for them.
 piano:{instrument:'acoustic_bass',label:'Pizzicato bass',duration:2.8,release:.18},
 epiano:{instrument:'electric_piano_1',label:'Electric piano',duration:3.2,release:.2},
 grand:{instrument:'acoustic_grand_piano',label:'Piano',duration:3.5,release:.2},
 vibes:{instrument:'vibraphone',label:'Vibes',duration:4,release:.25},
 pluck:{instrument:'acoustic_guitar_nylon',label:'Nylon guitar',duration:2.4,release:.12},
 bowed:{instrument:'violin',label:'Bowed violin',duration:1.8,release:.25}
};
export const SAMPLE_NOTES=Array.from({length:37},(_,i)=>48+i);
// This approved player version filters MIDI.js object keys before MIDI mapping.
// Its decode filter therefore needs ASCII note names, not numeric MIDI values.
export const SAMPLE_NAMES=SAMPLE_NOTES.map(m=>['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B'][m%12]+(Math.floor(m/12)-1));
export function sampleGain(buffers){
 const rms=[];
 for(const buffer of Object.values(buffers)){
  const data=buffer.getChannelData(0),length=Math.min(data.length,Math.floor(buffer.sampleRate*.3));let sum=0,n=0;
  for(let i=0;i<length;i+=4){sum+=data[i]*data[i];n++;}
  if(n&&sum>0)rms.push(Math.sqrt(sum/n));
 }
 rms.sort((a,b)=>a-b);const median=rms[Math.floor(rms.length/2)]||.1;
 return Math.max(.25,Math.min(8,.10/median));
}
export class SampleBank{
 constructor(onStatus=()=>{},loader,timeout=12000){this.onStatus=onStatus;this.loader=loader;this.timeout=timeout;this.entries=new Map();}
 prepare(ctx,destination){return Promise.all(Object.keys(SAMPLE_MAP).map(t=>this.load(t,ctx,destination)));}
 report(){this.onStatus(Object.fromEntries([...this.entries].map(([key,e])=>[key,e.state])));}
 load(timbre,ctx,destination){
  if(this.entries.has(timbre))return this.entries.get(timbre).promise;
  const entry={state:'loading'};this.entries.set(timbre,entry);this.report();
  const loader=this.loader||globalThis.Soundfont?.instrument;
  entry.promise=(async()=>{let timer;
   try{
    if(!loader)throw new Error('Sample loader unavailable');
    const player=await Promise.race([loader(ctx,SAMPLE_MAP[timbre].instrument,{destination,notes:SAMPLE_NAMES,soundfont:'MusyngKite',format:'mp3',nameToUrl:name=>new URL(`./assets/soundfonts/${name}-mp3.js`,import.meta.url).href}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Sample load timeout')),this.timeout);})]);
    if(SAMPLE_NOTES.some(m=>!player.buffers?.[m]))throw new Error('Incomplete sample range');
    entry.buffers=player.buffers;entry.gain=sampleGain(player.buffers);entry.state='ready';
   }catch(error){entry.state='failed';entry.error=error.message;}
   finally{clearTimeout(timer);this.report();}
  })();return entry.promise;
 }
 get(timbre,midi){const e=this.entries.get(timbre);return e?.state==='ready'?{buffer:e.buffers[midi],gain:e.gain}:null;}
 retry(ctx,destination){for(const [key,e] of this.entries)if(e.state==='failed')this.entries.delete(key);return this.prepare(ctx,destination);}
}
